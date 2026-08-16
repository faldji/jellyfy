import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createApi } from '@/api/jellyfin';
import {
  fetchAlbumTracks,
  fetchArtistTracks,
  fetchLibraryArtists,
  fetchPlaylistTracks,
  fetchSearchAll,
} from '@/api/library';
import { queryClient } from '@/api/query';
import { invalidateAfterFavorite, invalidateLibraryQueries, queryKeys } from '@/api/query-keys';
import { fetchSrHome, fetchSrRadio, hydrateSrTracks, isSrEnabled, postSrEventSafe, selectSrEnabled } from '@/api/sr';
import type { BaseItem, ItemQuery, QueryResult } from '@/api/types';
import { rankFansAlsoLike } from '@/lib/fans-also-like';
import { normId, sameId } from '@/lib/ids';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useRecents } from '@/store/recents';
import { useSettings } from '@/store/settings';
import { useToast } from '@/store/toast';

export function useApi() {
  const session = useAuth((s) => s.session);
  if (!session) return null;
  return createApi(session);
}

export function useMusicParent() {
  return useLibrary((s) => s.musicViewId);
}

export function useItems(
  key: unknown[],
  query: ItemQuery,
  enabled = true,
  extra?: { staleTime?: number }
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.items.list(api?.session.userId, key, query),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Not signed in');
      return api.items(query, { signal });
    },
    enabled: Boolean(api) && enabled,
    staleTime: extra?.staleTime,
  });
}

const DEFAULT_PAGE = 40;

export type InfiniteSource = 'items' | 'albumArtists' | 'artists';

export function useInfiniteItems(
  key: unknown[],
  query: Omit<ItemQuery, 'startIndex' | 'limit'>,
  options: { enabled?: boolean; pageSize?: number; source?: InfiniteSource } = {}
) {
  const api = useApi();
  const pageSize = options.pageSize ?? DEFAULT_PAGE;
  const source = options.source ?? 'items';
  const enabled = options.enabled ?? true;
  return useInfiniteQuery({
    queryKey: queryKeys.itemsInfinite.list(api?.session.userId, source, key, query, pageSize),
    enabled: Boolean(api) && enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      if (!api) throw new Error('Not signed in');
      const pageQuery = { ...query, startIndex: pageParam, limit: pageSize, enableTotalRecordCount: true };
      if (source === 'albumArtists') return fetchLibraryArtists(api, pageQuery, { signal });
      if (source === 'artists') return api.artists(pageQuery, { signal });
      return api.items(pageQuery, { signal });
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, page) => n + (page.items?.length ?? 0), 0);
      const total = last.totalRecordCount ?? loaded;
      if (loaded >= total) return undefined;
      if ((last.items?.length ?? 0) < pageSize) return undefined;
      return loaded;
    },
  });
}

export function useItem(id?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.item.detail(api?.session.userId, id),
    queryFn: async ({ signal }) => {
      if (!api || !id) throw new Error('Missing item');
      return api.item(id, { signal });
    },
    enabled: Boolean(api && id),
  });
}

export function useLatest(query: ItemQuery, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.latest.list(api?.session.userId, query),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Not signed in');
      return api.latest(query, { signal });
    },
    enabled: Boolean(api) && enabled,
  });
}

export function useAlbumTracks(id?: string, limit = 500) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.albumTracks.detail(api?.session.userId, id),
    queryFn: async ({ signal }) => {
      if (!api || !id) throw new Error('Missing album');
      return fetchAlbumTracks(api, id, limit, { signal });
    },
    enabled: Boolean(api && id),
    staleTime: 5 * 60_000,
  });
}

export function useArtistTracks(id?: string, limit = 200) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.artistTracks.detail(api?.session.userId, id),
    queryFn: async ({ signal }) => {
      if (!api || !id) throw new Error('Missing artist');
      return fetchArtistTracks(api, id, limit, { signal });
    },
    enabled: Boolean(api && id),
    staleTime: 5 * 60_000,
  });
}

export function useSearchAll(term: string, enabled = true) {
  const api = useApi();
  const parentId = useMusicParent();
  return useQuery({
    queryKey: queryKeys.searchAll.detail(api?.session.userId, term),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Not signed in');
      return fetchSearchAll(api, term, musicScope(parentId), { signal });
    },
    enabled: Boolean(api) && enabled && term.length >= 2,
    staleTime: 20_000,
  });
}

