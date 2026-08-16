import type { BaseItem, BaseItemKind } from '@/api/types';

export type AudioLike = Pick<BaseItem, 'type' | 'mediaType'>;

const COLLECTION_TYPES = new Set<BaseItemKind>([
  'MusicArtist',
  'MusicAlbum',
  'Playlist',
  'MusicGenre',
  'Folder',
  'CollectionFolder',
]);

/** Album / artist / playlist (and similar). Not a playable stream by itself. */
export function isCollectionItem(item: AudioLike | null | undefined): boolean {
  return Boolean(item?.type && COLLECTION_TYPES.has(item.type));
}

/** Playable track. Collection types can also carry `mediaType: Audio` on live Jellyfin. */
export function isAudio(item: AudioLike | null | undefined): boolean {
  if (!item || isCollectionItem(item)) return false;
  return item.type === 'Audio' || item.mediaType === 'Audio';
}

/** Cover / row highlight. Artists only match their own play context, not the current song. */
export function isItemActive(
  item: Pick<BaseItem, 'id' | 'type' | 'mediaType'>,
  current: Pick<BaseItem, 'id' | 'albumId' | 'parentId'> | null,
  contextId?: string | null
): boolean {
  if (!current) return false;
  if (item.type === 'MusicArtist' || item.type === 'Playlist') {
    return Boolean(contextId && contextId === item.id);
  }
  if (item.type === 'MusicAlbum') {
    return contextId === item.id || current.albumId === item.id || current.parentId === item.id;
  }
  if (contextId && contextId === item.id) return true;
  if (isAudio(item)) return current.id === item.id;
  return current.id === item.id;
}
