import type { BaseItem } from '@/api/types';
import { isAudio } from '@/lib/media';

/** Caps how many tracks a Play / Shuffle on a collection will queue. */
export const PLAY_ALL_LIMITS = [
  { key: 50, label: '50 tracks', hint: 'Short queues' },
  { key: 100, label: '100 tracks', hint: 'Most albums and playlists' },
  { key: 200, label: '200 tracks', hint: 'Long playlists' },
  { key: 500, label: '500 tracks', hint: 'Large collections' },
  { key: 0, label: 'No limit', hint: 'The whole collection' },
] as const;

export type PlayAllLimit = (typeof PLAY_ALL_LIMITS)[number]['key'];

export const DEFAULT_PLAY_ALL_LIMIT: PlayAllLimit = 100;

const HARD_CAP = 2000;

export function resolvePlayAllLimit(limit?: number | null): number {
  const n = typeof limit === 'number' ? limit : DEFAULT_PLAY_ALL_LIMIT;
  if (!n || n < 0) return HARD_CAP;
  return Math.min(HARD_CAP, Math.floor(n));
}

function shuffleList<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function takePlayAll(items: BaseItem[], limit?: number | null, shuffle = false): BaseItem[] {
  const audio = items.filter(isAudio);
  const pool = shuffle ? shuffleList(audio) : audio;
  return pool.slice(0, resolvePlayAllLimit(limit));
}
