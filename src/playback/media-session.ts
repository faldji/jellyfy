import { Platform } from 'react-native';

type TransportHost = {
  userNext: () => Promise<void>;
  previous: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekFromPlayerClock: (mediaSeconds: number) => Promise<void>;
};

/**
 * Browser media-session transport.
 * expo-audio maps next and previous to a 10 second seek when those buttons are on,
 * and it seeks the element directly. These handlers run after that and own the
 * actions, so Jellyfin and SR see the same events as the in-app controls.
 */
export function bindMediaSessionTransport(host: TransportHost) {
  if (Platform.OS !== 'web') return;
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session?.setActionHandler) return;
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Browser may reject an unsupported action.
    }
  };
  set('nexttrack', () => {
    void host.userNext();
  });
  set('previoustrack', () => {
    void host.previous();
  });
  set('play', () => {
    void host.resume();
  });
  set('pause', () => {
    void host.pause();
  });
  set('seekto', (details) => {
    if (details.seekTime == null || !Number.isFinite(details.seekTime)) return;
    void host.seekFromPlayerClock(details.seekTime);
  });
  set('seekforward', null);
  set('seekbackward', null);
}
