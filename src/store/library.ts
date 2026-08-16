import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LibraryTab = 'all' | 'playlists' | 'albums' | 'artists' | 'tracks';
export type LibrarySort = 'recents' | 'added' | 'alpha' | 'artist';
export type LibraryLayout = 'list' | 'grid';

type LibraryState = {
  musicViewId: string | null;
  tab: LibraryTab;
  sort: LibrarySort;
  layout: LibraryLayout;
  likedOnly: boolean;
  setMusicViewId: (id: string | null) => void;
  setTab: (tab: LibraryTab) => void;
  setSort: (sort: LibrarySort) => void;
  setLayout: (layout: LibraryLayout) => void;
  setLikedOnly: (likedOnly: boolean) => void;
};

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      musicViewId: null,
      tab: 'all',
      sort: 'recents',
      layout: 'list',
      likedOnly: false,
      setMusicViewId: (id) => set({ musicViewId: id }),
      setTab: (tab) => set({ tab }),
      setSort: (sort) => set({ sort }),
      setLayout: (layout) => set({ layout }),
      setLikedOnly: (likedOnly) => set({ likedOnly }),
    }),
    {
      name: 'jellyfy.library-ui',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tab: state.tab,
        sort: state.sort,
        layout: state.layout,
        likedOnly: state.likedOnly,
      }),
    }
  )
);
