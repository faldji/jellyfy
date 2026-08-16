/**
 * Own the HTTP download on web (YouTube / MSE style) so buffering continues
 * while paused. HTMLAudioElement stops requesting once it has ~10–30s.
 */

const MP3_TYPES = ['audio/mpeg', 'audio/mpeg; codecs="mp3"'] as const;

export function canPumpMp3(): boolean {
  if (typeof MediaSource === 'undefined' || typeof MediaSource.isTypeSupported !== 'function') {
    return false;
  }
  return MP3_TYPES.some((type) => MediaSource.isTypeSupported(type));
}

export function pickMp3Mime(): string {
  const supported = MP3_TYPES.find((type) => MediaSource.isTypeSupported(type));
  return supported ?? 'audio/mpeg';
}

export type MediaSourceHandle = {
  mediaSource: MediaSource;
  objectUrl: string;
  mime: string;
};

export function createMediaSourceHandle(): MediaSourceHandle | null {
  if (!canPumpMp3()) return null;
  try {
    const mediaSource = new MediaSource();
    return {
      mediaSource,
      objectUrl: URL.createObjectURL(mediaSource),
      mime: pickMp3Mime(),
    };
  } catch {
    return null;
  }
}

export function revokeMediaSourceUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Already revoked.
  }
}

function waitForSourceBuffer(
  mediaSource: MediaSource,
  mime: string,
  signal: AbortSignal
): Promise<SourceBuffer> {
  return new Promise((resolve, reject) => {
    const fail = (error: unknown) => {
      signal.removeEventListener('abort', onAbort);
      mediaSource.removeEventListener('sourceopen', onOpen);
      reject(error);
    };
    const onAbort = () => fail(new DOMException('Aborted', 'AbortError'));
    const onOpen = () => {
      signal.removeEventListener('abort', onAbort);
      try {
        resolve(mediaSource.addSourceBuffer(mime));
      } catch (error) {
        fail(error);
      }
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    if (mediaSource.readyState === 'open') {
      onOpen();
      return;
    }
    mediaSource.addEventListener('sourceopen', onOpen, { once: true });
  });
}

function appendChunk(sourceBuffer: SourceBuffer, chunk: Uint8Array, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', onEnd);
      sourceBuffer.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const onError = () => {
      cleanup();
      reject(new Error('SourceBuffer error'));
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    const start = () => {
      if (signal.aborted) {
        onAbort();
        return;
      }
      if (sourceBuffer.updating) {
        sourceBuffer.addEventListener('updateend', start, { once: true });
        return;
      }
      try {
        sourceBuffer.addEventListener('updateend', onEnd, { once: true });
        sourceBuffer.addEventListener('error', onError, { once: true });
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        sourceBuffer.appendBuffer(copy);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    start();
  });
}

/** Fetch `url` and append into the MediaSource. Continues while the element is paused. */
export async function pumpIntoMediaSource(input: {
  mediaSource: MediaSource;
  url: string;
  mime: string;
  signal: AbortSignal;
  onProgress?: () => void;
}): Promise<void> {
  const sourceBuffer = await waitForSourceBuffer(input.mediaSource, input.mime, input.signal);
  const response = await fetch(input.url, { signal: input.signal });
  if (!response.ok) {
    throw new Error(`Stream ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Stream had no body');
  }
  const reader = response.body.getReader();
  try {
    while (!input.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      await appendChunk(sourceBuffer, value, input.signal);
      input.onProgress?.();
    }
    if (!input.signal.aborted && input.mediaSource.readyState === 'open' && !sourceBuffer.updating) {
      try {
        input.mediaSource.endOfStream();
      } catch {
        // Already ended or closing.
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore.
    }
  }
}
