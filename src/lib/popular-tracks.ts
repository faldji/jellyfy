import type { BaseItem } from '@/api/types';
import { sameId } from '@/lib/ids';
import { isAudio } from '@/lib/media';

const DAY = 86_400_000;

function recency(iso: string | null | undefined, windowDays: number): number {
  if (!iso) return 0;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, 1 - (Date.now() - at) / (windowDays * DAY));
}

function releaseRecency(item: BaseItem): number {
  if (item.premiereDate) return recency(item.premiereDate, 365 * 4);
  if (item.productionYear) {
    return recency(`${item.productionYear}-06-01T00:00:00.000Z`, 365 * 4);
  }
  return 0;
}

/** Personal + library signal for an artist’s “Popular” five. */
export function rankPopularTracks(items: BaseItem[], artistId: string, limit = 5): BaseItem[] {
  const scored = items.filter(isAudio).map((item) => {
    const playCount = item.userData?.playCount ?? 0;
    const liked = item.userData?.isFavorite ? 1 : 0;
    const played = recency(item.userData?.lastPlayedDate, 180);
    const rating = Math.max(0, Math.min(1, (item.communityRating ?? 0) / 10));
    const ownAlbum = item.albumArtists?.some((entry) => sameId(entry.id, artistId)) ? 1 : 0;
    const score =
      4 * Math.log2(1 + playCount) +
      2.2 * liked +
      1.6 * played +
      1.1 * rating +
      0.55 * releaseRecency(item) +
      0.35 * ownAlbum;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score || (a.item.name ?? '').localeCompare(b.item.name ?? ''));

  const seen = new Set<string>();
  const next: BaseItem[] = [];
  for (const row of scored) {
    const key = (row.item.name ?? '').trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    next.push(row.item);
    if (next.length >= limit) break;
  }
  return next;
}

export function albumReleaseTime(item: BaseItem): number {
  if (item.premiereDate) {
    const at = Date.parse(item.premiereDate);
    if (Number.isFinite(at)) return at;
  }
  if (item.productionYear) return Date.UTC(item.productionYear, 6, 1);
  if (item.dateCreated) {
    const at = Date.parse(item.dateCreated);
    if (Number.isFinite(at)) return at;
  }
  return 0;
}

export function sortAlbumsLatest(items: BaseItem[]): BaseItem[] {
  return [...items].sort((a, b) => {
    const delta = albumReleaseTime(b) - albumReleaseTime(a);
    if (delta !== 0) return delta;
    return (a.sortName ?? a.name ?? '').localeCompare(b.sortName ?? b.name ?? '');
  });
}
