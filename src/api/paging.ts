import type { BaseItem } from '@/api/types';

/** Rows fetched per scroll for albums, playlists, artists, and tracks. */
export const COLLECTION_PAGE = 40;

type Page = {
  items?: BaseItem[] | null;
  totalRecordCount?: number;
};

export function nextStartIndex(pages: Page[], pageSize: number): number | undefined {
  if (!pages.length) return undefined;
  const loaded = pages.reduce((count, page) => count + (page.items?.length ?? 0), 0);
  const total = pages.find((page) => typeof page.totalRecordCount === 'number')?.totalRecordCount;
  if (typeof total === 'number' && loaded >= total) return undefined;
  if ((pages[pages.length - 1]?.items?.length ?? 0) < pageSize) return undefined;
  return loaded;
}

/** Use pages already on screen when they cover `limit` or the collection has ended. */
export function takeLoadedPages(pages: Page[] | undefined, limit: number, pageSize: number): BaseItem[] | null {
  if (!pages?.length) return null;
  if (nextStartIndex(pages, pageSize) != null && pages.reduce((count, page) => count + (page.items?.length ?? 0), 0) < limit) {
    return null;
  }
  return pages.flatMap((page) => page.items ?? []).slice(0, limit);
}