export function useRadioMix(id?: string) {
  const api = useApi();
  const seed = useItem(id);
  const srOn = useSettings(selectSrEnabled);
  return useQuery({
    queryKey: queryKeys.mix.radio(api?.session.userId, id, srOn ? 'sr' : 'jellyfin', seed.data?.type),
    enabled: Boolean(api && id && (!srOn || seed.data || seed.isError)),
    queryFn: async ({ signal }): Promise<QueryResult> => {
      if (!api || !id) throw new Error('Missing item');
      if (srOn && isSrEnabled() && seed.data) {
        try {
          const kind =
            seed.data.type === 'MusicArtist' ? 'artist' : seed.data.type === 'MusicAlbum' ? 'album' : 'track';
          const payload = await fetchSrRadio(kind, id, 40);
          const items = await hydrateSrTracks(api.session, payload);
          if (items.length) {
            return { items, totalRecordCount: items.length };
          }
        } catch {
          // Fall through to Jellyfin InstantMix.
        }
      }
      return api.instantMix(id, 50, { signal });
    },
  });
}

export function useSrHomeTracks(limit: number, enabled = true) {
  const api = useApi();
  const srOn = useSettings(selectSrEnabled);
  return useQuery({
    queryKey: queryKeys.srHome.list(api?.session.userId, limit),
    enabled: Boolean(api && srOn && enabled),
    staleTime: 60_000,
    queryFn: async () => {
      if (!api) throw new Error('Not signed in');
      const payload = await fetchSrHome(limit);
      return hydrateSrTracks(api.session, payload);
    },
  });
}

export function useFansAlsoLike(artistId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.fansAlsoLike.detail(api?.session.userId, artistId),
    enabled: Boolean(api && artistId),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!api || !artistId) throw new Error('Missing artist');
      const recents = useRecents.getState().items;
      const seed =
        queryClient.getQueryData<BaseItem>(queryKeys.item.detail(api.session.userId, artistId)) ??
        (await api.item(artistId, { signal }));
      let similar: BaseItem[] = [];
      try {
        similar = (await api.similarArtists(artistId, 12, { signal })).items ?? [];
      } catch {
        similar = (await api.similar(artistId, 12, { signal })).items ?? [];
      }
      similar = similar.filter((item) => item.type === 'MusicArtist' || !item.type);

      const catalog = new Map<string, BaseItem>();
      catalog.set(normId(seed.id), seed);
      for (const item of similar) catalog.set(normId(item.id), item);

      const collab = new Map<string, number>();
      const bump = (id?: string, weight = 1) => {
        if (!id || sameId(id, artistId)) return;
        const key = normId(id);
        collab.set(key, (collab.get(key) ?? 0) + weight);
      };

      const myArtists = await api.items(
        {
          includeItemTypes: ['MusicArtist'],
          filters: ['IsFavorite'],
          limit: 40,
        },
        { signal }
      );
      for (const item of myArtists.items ?? []) {
        catalog.set(normId(item.id), item);
        bump(item.id, 1);
      }
      for (const recent of recents) {
        if (recent.type === 'MusicArtist') bump(recent.id, 0.35);
        for (const entry of recent.albumArtists ?? []) bump(entry.id, 0.2);
      }

      const missing = [...collab.keys()].filter((id) => !catalog.has(id));
      if (missing.length) {
        const found = await api.items(
          {
            ids: missing,
            includeItemTypes: ['MusicArtist'],
            limit: missing.length,
          },
          { signal }
        );
        for (const item of found.items ?? []) catalog.set(normId(item.id), item);
      }

      return rankFansAlsoLike({
        seedId: artistId,
        seedGenres: seed.genres,
        similar,
        collab,
        catalog,
        limit: 5,
      });
    },
  });
}

export function useSimilar(id?: string, limit = 12) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.similar.detail(api?.session.userId, id, limit),
    queryFn: async ({ signal }) => {
      if (!api || !id) throw new Error('Missing item');
      return api.similar(id, limit, { signal });
    },
    enabled: Boolean(api && id),
  });
}

export function useLyrics(id?: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.lyrics.detail(id),
    queryFn: async () => {
      if (!api || !id) throw new Error('Missing item');
      return api.lyrics(id);
    },
    enabled: Boolean(api && id && enabled),
    retry: false,
    staleTime: 60_000,
    placeholderData: undefined,
  });
}

export function usePlaylistItems(id?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.playlistItems.detail(api?.session.userId, id),
    queryFn: async ({ signal }) => {
      if (!api || !id) throw new Error('Missing playlist');
      return fetchPlaylistTracks(api, id, 2000, { signal });
    },
    enabled: Boolean(api && id),
  });
}

