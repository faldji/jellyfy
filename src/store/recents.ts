import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BaseItem } from '@/api/types';
import { sameId } from '@/lib/ids';

const MAX = 40;
const MAX_QUERIES = 8;

export type RecentItem = Pick<
  BaseItem,
  | 'id'
  | 'name'
  | 'type'
  | 'album'
  | 'albumId'
  | 'artists'
  | 'albumArtist'
  | 'albumArtists'
  | 'imageTags'
  | 'albumPrimaryImageTag'
  | 'productionYear'
  | 'runTimeTicks'
  | 'userData'
>;

type RecentsBucket = {
  items: RecentItem[];
  queries: string[];
};

type RecentsState = {
  owner: string | null;
  items: RecentItem[];
  queries: string[];
  buckets: Record<string, RecentsBucket>;
  adopt: (owner: string) => void;
  touch: (item: BaseItem) => void;
  patchFavorite: (itemId: string, favorite: boolean) => void;
  touchQuery: (term: string) => void;
  removeQuery: (term: string) => void;
  clear: () => void;
};

function snapshotItem(item: BaseItem): RecentItem {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    album: item.album,
    albumId: item.albumId,
    artists: item.artists,
    albumArtist: item.albumArtist,
    albumArtists: item.albumArtists,
    imageTags: item.imageTags,
    albumPrimaryImageTag: item.albumPrimaryImageTag,
    productionYear: item.productionYear,
    runTimeTicks: item.runTimeTicks,
    userData: item.userData
      ? { key: item.userData.key ?? item.id, isFavorite: Boolean(item.userData.isFavorite) }
      : undefined,
  };
}

export const useRecents = create<RecentsState>()(
  persist(
    (set, get) => ({
      owner: null,
      items: [],
      queries: [],
      buckets: {},
      adopt(owner) {
        const state = get();
        if (state.owner === owner) return;
        const buckets = { ...state.buckets };
        if (state.owner) {
          buckets[state.owner] = { items: state.items, queries: state.queries };
        } else if (state.items.length || state.queries.length) {
          buckets[owner] = { items: state.items, queries: state.queries };
        }
        const next = buckets[owner] ?? { items: [], queries: [] };
        set({ owner, items: next.items, queries: next.queries, buckets });
      },
      touch(item) {
        const snapshot = snapshotItem(item);
        const rest = get().items.filter((entry) => !sameId(entry.id, item.id));
        set({ items: [snapshot, ...rest].slice(0, MAX) });
      },
      patchFavorite(itemId, favorite) {
        const items = get().items.map((entry) =>
          sameId(entry.id, itemId)
            ? {
                ...entry,
                userData: { key: entry.userData?.key ?? entry.id, ...entry.userData, isFavorite: favorite },
              }
            : entry
        );
        set({ items });
      },
      touchQuery(term) {
        const q = term.trim();
        if (q.length < 2) return;
        const rest = get().queries.filter((entry) => entry.toLowerCase() !== q.toLowerCase());
        set({ queries: [q, ...rest].slice(0, MAX_QUERIES) });
      },
      removeQuery(term) {
        set({ queries: get().queries.filter((entry) => entry !== term) });
      },
      clear() {
        set({ items: [], queries: [] });
      },
    }),
    {
      name: 'jellyfy.recents',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        owner: state.owner,
        items: state.items,
        queries: state.queries,
        buckets: state.buckets,
      }),
    }
  )
);
