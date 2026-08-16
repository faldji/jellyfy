import { describe, expect, it, vi } from 'vitest';

import type { JellyfinApi } from '@/api/jellyfin';
import { abortError } from '@/api/shared-get';
import type { ItemQuery, QueryResult } from '@/api/types';
import { fetchArtistTracks, fetchLibraryArtists } from '@/api/library';

const empty: QueryResult = { items: [], totalRecordCount: 0 };
const page = (ids: string[]): QueryResult => ({
  items: ids.map((id) => ({ id, type: 'MusicArtist' as const, name: id })),
  totalRecordCount: ids.length,
});

function mockApi(handlers: {
  albumArtists?: (query: ItemQuery) => Promise<QueryResult>;
  artists?: (query: ItemQuery) => Promise<QueryResult>;
  items?: (query: ItemQuery) => Promise<QueryResult>;
} = {}): JellyfinApi {
  return {
    albumArtists: vi.fn(handlers.albumArtists ?? (async () => empty)),
    artists: vi.fn(handlers.artists ?? (async () => empty)),
    items: vi.fn(handlers.items ?? (async () => empty)),
  } as unknown as JellyfinApi;
}

const baseQuery: ItemQuery = {
  includeItemTypes: ['MusicArtist'],
  parentId: 'music',
  recursive: true,
  sortBy: ['DatePlayed', 'SortName'],
  sortOrder: 'Descending',
  startIndex: 0,
  limit: 40,
};

describe('fetchLibraryArtists', () => {
  it('does not send includeItemTypes=MusicArtist to /Artists/AlbumArtists', async () => {
    const api = mockApi({
      albumArtists: async () => page(['a1']),
    });
    const result = await fetchLibraryArtists(api, baseQuery);
    expect(result.items?.map((item) => item.id)).toEqual(['a1']);
    expect(api.albumArtists).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(api.albumArtists).mock.calls[0]?.[0] as ItemQuery;
    expect(sent.includeItemTypes).toBeUndefined();
    expect(sent.parentId).toBe('music');
    expect(api.artists).not.toHaveBeenCalled();
    expect(api.items).not.toHaveBeenCalled();
  });

  it('falls back to /Artists when AlbumArtists is empty', async () => {
    const api = mockApi({
      artists: async () => page(['a2']),
    });
    const result = await fetchLibraryArtists(api, { ...baseQuery, sortBy: ['SortName'] });
    expect(result.items?.map((item) => item.id)).toEqual(['a2']);
    expect(api.albumArtists).toHaveBeenCalledTimes(1);
    expect(api.artists).toHaveBeenCalledTimes(1);
  });

  it('retries AlbumArtists without DatePlayed before other endpoints', async () => {
    const api = mockApi({
      albumArtists: async (query) =>
        query.sortBy?.includes('DatePlayed') ? empty : page(['recent-empty', 'alpha']),
    });
    const result = await fetchLibraryArtists(api, baseQuery);
    expect(result.items?.map((item) => item.id)).toEqual(['recent-empty', 'alpha']);
    expect(api.albumArtists).toHaveBeenCalledTimes(2);
    const second = vi.mocked(api.albumArtists).mock.calls[1]?.[0] as ItemQuery;
    expect(second.sortBy).toEqual(['SortName']);
    expect(api.artists).not.toHaveBeenCalled();
  });

  it('does not fall back on later pages', async () => {
    const api = mockApi();
    const result = await fetchLibraryArtists(api, { ...baseQuery, startIndex: 40 });
    expect(result).toEqual(empty);
    expect(api.albumArtists).toHaveBeenCalledTimes(1);
    expect(api.artists).not.toHaveBeenCalled();
    expect(api.items).not.toHaveBeenCalled();
  });

  it('loads liked artists from /Items MusicArtist, not AlbumArtists', async () => {
    const api = mockApi({
      items: async () => page(['liked']),
    });
    const result = await fetchLibraryArtists(api, { ...baseQuery, filters: ['IsFavorite'] });
    expect(result.items?.map((item) => item.id)).toEqual(['liked']);
    expect(api.albumArtists).not.toHaveBeenCalled();
    const sent = vi.mocked(api.items).mock.calls[0]?.[0] as ItemQuery;
    expect(sent.includeItemTypes).toEqual(['MusicArtist']);
    expect(sent.filters).toEqual(['IsFavorite']);
  });

  it('drops parentId when scoped MusicArtist items are empty', async () => {
    const api = mockApi({
      items: async (query) => (query.parentId ? empty : page(['unscoped'])),
    });
    const result = await fetchLibraryArtists(api, { ...baseQuery, sortBy: ['SortName'] });
    expect(result.items?.map((item) => item.id)).toEqual(['unscoped']);
    expect(api.items).toHaveBeenCalledTimes(2);
    const last = vi.mocked(api.items).mock.calls[1]?.[0] as ItemQuery;
    expect(last.parentId).toBeUndefined();
    expect(last.includeItemTypes).toEqual(['MusicArtist']);
  });

  it('rethrows abort without falling back', async () => {
    const api = mockApi({
      albumArtists: async () => {
        throw abortError();
      },
    });
    await expect(fetchLibraryArtists(api, baseQuery)).rejects.toMatchObject({ name: 'AbortError' });
    expect(api.artists).not.toHaveBeenCalled();
  });
});

describe('fetchArtistTracks', () => {
  it('does not query the whole library when the artist id is missing', async () => {
    const api = mockApi();
    await expect(fetchArtistTracks(api, '', 50)).resolves.toEqual([]);
    expect(api.items).not.toHaveBeenCalled();
  });

  it('asks albumArtistIds first so a library artist play is not every track', async () => {
    const api = mockApi({
      items: async (query) =>
        query.albumArtistIds?.length
          ? {
              items: [{ id: 't1', type: 'Audio', mediaType: 'Audio', name: 'One' }],
              totalRecordCount: 1,
            }
          : {
              items: [
                { id: 't1', type: 'Audio', mediaType: 'Audio', name: 'One' },
                { id: 't2', type: 'Audio', mediaType: 'Audio', name: 'Two' },
              ],
              totalRecordCount: 2,
            },
    });
    const tracks = await fetchArtistTracks(api, 'artist-1', 50);
    expect(tracks.map((item) => item.id)).toEqual(['t1']);
    expect(api.items).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(api.items).mock.calls[0]?.[0] as ItemQuery;
    expect(sent.albumArtistIds).toEqual(['artist-1']);
  });
});
