import type { BaseItem } from '@/api/types';

export function albumDiscNumber(item: Pick<BaseItem, 'parentIndexNumber'>): number {
  return item.parentIndexNumber && item.parentIndexNumber > 0 ? item.parentIndexNumber : 1;
}

/** Jellyfin track number, or 1-based position in the current disc/list. */
export function albumTrackNumber(
  item: Pick<BaseItem, 'indexNumber'>,
  fallbackIndex?: number
): number | null {
  if (item.indexNumber && item.indexNumber > 0) return item.indexNumber;
  if (typeof fallbackIndex === 'number' && fallbackIndex >= 0) return fallbackIndex + 1;
  return null;
}

export function groupAlbumDiscs(tracks: BaseItem[]): { disc: number; tracks: BaseItem[] }[] {
  const discs = new Map<number, BaseItem[]>();
  for (const track of tracks) {
    const disc = albumDiscNumber(track);
    const list = discs.get(disc);
    if (list) list.push(track);
    else discs.set(disc, [track]);
  }
  return [...discs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([disc, rows]) => ({ disc, tracks: rows }));
}