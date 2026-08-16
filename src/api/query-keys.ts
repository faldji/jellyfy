import type { QueryClient } from '@tanstack/react-query';

import type { ItemQuery } from '@/api/types';

/**
 * TanStack Query keys. Prefix-invalidate with the `all` tuples.
 * `['items']` does not match `['items-infinite', …]` - invalidate both.
 */
export const queryKeys = {
  items: {
    all: ['items'] as const,
    list: (userId: string | undefined, key: unknown[], query: ItemQuery) =>
      ['items', userId, ...key, query] as const,
  },
  itemsInfinite: {
    all: ['items-infinite'] as const,
    list: (
      userId: string | undefined,
      source: string,
      key: unknown[],
      query: unknown,
      pageSize: number
    ) => ['items-infinite', userId, source, ...key, query, pageSize] as const,
  },
  item: {
    all: ['item'] as const,
    detail: (userId: string | undefined, id: string | undefined) => ['item', userId, id] as const,
  },
  latest: {
    all: ['latest'] as const,
    list: (userId: string | undefined, query: ItemQuery) => ['latest', userId, query] as const,
  },
  mix: {
    all: ['mix'] as const,
    radio: (
      userId: string | undefined,
      id: string | undefined,
      backend: 'sr' | 'jellyfin',
      seedType?: string
    ) => ['mix', userId, id, backend, seedType] as const,
  },
  srHome: {
    all: ['sr-home'] as const,
    list: (userId: string | undefined, limit: number) => ['sr-home', userId, limit] as const,
  },
  fansAlsoLike: {
    all: ['fans-also-like'] as const,
    detail: (userId: string | undefined, artistId: string | undefined) =>
      ['fans-also-like', userId, artistId] as const,
  },
  similar: {
    all: ['similar'] as const,
    detail: (userId: string | undefined, id: string | undefined, limit: number) =>
      ['similar', userId, id, limit] as const,
  },
  lyrics: {
    all: ['lyrics'] as const,
    detail: (id: string | undefined) => ['lyrics', id] as const,
  },
  playlistItems: {
    all: ['playlist-items'] as const,
    detail: (userId: string | undefined, id: string | undefined) =>
      ['playlist-items', userId, id] as const,
  },
  albumTracks: {
    all: ['album-tracks'] as const,
    detail: (userId: string | undefined, id: string | undefined) =>
      ['album-tracks', userId, id] as const,
  },
  artistTracks: {
    all: ['artist-tracks'] as const,
    detail: (userId: string | undefined, id: string | undefined) =>
      ['artist-tracks', userId, id] as const,
  },
  searchAll: {
    all: ['search-all'] as const,
    detail: (userId: string | undefined, term: string) => ['search-all', userId, term] as const,
  },
  userViews: {
    all: ['user-views'] as const,
    detail: (userId: string | undefined) => ['user-views', userId] as const,
  },
};

/** Labels that exist only as favorite-filtered lists. Exact match, not a substring. */
export const FAVORITE_LIST_LABELS = new Set(['home-liked-songs', 'home-liked-albums', 'home-liked-artists', 'likes']);

function isFavoriteFilterObject(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const filters = (value as { filters?: unknown }).filters;
  return Array.isArray(filters) && filters.includes('IsFavorite');
}

/** True only for queries that explicitly represent favorite-filtered data. */
export function isFavoriteListQuery(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  if (root !== 'items' && root !== 'items-infinite') return false;
  for (const entry of queryKey) {
    if (typeof entry === 'string' && FAVORITE_LIST_LABELS.has(entry)) return true;
    if (isFavoriteFilterObject(entry)) return true;
  }
  return false;
}

/** After like/unlike: only refetch lists that filter on favorites. */
export function invalidateAfterFavorite(client: QueryClient) {
  for (const query of client.getQueryCache().getAll()) {
    if (!isFavoriteListQuery(query.queryKey)) continue;
    void client.invalidateQueries({ queryKey: query.queryKey });
  }
}

/** Library-shaped caches after a mutation. `stale` marks dirty without a refetch burst. */
export function invalidateLibraryQueries(client: QueryClient, mode: 'refetch' | 'stale' = 'refetch') {
  const refetchType = mode === 'stale' ? 'none' : 'active';
  const keys = [
    queryKeys.items.all,
    queryKeys.itemsInfinite.all,
    queryKeys.item.all,
    queryKeys.latest.all,
    queryKeys.playlistItems.all,
    queryKeys.albumTracks.all,
    queryKeys.artistTracks.all,
    queryKeys.fansAlsoLike.all,
    queryKeys.similar.all,
    queryKeys.srHome.all,
    queryKeys.mix.all,
    queryKeys.searchAll.all,
  ];
  for (const queryKey of keys) {
    void client.invalidateQueries({ queryKey, refetchType });
  }
}
