import { Platform } from 'react-native';

type SkipHost = {
  userNext: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  togglePlay: () => Promise<void>;
};

/**
 * Browser MediaSession integration. Android native controls are provided by
 * expo-audio's MediaSession service; this module owns the web implementation.
 */
export function bindMediaSessionSkip(host: SkipHost) {
  if (Platform.OS !== 'web') return;
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session?.setActionHandler) return;
  try {
    session.setActionHandler('play', () => {
      void host.togglePlay();
    });
    session.setActionHandler('pause', () => {
      void host.togglePlay();
    });
    session.setActionHandler('nexttrack', () => {
      void host.userNext();
    });
    session.setActionHandler('previoustrack', () => {
      void host.previous();
    });
    session.setActionHandler('seekbackward', (details) => {
      void host.seek(Math.max(0, details.seekOffset ? -details.seekOffset : -10));
    });
    session.setActionHandler('seekforward', (details) => {
      void host.seek(details.seekOffset ?? 10);
    });
  } catch {
    // Browser may reject individual unsupported actions.
  }
}
