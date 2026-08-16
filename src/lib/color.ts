/** Append an alpha channel to a #RRGGBB color. */
export function hexAlpha(hex: string, alpha: number): string {
  const raw = hex.trim().replace('#', '');
  if (raw.length !== 6 || /[^0-9a-fA-F]/i.test(raw)) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${raw}${a}`;
}
