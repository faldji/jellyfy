import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StreamQuality } from '@/api/types';
import { DEFAULT_PLAY_ALL_LIMIT, type PlayAllLimit } from '@/lib/play-all';
import type { AccentId, ThemeId } from '@/theme/palettes';

type SettingsState = {
  quality: StreamQuality;
  themeId: ThemeId;
  accentId: AccentId;
  playAllLimit: PlayAllLimit;
  lastServerUrl: string;
  lastUsername: string;
  srEnabled: boolean;
  srBaseUrl: string;
  setQuality: (quality: StreamQuality) => void;
  setThemeId: (themeId: ThemeId) => void;
  setAccentId: (accentId: AccentId) => void;
  setPlayAllLimit: (playAllLimit: PlayAllLimit) => void;
  rememberLogin: (serverUrl: string, username: string) => void;
  setSrEnabled: (srEnabled: boolean) => void;
  setSrBaseUrl: (srBaseUrl: string) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      quality: 'high',
      themeId: 'dark',
      accentId: 'theme',
      playAllLimit: DEFAULT_PLAY_ALL_LIMIT,
      lastServerUrl: '',
      lastUsername: '',
      srEnabled: false,
      srBaseUrl: '',
      setQuality: (quality) => set({ quality }),
      setThemeId: (themeId) => set({ themeId }),
      setAccentId: (accentId) => set({ accentId }),
      setPlayAllLimit: (playAllLimit) => set({ playAllLimit }),
      rememberLogin: (serverUrl, username) => set({ lastServerUrl: serverUrl, lastUsername: username }),
      setSrEnabled: (srEnabled) => set({ srEnabled }),
      setSrBaseUrl: (srBaseUrl) => set({ srBaseUrl }),
    }),
    {
      name: 'jellyfy.settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        quality: state.quality,
        themeId: state.themeId,
        accentId: state.accentId,
        playAllLimit: state.playAllLimit,
        lastServerUrl: state.lastServerUrl,
        lastUsername: state.lastUsername,
        srEnabled: Boolean(state.srEnabled),
        srBaseUrl: state.srBaseUrl ?? '',
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          srEnabled: Boolean(saved.srEnabled),
          srBaseUrl: typeof saved.srBaseUrl === 'string' ? saved.srBaseUrl : current.srBaseUrl,
          setSrEnabled: current.setSrEnabled,
          setSrBaseUrl: current.setSrBaseUrl,
          rememberLogin: current.rememberLogin,
        };
      },
    }
  )
);
