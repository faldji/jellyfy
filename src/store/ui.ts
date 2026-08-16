import { create } from 'zustand';

import type { AppTabKey } from '@/lib/chrome';

type UiState = {
  createOpen: boolean;
  createPlaylistOpen: boolean;
  lastTab: AppTabKey;
  openCreate: () => void;
  closeCreate: () => void;
  toggleCreate: () => void;
  openCreatePlaylist: () => void;
  closeCreatePlaylist: () => void;
  setLastTab: (lastTab: AppTabKey) => void;
};

export const useUi = create<UiState>((set) => ({
  createOpen: false,
  createPlaylistOpen: false,
  lastTab: 'index',
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
  toggleCreate: () => set((s) => ({ createOpen: !s.createOpen })),
  openCreatePlaylist: () => set({ createOpen: false, createPlaylistOpen: true }),
  closeCreatePlaylist: () => set({ createPlaylistOpen: false }),
  setLastTab: (lastTab) => set({ lastTab }),
}));
