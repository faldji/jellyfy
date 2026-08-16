/** Deterministic saturated color from an item id — album-art fallback. */
export function colorFromId(id?: string | null): string {
  const seed = id ?? 'jellyfy';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 42% 28%)`;
}

export function colorFromIdLight(id?: string | null): string {
  const seed = id ?? 'jellyfy';
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 48% 38%)`;
}
