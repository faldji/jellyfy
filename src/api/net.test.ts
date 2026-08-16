import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/device', () => ({
  sanitizeDeviceName: (value: string) => value || 'device',
}));

import { ApiError, fetchWithRetry, getShareKey, jellyfinFetch } from '@/api/client';
import { resetNet, subscribeNet, summarizeNet, type NetEvent } from '@/api/net';
import { resetSharedGets, SHARE_IDLE_MS } from '@/api/shared-get';
import { imagePixelSize } from '@/lib/image-size';

afterEach(() => {
  resetNet();
  resetSharedGets();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('jellyfinFetch GET sharing', () => {
  it('shares one in-flight GET for the same URL', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(JSON.stringify({ Items: [{ Id: '1', Name: 'A' }] }), { status: 200 });
      })
    );

    const events: NetEvent[] = [];
    const stop = subscribeNet((event) => events.push(event));
    const [a, b] = await Promise.all([
      jellyfinFetch('http://jf', '/Items', { query: { limit: 1 } }),
      jellyfinFetch('http://jf', '/Items', { query: { limit: 1 } }),
    ]);
    stop();

    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(events.some((event) => event.deduped)).toBe(true);
  });

  it('does not abort a shared GET when one waiter cancels', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return new Response(JSON.stringify({ Name: 'Ok' }), { status: 200 });
      })
    );

    const controller = new AbortController();
    const leaving = jellyfinFetch('http://jf', '/Items/1', { signal: controller.signal });
    const staying = jellyfinFetch('http://jf', '/Items/1');
    controller.abort();

    await expect(leaving).rejects.toMatchObject({ name: 'AbortError' });
    await expect(staying).resolves.toEqual({ name: 'Ok' });
    expect(calls).toBe(1);
  });

  it('aborts the wire GET after the last waiter grace period', async () => {
    let used: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        used = init?.signal ?? undefined;
        return new Promise(() => undefined);
      })
    );

    const a = new AbortController();
    const b = new AbortController();
    const first = jellyfinFetch('http://jf', '/Items/z', { signal: a.signal });
    const second = jellyfinFetch('http://jf', '/Items/z', { signal: b.signal });
    a.abort();
    b.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(used?.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, SHARE_IDLE_MS + 20));
    expect(used?.aborted).toBe(true);
  });

  it('lets a new consumer reuse a GET during the grace period', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return new Response(JSON.stringify({ Name: 'Ok' }), { status: 200 });
      })
    );

    const firstWaiter = new AbortController();
    const leaving = jellyfinFetch('http://jf', '/Items/album', { signal: firstWaiter.signal });
    firstWaiter.abort();
    await expect(leaving).rejects.toMatchObject({ name: 'AbortError' });
    const replay = jellyfinFetch('http://jf', '/Items/album');
    await expect(replay).resolves.toEqual({ name: 'Ok' });
    expect(calls).toBe(1);
  });
});

describe('GET share identity', () => {
  it('does not share different users, servers, or query params', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ Ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const sessionA = {
      serverUrl: 'http://jf',
      serverName: 'JF',
      accessToken: 'a',
      userId: 'u1',
      userName: 'a',
      deviceId: 'd',
      deviceName: 'n',
    };
    const sessionB = { ...sessionA, userId: 'u2', accessToken: 'b' };

    await Promise.all([
      jellyfinFetch('http://jf', '/Items', { auth: sessionA, query: { limit: 1 } }),
      jellyfinFetch('http://jf', '/Items', { auth: sessionB, query: { limit: 1 } }),
      jellyfinFetch('http://other', '/Items', { auth: sessionA, query: { limit: 1 } }),
      jellyfinFetch('http://jf', '/Items', { auth: sessionA, query: { limit: 2 } }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('builds a share key from user + server + path + query, not the token', () => {
    const a = getShareKey('http://jf', '/Items', 'limit=1', 'u1');
    const b = getShareKey('http://jf', '/Items', 'limit=1', 'u1');
    const c = getShareKey('http://jf', '/Items', 'limit=2', 'u1');
    const d = getShareKey('http://jf', '/Items', 'limit=1', 'u2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a.includes('token')).toBe(false);
  });
});

describe('fetchWithRetry', () => {
  it('does not retry HTTP 4xx', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(jellyfinFetch('http://jf', '/Items/missing')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transport failures a bounded number of times', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ Ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(jellyfinFetch('http://jf', '/System/Info/Public')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry abort', async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchWithRetry('http://jf/x', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});

describe('summarizeNet', () => {
  it('counts wire vs deduped vs cache', () => {
    const stop = subscribeNet(() => undefined);
    stop();
    const summary = summarizeNet([
      { at: 1, method: 'GET', path: '/Items', ms: 10, bytes: 100 },
      { at: 2, method: 'GET', path: '/Items', ms: 0, deduped: true },
      { at: 3, method: 'GET', path: '/Items', ms: 0, cacheHit: true },
    ]);
    expect(summary.wire).toBe(1);
    expect(summary.deduped).toBe(1);
    expect(summary.cacheHits).toBe(1);
    expect(summary.bytes).toBe(100);
  });
});

describe('imagePixelSize', () => {
  it('snaps to reuse buckets', () => {
    expect(imagePixelSize(48)).toBe(96);
    expect(imagePixelSize(148 * 2)).toBe(320);
    expect(imagePixelSize(900)).toBe(640);
  });
});
