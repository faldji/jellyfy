import { afterEach, describe, expect, it, vi } from 'vitest';

import { silenceHtmlAudio } from '@/playback/html-audio';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('silenceHtmlAudio', () => {
  it('pauses leftover audio elements and keeps the current one', () => {
    const paused: unknown[] = [];
    const current = { pause: () => paused.push('current') };
    const leftover = { pause: () => paused.push('leftover') };
    vi.stubGlobal('document', {
      querySelectorAll: () => [leftover, current],
    });
    silenceHtmlAudio(current as unknown as HTMLAudioElement);
    expect(paused).toEqual(['leftover']);
  });
});
