import type { JellyfinApi } from '@/api/jellyfin';
import { isAbortError } from '@/api/shared-get';
import type { BaseItem, ItemQuery, QueryResult } from '@/api/types';
import { logger } from '@/lib/logger';
import { isAudio } from '@/lib/media';



export type SignalOpts = { signal?: AbortSignal };

function hasRows(result: QueryResult): boolean {
  return (result.items?.length ?? 0) > 0 || (result.totalRecordCount ?? 0) > 0;
}

/** /Artists and /Artists/AlbumArtists apply includeItemTypes to the source albums, not the returned people. */
function withoutItemTypes(query: ItemQuery): ItemQuery {
  const { includeItemTypes: _drop, ...rest } = query;
  return rest;
}

function withoutDatePlayed(query: ItemQuery): ItemQuery {
  const sortBy = (query.sortBy ?? []).filter((key) => key !== 'DatePlayed');
  return {
    ...query,
    sortBy: sortBy.length ? sortBy : ['SortName'],
    sortOrder: sortBy.length ? query.sortOrder : 'Ascending',
  };
}

async function tryQuery(
  run: () => Promise<QueryResult>,
  signal?: AbortSignal
): Promise<QueryResult | null> {
  try {
    return await run();
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    logger.debug('Artist list endpoint failed, trying fallback', { error });
    return null;
  }
}

/**
 * Library Artists tab. Live Jellyfin returns [] for
 * GET /Artists/AlbumArtists?includeItemTypes=MusicArtist because that filter
 * is applied to albums (none are MusicArtist). Same for DatePlayed on some 10.11/10.12 servers.
 */
export async function fetchLibraryArtists(
  api: JellyfinApi,
  query: ItemQuery,
  opts?: SignalOpts
): Promise<QueryResult> {
  const start = query.startIndex ?? 0;
  const liked = Boolean(query.isFavorite) || Boolean(query.filters?.includes('IsFavorite'));

  if (liked) {
    const scoped = await tryQuery(
      () => api.items({ ...query, includeItemTypes: ['MusicArtist'], recursive: true }, opts),
      opts?.signal
    );
    if (scoped && (hasRows(scoped) || start > 0)) return scoped;
    const { parentId: _parent, ...unscoped } = query;
    return api.items({ ...unscoped, includeItemTypes: ['MusicArtist'], recursive: true }, opts);
  }

  const listQuery = withoutItemTypes(query);
  const albumArtists = await tryQuery(() => api.albumArtists(listQuery, opts), opts?.signal);
  if (albumArtists && (hasRows(albumArtists) || start > 0)) return albumArtists;

  if (listQuery.sortBy?.includes('DatePlayed')) {
    const resorted = await tryQuery(
      () => api.albumArtists(withoutDatePlayed(listQuery), opts),
      opts?.signal
    );
    if (resorted && hasRows(resorted)) {
      logger.debug('Album artists empty with DatePlayed, using SortName');
      return resorted;
    }
  }

  const artists = await tryQuery(() => api.artists(listQuery, opts), opts?.signal);
  if (artists && hasRows(artists)) {
    logger.debug('Album artists empty, using /Artists');
    return artists;
  }

  const scopedItems = await tryQuery(
    () => api.items({ ...query, includeItemTypes: ['MusicArtist'], recursive: true }, opts),
    opts?.signal
  );
  if (scopedItems && hasRows(scopedItems)) {
    logger.debug('Artist endpoints empty, using /Items MusicArtist');
    return scopedItems;
  }

  const { parentId: _parent, ...unscoped } = query;
  return api.items({ ...unscoped, includeItemTypes: ['MusicArtist'], recursive: true }, opts);
}

export async function fetchAlbumTrackPage(
  api: JellyfinApi,
  albumId: string,
  startIndex: number,
  limit: number,
  opts?: SignalOpts
): Promise<QueryResult> {
  const sort: ItemQuery = {
    includeItemTypes: ['Audio'],
    enableTotalRecordCount: true,
    sortBy: ['ParentIndexNumber', 'IndexNumber'],
    sortOrder: 'Ascending',
    startIndex,
    limit,
  };
  const byParent = await api.items({ ...sort, parentId: albumId }, opts);
  const parentItems = (byParent.items ?? []).filter(isAudio);
  if (parentItems.length || startIndex > 0 || (byParent.totalRecordCount ?? 0) > 0) {
    return { ...byParent, items: parentItems };
  }
  const byAlbum = await api.items({ ...sort, albumIds: [albumId], recursive: true }, opts);
  return { ...byAlbum, items: (byAlbum.items ?? []).filter(isAudio) };
}

export async function fetchAlbumTracks(
  api: JellyfinApi,
  albumId: string,
  limit: number,
  opts?: SignalOpts
): Promise<BaseItem[]> {
  const page = await fetchAlbumTrackPage(api, albumId, 0, limit, opts);
  return (page.items ?? []).slice(0, limit);
}

export async function fetchArtistTrackPage(
  api: JellyfinApi,
  artistId: string,
  startIndex: number,
  limit: number,
  opts?: SignalOpts
): Promise<QueryResult> {
  if (!artistId) return { items: [], totalRecordCount: 0 };
  const sort: ItemQuery = {
    includeItemTypes: ['Audio'],
    enableTotalRecordCount: true,
    recursive: true,
    sortBy: ['PlayCount', 'SortName'],
    sortOrder: 'Descending',
    startIndex,
    limit,
  };
  const byAlbumArtist = await api.items({ ...sort, albumArtistIds: [artistId] }, opts);
  const albumArtistItems = (byAlbumArtist.items ?? []).filter(isAudio);
  if (albumArtistItems.length || startIndex > 0 || (byAlbumArtist.totalRecordCount ?? 0) > 0) {
    return { ...byAlbumArtist, items: albumArtistItems };
  }
  const byArtist = await api.items({ ...sort, artistIds: [artistId] }, opts);
  return { ...byArtist, items: (byArtist.items ?? []).filter(isAudio) };
}

export async function fetchArtistTracks(
  api: JellyfinApi,
  artistId: string,
  limit: number,
  opts?: SignalOpts
): Promise<BaseItem[]> {
  const page = await fetchArtistTrackPage(api, artistId, 0, limit, opts);
  return (page.items ?? []).slice(0, limit);
}

export async function fetchPlaylistTrackPage(
  api: JellyfinApi,
  playlistId: string,
  startIndex: number,
  limit: number,
  opts?: SignalOpts
): Promise<QueryResult> {
  const result = await api.playlistItems(
    playlistId,
    { limit, startIndex, enableTotalRecordCount: true },
    opts
  );
  return { ...result, items: (result.items ?? []).filter(isAudio) };
}

export async function fetchPlaylistTracks(
  api: JellyfinApi,
  playlistId: string,
  limit: number,
  opts?: SignalOpts
): Promise<BaseItem[]> {
  const page = await fetchPlaylistTrackPage(api, playlistId, 0, limit, opts);
  return (page.items ?? []).slice(0, limit);
}

export const SEARCH_ALL_TYPES = ['Audio', 'MusicArtist', 'MusicAlbum', 'Playlist', 'MusicGenre'] as const;

export async function fetchSearchAll(
  api: JellyfinApi,
  searchTerm: string,
  scope: Pick<ItemQuery, 'parentId' | 'recursive'>,
  opts?: SignalOpts
): Promise<QueryResult> {
  return api.items(
    {
      searchTerm,
      includeItemTypes: [...SEARCH_ALL_TYPES],
      sortBy: ['SortName'],
      limit: 40,
      ...scope,
    },
    opts
  );
}
