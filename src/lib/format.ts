export function ticksToSeconds(ticks?: number | null): number {
  if (!ticks) return 0;
  return ticks / 10_000_000;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * 10_000_000);
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatTicks(ticks?: number | null): string {
  return formatDuration(ticksToSeconds(ticks));
}

export function greetingForNow(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function artistLine(item: {
  artists?: string[] | null;
  albumArtist?: string | null;
  albumArtists?: { name?: string }[] | null;
}): string {
  if (item.artists?.length) return item.artists.join(', ');
  if (item.albumArtists?.length) {
    return item.albumArtists.map((a) => a.name).filter(Boolean).join(', ');
  }
  return item.albumArtist ?? '';
}

export function yearOf(item: { productionYear?: number | null; premiereDate?: string | null }): string {
  if (item.productionYear) return String(item.productionYear);
  if (item.premiereDate) return item.premiereDate.slice(0, 4);
  return '';
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function normalizeServerUrl(input: string | null | undefined): string {
  let url = (input ?? '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url.replace(/\/+$/, '');
}
