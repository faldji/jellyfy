import { create } from 'zustand';

import type { BaseItem } from '@/api/types';
import { playback, type PlaybackSnapshot, type PlayItemsOptions, type RepeatModeUi } from '@/playback/engine';

type PlayerState = PlaybackSnapshot & {
  playItems: (items: BaseItem[], startIndex?: number, options?: PlayItemsOptions) => Promise<void>;
  playItem: (item: BaseItem, options?: PlayItemsOptions) => Promise<void>;
  playMix: (item: BaseItem, options?: PlayItemsOptions) => Promise<void>;
  playCollection: (items: BaseItem[], options?: PlayItemsOptions) => Promise<void>;
  playItemInContext: (item: BaseItem, context: BaseItem[], options?: PlayItemsOptions) => Promise<void>;
  playNext: (item: BaseItem) => Promise<void>;
  enqueue: (item: BaseItem) => void;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  skipTo: (index: number) => Promise<void>;
  userNext: () => Promise<void>;
  reloadCurrent: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  updateItem: (item: BaseItem) => void;
};

export const usePlayer = create<PlayerState>(() => ({
  ...playback.snapshot(),
  playItems: (items, startIndex, options) => playback.playItems(items, startIndex, options),
  playItem: (item, options) => playback.playItem(item, options),
  playMix: (item, options) => playback.playMix(item, options),
  playCollection: (items, options) => playback.playCollection(items, options),
  playItemInContext: (item, context, options) => playback.playItemInContext(item, context, options),
  playNext: (item) => playback.playNext(item),
  enqueue: (item) => playback.enqueue(item),
  togglePlay: () => playback.togglePlay(),
  next: () => playback.next(),
  previous: () => playback.previous(),
  skipTo: (index) => playback.skipTo(index),
  userNext: () => playback.userNext(),
  reloadCurrent: () => playback.reloadCurrent(),
  seek: (seconds) => playback.seek(seconds),
  toggleShuffle: () => playback.toggleShuffle(),
  cycleRepeat: () => playback.cycleRepeat(),
  removeAt: (index) => playback.removeAt(index),
  move: (from, to) => playback.move(from, to),
  updateItem: (item) => playback.updateItem(item),
}));

// Subscribe for the process lifetime. Do not tear this down on layout remount
// (React Strict Mode would otherwise leave the store frozen).
playback.subscribe((snapshot) => {
  usePlayer.setState(snapshot);
});

export function bindPlayerStore() {
  usePlayer.setState(playback.snapshot());
  return () => undefined;
}

export type { PlayItemsOptions, RepeatModeUi };
