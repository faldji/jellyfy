/** Slice a home rail to the configured cap. Never pads. Show-all only if more exist. */
export function takeRail<T>(items: T[], limit: number): { shown: T[]; hasMore: boolean } {
  const cap = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0));
  const shown = items.slice(0, cap);
  return { shown, hasMore: items.length > shown.length };
}

/**
 * Show all only when the *destination* has more items than the rail.
 * The rail mix (e.g. artists from liked songs) can be larger than the
 * liked-only library tab — do not send the user to an empty screen.
 */
export function canSeeAll(destinationCount: number, shownCount: number): boolean {
  return destinationCount > shownCount && shownCount > 0;
}
