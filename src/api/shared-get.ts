export function abortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

export function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError');
}

/** Wait on a shared promise without aborting it when this caller goes away. */
export function waitOrAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort);
    work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

type SharedGet = {
  promise: Promise<unknown>;
  waiters: number;
  controller: AbortController;
  idle?: ReturnType<typeof setTimeout>;
};

const sharedGets = new Map<string, SharedGet>();

/** Last waiter can leave briefly; play after album unmount can still join. */
export const SHARE_IDLE_MS = 50;

/**
 * One in-flight GET per key.
 * Extra waiters join. When the last waiter leaves, the wire request stays up
 * for SHARE_IDLE_MS so a new consumer can reuse it. After that it is cancelled.
 */
export function shareGet<T>(
  key: string,
  run: (signal: AbortSignal) => Promise<T>,
  waiterSignal?: AbortSignal
): Promise<T> {
  let entry = sharedGets.get(key);
  if (!entry || entry.controller.signal.aborted) {
    const controller = new AbortController();
    const started: SharedGet = {
      promise: null as unknown as Promise<unknown>,
      waiters: 0,
      controller,
    };
    started.promise = run(controller.signal).finally(() => {
      if (started.idle) clearTimeout(started.idle);
      if (sharedGets.get(key) === started) sharedGets.delete(key);
    });
    entry = started;
    sharedGets.set(key, entry);
  }

  if (entry.idle) {
    clearTimeout(entry.idle);
    entry.idle = undefined;
  }
  entry.waiters += 1;

  const release = (aborted: boolean) => {
    entry.waiters -= 1;
    if (!aborted || entry.waiters > 0 || entry.controller.signal.aborted) return;
    entry.idle = setTimeout(() => {
      entry.idle = undefined;
      if (entry.waiters > 0 || entry.controller.signal.aborted) return;
      entry.controller.abort();
      if (sharedGets.get(key) === entry) sharedGets.delete(key);
    }, SHARE_IDLE_MS);
  };

  return waitOrAbort(entry.promise as Promise<T>, waiterSignal).then(
    (value) => {
      release(false);
      return value;
    },
    (err) => {
      release(waiterSignal?.aborted || isAbortError(err));
      throw err;
    }
  );
}

/** Test helper. */
export function resetSharedGets() {
  sharedGets.clear();
}

export function sharedGetCount(): number {
  return sharedGets.size;
}

export function hasSharedGet(url: string): boolean {
  const entry = sharedGets.get(url);
  return Boolean(entry && !entry.controller.signal.aborted);
}
