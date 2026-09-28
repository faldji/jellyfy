import { describe, expect, it } from 'vitest';

import type { BaseItem } from '@/api/types';
import { albumsFromAudio, artistsFromAudio, mergeItemsById, splitSearchHits } from '@/lib/derive-media';

const track = (partial: Partial<BaseItem> & { id: string }): BaseItem => ({
  type: 'Audio',
  mediaType: 'Audio',
  ...partial,
});

describe('albumsFromAudio', () => {
  it('builds unique album cards from tracks', () => {
    const albums = albumsFromAudio([
      track({
        id: 't1',
        albumId: 'a1',
        album: 'Blue',
        albumPrimaryImageTag: 'tag',
        productionYear: 1999,
      }),
      track({ id: 't2', albumId: 'a1', album: 'Blue' }),
      track({ id: 't3', albumId: 'a2', album: 'Red' }),
    ]);
    expect(albums.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(albums[0]?.type).toBe('MusicAlbum');
    expect(albums[0]?.imageTags?.Primary).toBe('tag');
  });
});

describe('mergeItemsById', () => {
  it('keeps isFavorite when a derived card overwrites a liked item', () => {
    const liked = {
      id: 'AA-11',
      type: 'MusicArtist' as const,
      name: 'One',
      userData: { key: 'AA-11', isFavorite: true },
    };
    const derived = { id: 'aa11', type: 'MusicArtist' as const, name: 'One' };
    const merged = mergeItemsById([liked], [derived]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.userData?.isFavorite).toBe(true);
    expect(merged[0]?.name).toBe('One');
  });

  it('copies isFavorite onto a derived album when the liked album arrives second', () => {
    const derived = { id: 'al1', type: 'MusicAlbum' as const, name: 'Blue' };
    const liked = {
      id: 'al1',
      type: 'MusicAlbum' as const,
      name: 'Blue',
      userData: { key: 'al1', isFavorite: true },
    };
    expect(mergeItemsById([derived], [liked])[0]?.userData?.isFavorite).toBe(true);
  });
});

describe('artistsFromAudio', () => {
  it('collects album artists and track artists', () => {
    const artists = artistsFromAudio([
      track({
        id: 't1',
        albumArtists: [{ id: 'ar1', name: 'One' }],
        artistItems: [
          { id: 'ar1', name: 'One' },
          { id: 'ar2', name: 'Two' },
        ],
      }),
    ]);
    expect(artists.map((item) => item.id)).toEqual(['ar1', 'ar2']);
    expect(artists[0]?.type).toBe('MusicArtist');
  });
});

describe('splitSearchHits', () => {
  it('splits a mixed /Items search into type buckets', () => {
    const split = splitSearchHits([
      { id: '1', type: 'Audio' },
      { id: '2', type: 'MusicArtist' },
      { id: '3', type: 'MusicAlbum' },
      { id: '4', type: 'Playlist' },
      { id: '5', type: 'MusicGenre' },
    ]);
    expect(split.songs).toHaveLength(1);
    expect(split.artists).toHaveLength(1);
    expect(split.albums).toHaveLength(1);
    expect(split.playlists).toHaveLength(1);
    expect(split.genres).toHaveLength(1);
  });
});
