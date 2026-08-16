import { Platform } from 'react-native';

type SkipHost = {
  userNext: () => Promise<void>;
  previous: () => Promise<void>;
};

/** Headset / OS next-prev. expo-audio maps those keys to seek when seek buttons are on; we own skip. */
export function bindMediaSessionSkip(host: SkipHost) {
  if (Platform.OS !== 'web') return;
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!session?.setActionHandler) return;
  try {
    session.setActionHandler('nexttrack', () => {
      void host.userNext();
    });
    session.setActionHandler('previoustrack', () => {
      void host.previous();
    });
  } catch {
    // Browser may reject an unsupported action.
  }
}
