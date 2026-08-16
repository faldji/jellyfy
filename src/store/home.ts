import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Home rails show a short shelf and a Show all when there is more. Recents is a bit longer. */
export const HOME_SECTION_META = {
  albumsYouLike: {
    label: 'Albums featuring songs you like',
    hint: 'Albums of tracks you liked',
    defaultLimit: 8,
    min: 3,
    max: 20,
  },
  recentlyAdded: {
    label: 'Recently added',
    hint: 'Newest albums in your library',
    defaultLimit: 8,
    min: 3,
    max: 20,
  },
  recents: {
    label: 'Recents',
    hint: 'What you played lately',
    defaultLimit: 10,
    min: 3,
    max: 20,
  },
  recommendedForYou: {
    label: 'Recommended for you',
    hint: 'From Smart Recommendations when the plugin is on',
    defaultLimit: 10,
    min: 4,
    max: 20,
  },
  moreLike: {
    label: 'More like…',
    hint: 'Similar to an artist you like',
    defaultLimit: 8,
    min: 3,
    max: 16,
  },
  favoriteArtists: {
    label: 'Your favorite artists',
    hint: 'Starred artists and artists from liked songs',
    defaultLimit: 8,
    min: 3,
    max: 20,
  },
  playlists: {
    label: 'Playlists',
    hint: 'Your playlists',
    defaultLimit: 8,
    min: 3,
    max: 20,
  },
} as const;

export type HomeSectionId = keyof typeof HOME_SECTION_META;

export type HomeSectionConfig = {
  id: HomeSectionId;
  visible: boolean;
  limit: number;
};

export const HOME_SECTION_ORDER: HomeSectionId[] = [
  'recommendedForYou',
  'albumsYouLike',
  'recents',
  'moreLike',
  'favoriteArtists',
  'playlists',
  'recentlyAdded',
];

export function defaultHomeLayout(): HomeSectionConfig[] {
  return HOME_SECTION_ORDER.map((id) => ({
    id,
    visible: true,
    limit: HOME_SECTION_META[id].defaultLimit,
  }));
}

export function mergeHomeLayout(saved?: HomeSectionConfig[] | null): HomeSectionConfig[] {
  const base = defaultHomeLayout();
  if (!saved?.length) return base;
  const byId = new Map(saved.filter((row) => row && HOME_SECTION_META[row.id]).map((row) => [row.id, row]));
  const used = new Set<HomeSectionId>();
  const next: HomeSectionConfig[] = [];
  for (const row of saved) {
    if (!row || !HOME_SECTION_META[row.id] || used.has(row.id)) continue;
    const meta = HOME_SECTION_META[row.id];
    next.push({
      id: row.id,
      visible: row.visible !== false,
      limit: Math.min(meta.max, Math.max(meta.min, Math.round(row.limit || meta.defaultLimit))),
    });
    used.add(row.id);
  }
  for (const row of base) {
    if (!used.has(row.id)) next.push(row);
  }
  return next;
}

type HomeState = {
  layout: HomeSectionConfig[];
  setVisible: (id: HomeSectionId, visible: boolean) => void;
  setLimit: (id: HomeSectionId, limit: number) => void;
  move: (from: number, to: number) => void;
  resetLayout: () => void;
};

export const useHomeLayout = create<HomeState>()(
  persist(
    (set, get) => ({
      layout: defaultHomeLayout(),
      setVisible(id, visible) {
        set({
          layout: get().layout.map((row) => (row.id === id ? { ...row, visible } : row)),
        });
      },
      setLimit(id, limit) {
        const meta = HOME_SECTION_META[id];
        const next = Math.min(meta.max, Math.max(meta.min, limit));
        set({
          layout: get().layout.map((row) => (row.id === id ? { ...row, limit: next } : row)),
        });
      },
      move(from, to) {
        const list = [...get().layout];
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
        const [row] = list.splice(from, 1);
        list.splice(to, 0, row);
        set({ layout: list });
      },
      resetLayout() {
        set({ layout: defaultHomeLayout() });
      },
    }),
    {
      name: 'jellyfy.home-layout',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted as { layout?: HomeSectionConfig[] } | undefined)?.layout;
        return { ...current, layout: mergeHomeLayout(saved) };
      },
    }
  )
);

export function sectionConfig(layout: HomeSectionConfig[], id: HomeSectionId): HomeSectionConfig {
  return layout.find((row) => row.id === id) ?? defaultHomeLayout().find((row) => row.id === id)!;
}
