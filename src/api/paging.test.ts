import { describe, expect, it } from 'vitest';

import { nextStartIndex, takeLoadedPages } from '@/api/paging';
import type { BaseItem } from '@/api/types';

const page = (ids: string[], total?: number) => ({
  items: ids.map((id) => ({ id }) as BaseItem),
  totalRecordCount: total,
});

describe('nextStartIndex', () => {
  it('asks for the next page while a full page is shorter than the total', () => {
    expect(nextStartIndex([page(['a', 'b'], 5)], 2)).toBe(2);
  });

  it('stops when the total is loaded or the last page is short', () => {
    expect(nextStartIndex([page(['a', 'b'], 2)], 2)).toBeUndefined();
    expect(nextStartIndex([page(['a'], 9)], 2)).toBeUndefined();
  });
});

describe('takeLoadedPages', () => {
  it('returns a finished collection without asking for the play-all cap', () => {
    expect(takeLoadedPages([page(['a', 'b'], 2)], 100, 40)?.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('waits when the loaded pages are still short of the cap', () => {
    const full = page(['a', 'b'], 80);
    expect(takeLoadedPages([full], 100, 2)).toBeNull();
  });
});
