import { APP_DEVICE, APP_NAME, APP_VERSION } from '@/constants/app';
import { emitNet } from '@/api/net';
import { abortError, hasSharedGet, isAbortError, shareGet, waitOrAbort } from '@/api/shared-get';
import type { AuthenticationResult, PublicSystemInfo } from '@/api/types';
import { sanitizeDeviceName } from '@/lib/device';
import { logger } from '@/lib/logger';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export type Session = {
  serverUrl: string;
  serverName: string;
  serverId?: string;
  accessToken: string;
  userId: string;
  userName: string;
  deviceId: string;
  deviceName: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksPascal(key: string): boolean {
  return key.length > 0 && key[0] === key[0].toUpperCase() && key[0] !== key[0].toLowerCase();
}

const PRESERVE_KEY_PARENTS = new Set([
  'imageTags',
  'ImageTags',
  'imageBlurHashes',
  'ImageBlurHashes',
]);

/** Jellyfin may return PascalCase unless the CamelCase profile is honored. */
export function camelize<T>(value: unknown, parentKey?: string): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelize(item, parentKey)) as T;
  }
  if (!isPlainObject(value)) {
    return value as T;
  }
  const preserveKeys = Boolean(parentKey && PRESERVE_KEY_PARENTS.has(parentKey));
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const mapped = preserveKeys ? key : looksPascal(key) ? key.charAt(0).toLowerCase() + key.slice(1) : key;
    next[mapped] = camelize(child, mapped);
  }
  return next as T;
}

export function authorizationHeader(session: Pick<Session, 'accessToken' | 'deviceId' | 'deviceName'>): string {
  const parts = [
    `Client="${APP_NAME}"`,
    `Device="${sanitizeDeviceName(session.deviceName)}"`,
    `DeviceId="${session.deviceId}"`,
    `Version="${APP_VERSION}"`,
    `Token="${session.accessToken}"`,
  ];
  return `MediaBrowser ${parts.join(', ')}`;
}

export function anonymousAuthorization(deviceId: string, deviceName: string): string {
  return `MediaBrowser Client="${APP_NAME}", Device="${sanitizeDeviceName(deviceName)}", DeviceId="${deviceId}", Version="${APP_VERSION}"`;
}

export function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      qs.set(key, value.map(String).join(','));
    } else if (typeof value === 'boolean') {
      qs.set(key, value ? 'true' : 'false');
    } else {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  auth?: Session | null;
  deviceId?: string;
  deviceName?: string;
  accept?: string;
  /** 401 is not treated as a dead login (optional / other-user probes). */
  soft?: boolean;
  signal?: AbortSignal;
};

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Auth store registers this so the HTTP layer never imports Zustand. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export { waitOrAbort } from '@/api/shared-get';

/** Transient browser/network drops. Abort is never retried. Backoff is bounded. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<{ response: Response; retries: number }> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    if (init.signal?.aborted) throw abortError();
    try {
      const response = await fetch(url, init);
      return { response, retries: i };
    } catch (err) {
      last = err;
      if (isAbortError(err)) throw err;
      if (i === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000, 200 * 2 ** i)));
    }
  }
  throw last instanceof Error ? last : new Error('Failed to fetch');
}

/** Identity for in-flight GET sharing. Must include server + user + path + query. Not the token. */
export function getShareKey(
  serverUrl: string,
  path: string,
  query: string,
  userId?: string
): string {
  return `${userId ?? ''}\n${serverUrl}${path}${query ? `?${query}` : ''}`;
}

export async function jellyfinFetch<T>(serverUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const query = options.query ? toQuery(options.query) : '';
  const url = `${serverUrl}${path}${query ? `?${query}` : ''}`;
  const method = options.method ?? 'GET';
  const shareKey = getShareKey(serverUrl, path, query, options.auth?.userId);

  if (method === 'GET') {
    if (hasSharedGet(shareKey)) emitNet({ method, path, ms: 0, deduped: true });
    try {
      return await shareGet(
        shareKey,
        (signal) => runJellyfinFetch<T>(url, path, method, { ...options, signal }),
        options.signal
      );
    } catch (err) {
      if (options.signal?.aborted || isAbortError(err)) {
        emitNet({ method, path, ms: 0, cancelled: true });
      }
      throw err;
    }
  }

  try {
    return await waitOrAbort(runJellyfinFetch<T>(url, path, method, options), options.signal);
  } catch (err) {
    if (options.signal?.aborted || isAbortError(err)) {
      emitNet({ method, path, ms: 0, cancelled: true });
    }
    throw err;
  }
}

async function runJellyfinFetch<T>(
  url: string,
  path: string,
  method: string,
  options: RequestOptions
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: options.accept ?? 'application/json; profile="CamelCase"',
  };

  if (options.auth) {
    headers.Authorization = authorizationHeader(options.auth);
  } else if (options.deviceId) {
    headers.Authorization = anonymousAuthorization(options.deviceId, options.deviceName ?? APP_DEVICE);
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const started = Date.now();
  let response: Response;
  let retries = 0;
  try {
    const result = await fetchWithRetry(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
    response = result.response;
    retries = result.retries;
  } catch (err) {
    const cancelled = options.signal?.aborted || isAbortError(err);
    if (cancelled) {
      emitNet({ method, path, ms: Date.now() - started, cancelled: true });
    } else {
      const reason = err instanceof Error ? err.message : String(err);
      logger.warn(`${method} ${path} failed before a response`, { error: reason });
    }
    throw err;
  }

  if (response.status === 204) {
    emitNet({ method, path, ms: Date.now() - started, status: 204, bytes: 0, retries });
    return undefined as T;
  }

  const text = await response.text();
  const parsed = text ? safeJson(text) : undefined;
  emitNet({
    method,
    path,
    ms: Date.now() - started,
    status: response.status,
    bytes: text.length,
    retries,
  });

  if (!response.ok) {
    const message =
      (isPlainObject(parsed) && typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed === 'string' && parsed) ||
      `${response.status} ${response.statusText}`;
    if (response.status === 401 && options.auth && !options.soft) {
      unauthorizedHandler?.();
    }
    throw new ApiError(message, response.status);
  }

  return camelize<T>(parsed);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function fetchPublicInfo(serverUrl: string): Promise<PublicSystemInfo> {
  return jellyfinFetch<PublicSystemInfo>(serverUrl, '/System/Info/Public');
}

export async function authenticateByName(input: {
  serverUrl: string;
  username: string;
  password: string;
  deviceId: string;
  deviceName: string;
}): Promise<AuthenticationResult> {
  return jellyfinFetch<AuthenticationResult>(input.serverUrl, '/Users/AuthenticateByName', {
    method: 'POST',
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    body: {
      Username: input.username,
      Pw: input.password,
    },
  });
}
