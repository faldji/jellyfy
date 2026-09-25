import { describe, expect, it, vi } from 'vitest';

import {
  applyMediaSessionMetadata,
  bindMediaSessionActions,
  type MediaSessionHost,
} from '@/playback/media-session';

function host(overrides: Partial<MediaSessionHost> = {}): MediaSessionHost {
  return {
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    userNext: vi.fn(async () => {}),
    previous: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    position: () => 40,
    ...overrides,
  };
}

function session() {
  const handlers = new Map<string, (details?: { seekOffset?: number | null; seekTime?: number | null }) => void>();
  return {
    handlers,
    playbackState: 'none',
    metadata: undefined as unknown,
    setActionHandler(
      action: string,
      handler: ((details?: { seekOffset?: number | null; seekTime?: number | null }) => void) | null
    ) {
      if (handler) handlers.set(action, handler);
      else handlers.delete(action);
    },
  };
}

describe('bindMediaSessionActions', () => {
  it('wires play, pause, skip, and relative seek', () => {
    const media = session();
    const player = host();
    bindMediaSessionActions(media, player);

    media.handlers.get('play')?.();
    media.handlers.get('pause')?.();
    media.handlers.get('nexttrack')?.();
    media.handlers.get('previoustrack')?.();
    media.handlers.get('seekforward')?.({ seekOffset: 15 });
    media.handlers.get('seekbackward')?.({});
    media.handlers.get('seekto')?.({ seekTime: 12 });

    expect(player.play).toHaveBeenCalledOnce();
    expect(player.pause).toHaveBeenCalledOnce();
    expect(player.userNext).toHaveBeenCalledOnce();
    expect(player.previous).toHaveBeenCalledOnce();
    expect(player.seek).toHaveBeenNthCalledWith(1, 55);
    expect(player.seek).toHaveBeenNthCalledWith(2, 30);
    expect(player.seek).toHaveBeenNthCalledWith(3, 12);
  });

  it('keeps registering after a browser rejects one action', () => {
    const media = session();
    const set = media.setActionHandler.bind(media);
    media.setActionHandler = (action, handler) => {
      if (action === 'seekto') throw new Error('unsupported');
      set(action, handler);
    };
    bindMediaSessionActions(media, host());
    expect(media.handlers.has('play')).toBe(true);
    expect(media.handlers.has('nexttrack')).toBe(true);
    expect(media.handlers.has('seekto')).toBe(false);
  });
});

describe('applyMediaSessionMetadata', () => {
  it('publishes title, art, and playback state', () => {
    const media = session();
    class Metadata {
      constructor(public init: unknown) {}
    }
    applyMediaSessionMetadata(
      media,
      { title: 'Song', artist: 'Artist', album: 'Album', artworkUrl: 'https://example/art.jpg', playing: true },
      Metadata
    );
    expect(media.metadata).toBeInstanceOf(Metadata);
    expect((media.metadata as Metadata).init).toEqual({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      artwork: [{ src: 'https://example/art.jpg' }],
    });
    expect(media.playbackState).toBe('playing');
  });
});