export function useRemoveFromPlaylist() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async ({ playlistId, entryIds }: { playlistId: string; entryIds: string[] }) => {
      if (!api) throw new Error('Not signed in');
      await api.removeFromPlaylist(playlistId, entryIds);
      return { playlistId };
    },
    onSuccess: () => {
      invalidateLibraryQueries(client);
      toast('Removed from playlist');
    },
    onError: (error: Error) => toast(error.message),
  });
}

function applyFavorite(node: unknown, itemId: string, favorite: boolean): unknown {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((entry) => {
      const patched = applyFavorite(entry, itemId, favorite);
      if (patched !== entry) changed = true;
      return patched;
    });
    return changed ? next : node;
  }
  const rec = node as Record<string, unknown>;
  let next: Record<string, unknown> | null = null;
  if (typeof rec.id === 'string' && sameId(rec.id, itemId)) {
    const userData =
      rec.userData && typeof rec.userData === 'object'
        ? (rec.userData as Record<string, unknown>)
        : { key: itemId };
    next = { ...rec, userData: { ...userData, isFavorite: favorite } };
  }
  for (const [key, value] of Object.entries(rec)) {
    if (key === 'userData') continue;
    const patched = applyFavorite(value, itemId, favorite);
    if (patched !== value) {
      if (!next) next = { ...rec };
      next[key] = patched;
    }
  }
  return next ?? node;
}

export function useFavoriteMutation() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async ({ item, favorite }: { item: BaseItem; favorite: boolean }) => {
      if (!api) throw new Error('Not signed in');
      await api.setFavorite(item.id, favorite);
      return { item, favorite };
    },
    onMutate: async ({ item, favorite }) => {
      const snapshots = client.getQueryCache().getAll().map((query) => [query.queryKey, query.state.data] as const);
      const previousRecents = useRecents.getState().items;
      for (const query of client.getQueryCache().getAll()) {
        if (query.state.data === undefined) continue;
        client.setQueryData(query.queryKey, applyFavorite(query.state.data, item.id, favorite));
      }
      usePlayer.getState().updateItem({
        ...item,
        userData: { ...(item.userData ?? { key: item.id }), isFavorite: favorite },
      });
      useRecents.getState().patchFavorite(item.id, favorite);
      return { snapshots, previousRecents };
    },
    onError: (error: Error, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => client.setQueryData(key, data));
      if (ctx?.previousRecents) useRecents.setState({ items: ctx.previousRecents });
      toast(error.message);
    },
    onSuccess: ({ item, favorite }) => {
      usePlayer.getState().updateItem({
        ...item,
        userData: { ...(item.userData ?? { key: item.id }), isFavorite: favorite },
      });
      invalidateAfterFavorite(client);
      const liked =
        item.type === 'MusicArtist'
          ? favorite
            ? 'Following'
            : 'Unfollowed'
          : item.type === 'MusicAlbum'
            ? favorite
              ? 'Liked album'
              : 'Removed album like'
            : favorite
              ? 'Added to Liked Songs'
              : 'Removed from Liked Songs';
      toast(liked);
      if (item.type === 'Audio') {
        postSrEventSafe({ eventType: favorite ? 'FAVORITE' : 'UNFAVORITE', trackId: item.id });
      }
    },
  });
}

export function useCreatePlaylist() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async ({ name, ids }: { name: string; ids?: string[] }) => {
      if (!api) throw new Error('Not signed in');
      return api.createPlaylist(name, ids ?? []);
    },
    onSuccess: () => {
      invalidateLibraryQueries(client);
      toast('Playlist created');
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function useRenamePlaylist() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async ({ playlistId, name, ids }: { playlistId: string; name: string; ids?: string[] }) => {
      if (!api) throw new Error('Not signed in');
      await api.renamePlaylist(playlistId, name, ids);
      return { playlistId, name };
    },
    onSuccess: () => {
      void client.invalidateQueries();
      toast('Playlist renamed');
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function useDeletePlaylist() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async (playlistId: string) => {
      if (!api) throw new Error('Not signed in');
      await api.deleteItem(playlistId);
      return playlistId;
    },
    onSuccess: () => {
      void client.invalidateQueries();
      toast('Playlist deleted');
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function useAddToPlaylist() {
  const api = useApi();
  const client = useQueryClient();
  const toast = useToast((s) => s.show);
  return useMutation({
    mutationFn: async ({ playlistId, ids }: { playlistId: string; ids: string[] }) => {
      if (!api) throw new Error('Not signed in');
      await api.addToPlaylist(playlistId, ids);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      toast('Added to playlist');
    },
    onError: (error: Error) => toast(error.message),
  });
}

export function musicScope(parentId: string | null): Pick<ItemQuery, 'parentId' | 'recursive'> {
  if (parentId) return { parentId, recursive: true };
  return { recursive: true };
}
