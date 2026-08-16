/** Previous/next index in a play queue. `wrap` is repeat-all. */
export function neighborIndex(
  index: number,
  length: number,
  dir: -1 | 1,
  wrap: boolean
): number | null {
  if (length < 2 || index < 0) return null;
  const next = index + dir;
  if (next >= 0 && next < length) return next;
  if (wrap) return dir === 1 ? 0 : length - 1;
  return null;
}
