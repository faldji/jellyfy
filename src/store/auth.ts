import { authenticateByName, fetchPublicInfo, setUnauthorizedHandler, type Session } from '@/api/client';
import { createApi } from '@/api/jellyfin';
import { resolveDeviceName } from '@/lib/device';
import { createDeviceId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { getSecret, setSecret, deleteSecret } from '@/lib/storage';
import { create } from 'zustand';

const SESSION_KEY = 'jellyfy.session';
const DEVICE_KEY = 'jellyfy.deviceId';

type AuthState = {
  hydrated: boolean;
  session: Session | null;
  hydrating: boolean;
  loggingOut: boolean;
  hydrate: () => Promise<void>;
  connect: (serverUrl: string) => Promise<{ serverName: string; version?: string }>;
  login: (input: { serverUrl: string; username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  invalidateLocalSession: () => void;
};

async function loadDeviceId(): Promise<string> {
  const existing = await getSecret(DEVICE_KEY);
  if (existing) return existing;
  const id = await createDeviceId();
  await setSecret(DEVICE_KEY, id);
  return id;
}

export const useAuth = create<AuthState>((set, get) => ({
  hydrated: false,
  session: null,
  hydrating: false,
  loggingOut: false,

  async hydrate() {
    if (get().hydrated || get().hydrating) return;
    set({ hydrating: true });
    try {
      const raw = await getSecret(SESSION_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Session;
        if (stored?.accessToken && stored.serverUrl && stored.userId) {
          const deviceName = resolveDeviceName();
          const session =
            stored.deviceName === deviceName ? stored : { ...stored, deviceName };
          if (session !== stored) {
            await setSecret(SESSION_KEY, JSON.stringify(session));
          }
          if (session.deviceId) {
            await setSecret(DEVICE_KEY, session.deviceId);
          }
          set({ session, hydrated: true, hydrating: false });
          return;
        }
      }
      set({ session: null, hydrated: true, hydrating: false });
    } catch {
      set({ session: null, hydrated: true, hydrating: false });
    }
  },

  async connect(serverUrl) {
    const info = await fetchPublicInfo(serverUrl);
    return { serverName: info.serverName ?? 'Jellyfin', version: info.version };
  },

  async login({ serverUrl, username, password }) {
    if (!serverUrl) {
      throw new Error('Jellyfin address is empty.');
    }
    const deviceId = get().session?.deviceId || (await loadDeviceId());
    const deviceName = resolveDeviceName();
    logger.info(`signing in at ${serverUrl} as ${username}`);
    const result = await authenticateByName({
      serverUrl,
      username,
      password,
      deviceId,
      deviceName,
    });
    if (!result.accessToken || !result.user?.id) {
      throw new Error('Server did not return an access token.');
    }
    let serverName = result.user.serverName;
    if (!serverName) {
      try {
        serverName = (await fetchPublicInfo(serverUrl)).serverName;
      } catch {
        serverName = undefined;
      }
    }
    const session: Session = {
      serverUrl,
      serverName: serverName ?? 'Jellyfin',
      serverId: result.serverId,
      accessToken: result.accessToken,
      userId: result.user.id,
      userName: result.user.name ?? username,
      deviceId,
      deviceName,
    };
    await setSecret(SESSION_KEY, JSON.stringify(session));
    set({ session, hydrated: true, loggingOut: false });
  },

  invalidateLocalSession() {
    if (get().loggingOut || !get().session) return;
    set({ loggingOut: true, session: null });
    void deleteSecret(SESSION_KEY).finally(() => {
      set({ loggingOut: false });
    });
  },

  async logout() {
    if (get().loggingOut) return;
    const session = get().session;
    set({ loggingOut: true, session: null });
    if (session) {
      try {
        await createApi(session).logout();
      } catch {
        // Still clear local credentials.
      }
    }
    await deleteSecret(SESSION_KEY);
    set({ loggingOut: false });
  },
}));

export function getSession(): Session | null {
  return useAuth.getState().session;
}

setUnauthorizedHandler(() => {
  useAuth.getState().invalidateLocalSession();
});
