import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/device', () => ({
  resolveDeviceName: () => 'Phone',
  sanitizeDeviceName: (value: string) => value || 'Phone',
}));

vi.mock('@/lib/ids', () => ({
  createDeviceId: async () => 'device-1',
  createPlaySessionId: () => 'play-1',
  normId: (value?: string) => value ?? '',
  sameId: (a?: string, b?: string) => a === b,
}));

vi.mock('@/lib/storage', () => ({
  getSecret: vi.fn(),
  setSecret: vi.fn(async () => undefined),
  deleteSecret: vi.fn(async () => undefined),
}));

vi.mock('@/api/jellyfin', () => ({
  createApi: () => ({ logout: vi.fn() }),
}));

import { getSecret } from '@/lib/storage';
import { useAuth } from '@/store/auth';

afterEach(() => {
  useAuth.setState({
    hydrated: false,
    session: null,
    hydrating: false,
    loggingOut: false,
  });
  vi.unstubAllGlobals();
});

describe('session restore', () => {
  it('does not create a new Jellyfin session or call fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(getSecret).mockImplementation(async (key: string) => {
      if (key === 'jellyfy.session') {
        return JSON.stringify({
          serverUrl: 'http://jf',
          serverName: 'JF',
          accessToken: 'tok',
          userId: 'u1',
          userName: 'me',
          deviceId: 'device-1',
          deviceName: 'Phone',
        });
      }
      return 'device-1';
    });

    await useAuth.getState().hydrate();
    expect(useAuth.getState().session?.accessToken).toBe('tok');
    expect(useAuth.getState().session?.deviceId).toBe('device-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats overlapping 401s as a single logout', () => {
    useAuth.setState({
      hydrated: true,
      session: {
        serverUrl: 'http://jf',
        serverName: 'JF',
        accessToken: 'tok',
        userId: 'u1',
        userName: 'me',
        deviceId: 'device-1',
        deviceName: 'Phone',
      },
      hydrating: false,
      loggingOut: false,
    });
    useAuth.getState().invalidateLocalSession();
    useAuth.getState().invalidateLocalSession();
    expect(useAuth.getState().session).toBeNull();
    expect(useAuth.getState().loggingOut).toBe(true);
  });
});
