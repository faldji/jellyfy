import type { BaseItem } from '@/api/types';
import { normId } from '@/lib/ids';

export { normId, sameId } from '@/lib/ids';

/** Artists liked by people who like the seed, ranked by metadata + behaviour. */
export function rankFansAlsoLike(input: {
  seedId: string;
  seedGenres?: string[];
  similar: BaseItem[];
  collab: Map<string, number>;
  catalog: Map<string, BaseItem>;
  limit?: number;
}): BaseItem[] {
  const seed = normId(input.seedId);
  const genres = new Set((input.seedGenres ?? []).map((g) => g.toLowerCase()));
  const metaRank = new Map<string, number>();
  input.similar.forEach((item, index) => {
    const id = normId(item.id);
    if (id && id !== seed) metaRank.set(id, 1 / (index + 1));
  });

  const ids = new Set<string>([...metaRank.keys(), ...input.collab.keys()]);
  const scored: { item: BaseItem; score: number }[] = [];
  for (const id of ids) {
    if (!id || id === seed) continue;
    const item = input.catalog.get(id);
    if (!item || (item.type && item.type !== 'MusicArtist')) continue;
    const meta = metaRank.get(id) ?? 0;
    const collab = input.collab.get(id) ?? 0;
    if (meta <= 0 && collab <= 0) continue;
    const overlap = (item.genres ?? []).filter((g) => genres.has(g.toLowerCase())).length;
    scored.push({
      item,
      score: 2 * meta + 1.4 * Math.log2(1 + collab) + 0.18 * overlap,
    });
  }
  scored.sort((a, b) => b.score - a.score || (a.item.name ?? '').localeCompare(b.item.name ?? ''));
  return scored.slice(0, input.limit ?? 5).map((row) => row.item);
}
