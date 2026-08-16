import * as Crypto from 'expo-crypto';

function fallbackId(): string {
  return `jf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function createDeviceId(): Promise<string> {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Some runtimes ship expo-crypto without randomUUID.
  }
  try {
    const web = globalThis.crypto;
    if (web && typeof web.randomUUID === 'function') {
      return web.randomUUID();
    }
  } catch {
    // ignore
  }
  return fallbackId();
}

export function createPlaySessionId(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return fallbackId();
}

/** Jellyfin ids sometimes differ only by hyphens or case. */
export function normId(id?: string | null): string {
  return (id ?? '').replace(/-/g, '').toLowerCase();
}

export function sameId(a?: string | null, b?: string | null): boolean {
  const left = normId(a);
  const right = normId(b);
  return Boolean(left && right && left === right);
}
