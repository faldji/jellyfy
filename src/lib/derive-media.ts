import type { BaseItem } from '@/api/types';
import { isAudio } from '@/lib/media';

function itemKey(id?: string) {
  return (id ?? '').replace(/-/g, '').toLowerCase();
}

function itemScore(item: BaseItem): number {
  let score = 0;
  if (item.userData) score += 2;
  if (item.imageTags?.Primary || item.albumPrimaryImageTag) score += 2;
  if (item.name) score += 1;
  if (item.overview) score += 1;
  return score;
}

function mergeItem(prev: BaseItem, next: BaseItem): BaseItem {
  const base = itemScore(next) >= itemScore(prev) ? { ...prev, ...next } : { ...next, ...prev };
  const liked = Boolean(prev.userData?.isFavorite) || Boolean(next.userData?.isFavorite);
  if (!liked && !prev.userData && !next.userData) return base;
  return {
    ...base,
    userData: {
      key: next.userData?.key ?? prev.userData?.key ?? next.id,
      ...prev.userData,
      ...next.userData,
      isFavorite: liked,
    },
  };
}

/** Last list can add cards; favorite flags and images from earlier lists are kept. */
export function mergeItemsById(...lists: (BaseItem[] | undefined)[]): BaseItem[] {
  const map = new Map<string, BaseItem>();
  for (const list of lists) {
    for (const item of list ?? []) {
      const key = itemKey(item.id);
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, existing ? mergeItem(existing, item) : item);
    }
  }
  return [...map.values()];
}

/** Album cards from Audio items already in memory. Avoids a second /Items?ids= round trip. */
export function albumsFromAudio(tracks: BaseItem[]): BaseItem[] {
  const map = new Map<string, BaseItem>();
  for (const track of tracks) {
    if (!isAudio(track) || !track.albumId || map.has(track.albumId)) continue;
    map.set(track.albumId, {
      id: track.albumId,
      name: track.album,
      type: 'MusicAlbum',
      albumId: track.albumId,
      albumPrimaryImageTag: track.albumPrimaryImageTag,
      imageTags: track.albumPrimaryImageTag ? { Primary: track.albumPrimaryImageTag } : track.imageTags,
      albumArtists: track.albumArtists,
      albumArtist: track.albumArtist,
      artists: track.artists,
      productionYear: track.productionYear,
    });
  }
  return [...map.values()];
}

/** Artist cards from Audio items. Image URL can fall back to /Items/{id}/Images/Primary. */
export function artistsFromAudio(tracks: BaseItem[]): BaseItem[] {
  const map = new Map<string, BaseItem>();
  for (const track of tracks) {
    if (!isAudio(track)) continue;
    const people = [...(track.albumArtists ?? []), ...(track.artistItems ?? [])];
    for (const person of people) {
      if (!person.id || map.has(person.id)) continue;
      map.set(person.id, {
        id: person.id,
        name: person.name,
        type: 'MusicArtist',
      });
    }
  }
  return [...map.values()];
}

export function splitSearchHits(items: BaseItem[] | undefined) {
  const list = items ?? [];
  return {
    songs: list.filter((item) => item.type === 'Audio').slice(0, 12),
    artists: list.filter((item) => item.type === 'MusicArtist').slice(0, 8),
    albums: list.filter((item) => item.type === 'MusicAlbum').slice(0, 10),
    playlists: list.filter((item) => item.type === 'Playlist').slice(0, 6),
    genres: list.filter((item) => item.type === 'MusicGenre' || item.type === 'Genre').slice(0, 6),
  };
}

/** Reuse a cached list when it already covers `limit`, or is a complete short album. */
export function takeCachedTracks(cached: BaseItem[] | undefined, limit: number): BaseItem[] | null {
  if (!cached) return null;
  if (cached.length >= limit) return cached.slice(0, limit);
  if (cached.length < 500) return cached;
  return null;
}
