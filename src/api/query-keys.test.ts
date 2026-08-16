import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { invalidateAfterFavorite, isFavoriteListQuery, queryKeys } from '@/api/query-keys';

describe('isFavoriteListQuery', () => {
  it('matches only explicit favorite lists and IsFavorite filters', () => {
    expect(isFavoriteListQuery(queryKeys.items.list('u', ['home-liked-songs'], { filters: ['IsFavorite'] }))).toBe(
      true
    );
    expect(isFavoriteListQuery(queryKeys.items.list('u', ['home-liked-albums'], { filters: ['IsFavorite'] }))).toBe(
      true
    );
    expect(isFavoriteListQuery(queryKeys.items.list('u', ['home-liked-artists'], { filters: ['IsFavorite'] }))).toBe(
      true
    );
    expect(
      isFavoriteListQuery(['items-infinite', 'u', 'items', 'likes', { filters: ['IsFavorite'] }])
    ).toBe(true);
    expect(
      isFavoriteListQuery(['items-infinite', 'u', 'items', ['library', 'albums'], { filters: ['IsFavorite'] }])
    ).toBe(true);
  });

  it('does not match names that merely contain like/fans/similar', () => {
    expect(isFavoriteListQuery(queryKeys.fansAlsoLike.detail('u', 'ar1'))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.similar.detail('u', 'ar1', 12))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.srHome.list('u', 10))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.albumTracks.detail('u', 'album-1'))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.artistTracks.detail('u', 'ar1'))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.playlistItems.detail('u', 'pl1'))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.searchAll.detail('u', 'pink'))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.items.list('u', ['search-songs', 'q'], { searchTerm: 'q' }))).toBe(false);
    expect(isFavoriteListQuery(queryKeys.item.detail('u', 't1'))).toBe(false);
  });
});

describe('invalidateAfterFavorite', () => {
  it('invalidates favorite lists and leaves unrelated caches', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const albumKey = queryKeys.albumTracks.detail('u', 'a1');
    const artistKey = queryKeys.artistTracks.detail('u', 'ar1');
    const playlistKey = queryKeys.playlistItems.detail('u', 'pl1');
    const searchKey = queryKeys.searchAll.detail('u', 'pink');
    const fansKey = queryKeys.fansAlsoLike.detail('u', 'ar1');
    const likesKey = queryKeys.items.list('u', ['home-liked-songs'], { filters: ['IsFavorite'] });
    const homeLikes = queryKeys.items.list('u', ['home-liked-albums'], { filters: ['IsFavorite'] });

    client.setQueryData(albumKey, [{ id: 't1' }]);
    client.setQueryData(artistKey, [{ id: 't2' }]);
    client.setQueryData(playlistKey, [{ id: 't3' }]);
    client.setQueryData(searchKey, { items: [] });
    client.setQueryData(fansKey, []);
    client.setQueryData(likesKey, { items: [] });
    client.setQueryData(homeLikes, { items: [] });

    invalidateAfterFavorite(client);

    expect(client.getQueryState(likesKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(homeLikes)?.isInvalidated).toBe(true);
    expect(client.getQueryState(albumKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(artistKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(playlistKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(searchKey)?.isInvalidated).toBe(false);
    expect(client.getQueryState(fansKey)?.isInvalidated).toBe(false);
  });
});

describe('search race', () => {
  it('reads only the current term from cache when older terms also have data', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.searchAll.detail('u', 'pink'), { items: [{ id: 'old' }] });
    client.setQueryData(queryKeys.searchAll.detail('u', 'pink floyd live'), { items: [{ id: 'new' }] });
    const visible = client.getQueryData(queryKeys.searchAll.detail('u', 'pink floyd live')) as {
      items: { id: string }[];
    };
    expect(visible.items[0]?.id).toBe('new');
  });
});

describe('search keys', () => {
  it('isolates successive search terms so an older result cannot land on a newer key', () => {
    const a = queryKeys.searchAll.detail('u', 'pink');
    const b = queryKeys.searchAll.detail('u', 'pink floyd');
    const c = queryKeys.searchAll.detail('u', 'pink floyd live');
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
  });
});

describe('collection cache identity', () => {
  it('uses one key per album/artist/playlist so browse and play share data', () => {
    expect(queryKeys.albumTracks.detail('u', 'a')).toEqual(['album-tracks', 'u', 'a']);
    expect(queryKeys.artistTracks.detail('u', 'ar')).toEqual(['artist-tracks', 'u', 'ar']);
    expect(queryKeys.playlistItems.detail('u', 'p')).toEqual(['playlist-items', 'u', 'p']);
  });
});
