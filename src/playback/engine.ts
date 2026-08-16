import {
  createAudioPlayer,
  setAudioModeAsync,
  requestNotificationPermissionsAsync,
  type AudioPlayer,
  type AudioSample,
  type AudioStatus,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { createApi, imageUrl, streamHeaders, streamUrl, type Session } from '@/api/jellyfin';
import { fetchAlbumTracks, fetchArtistTracks, fetchPlaylistTracks } from '@/api/library';
import { emitNet } from '@/api/net';
import { queryClient } from '@/api/query';
import { queryKeys } from '@/api/query-keys';
import { fetchSrNext, fetchSrRadio, hydrateSrTracks, isSrEnabled, postSrEventSafe } from '@/api/sr';
import type { BaseItem, PlaybackOrder, PlayMethod, RepeatMode } from '@/api/types';
import { takeCachedTracks } from '@/lib/derive-media';
import { buildPlayingBody } from '@/playback/report';
import { createPlaySessionId, sameId } from '@/lib/ids';
import { artistLine, secondsToTicks, ticksToSeconds } from '@/lib/format';
import { isAudio } from '@/lib/media';
import { rangeContaining } from '@/lib/media-buffer';
import { useDownloads } from '@/store/downloads';
import { useRecents } from '@/store/recents';
import { resolvePlayAllLimit } from '@/lib/play-all';
import {
  isNativeLoopWrap,
  leaveEventType,
  playheadLooksStuckAtEnd,
} from '@/playback/transport';
import { bindMediaSessionSkip } from '@/playback/media-session';
import { silenceHtmlAudio } from '@/playback/html-audio';
import {
  canPumpMp3,
  createMediaSourceHandle,
  pumpIntoMediaSource,
  revokeMediaSourceUrl,
} from '@/playback/web-source';
import { useSettings } from '@/store/settings';
import { useToast } from '@/store/toast';

export type RepeatModeUi = 'off' | 'all' | 'one';

export type PlayItemsOptions = {
  /** Force shuffle on/off for this new queue. Omit to keep the current mode. */
  shuffle?: boolean;
  /** Collection the queue was started from (album / playlist / artist / likes). */
  contextId?: string;
  /** Collection item to fetch when the local list is still empty. */
  seed?: BaseItem;
  /** Wall-clock seconds to open the starting track at. */
  startPosition?: number;
  /** Load the queue without autoplay (cold restore / handoff). */
  paused?: boolean;
  /** Keep the given item order even when shuffle is on (already-ordered remote queue). */
  keepOrder?: boolean;
  repeat?: RepeatModeUi;
  /** When the queue runs out, try SR next-track (radio / recommended). */
  continueWithSr?: boolean;
};

export type PlaybackSnapshot = {
  queue: BaseItem[];
  index: number;
  current: BaseItem | null;
  playing: boolean;
  buffering: boolean;
  loaded: boolean;
  position: number;
  duration: number;
  /** Wall-clock end of the loaded range that contains the playhead. */
  buffered: number;
  /** Wall-clock start of that loaded range (0 unless we opened mid-track). */
  bufferedStart: number;
  shuffle: boolean;
  repeat: RepeatModeUi;
  contextId: string | null;
  continueWithSr: boolean;
  preparing: boolean;
  error: string | null;
  revision: number;
};

const emptySnapshot: PlaybackSnapshot = {
  queue: [],
  index: -1,
  current: null,
  playing: false,
  buffering: false,
  loaded: false,
  position: 0,
  duration: 0,
  buffered: 0,
  bufferedStart: 0,
  shuffle: false,
  repeat: 'off',
  contextId: null,
  continueWithSr: false,
  preparing: false,
  error: null,
  revision: 0,
};

const PERSIST_KEY = 'jellyfy.playback';

type PersistedPlayback = {
  source: BaseItem[];
  order: number[];
  index: number;
  shuffle: boolean;
  repeat: RepeatModeUi;
  position: number;
  contextId?: string | null;
  continueWithSr?: boolean;
  userId?: string;
  serverId?: string;
  serverUrl?: string;
};

type Listener = (snapshot: PlaybackSnapshot) => void;

function jellyfinRepeat(mode: RepeatModeUi): RepeatMode {
  if (mode === 'one') return 'RepeatOne';
  if (mode === 'all') return 'RepeatAll';
  return 'RepeatNone';
}

function isMixContext(contextId?: string | null): boolean {
  return Boolean(contextId && (contextId.startsWith('radio:') || contextId.startsWith('mix:')));
}

function identityOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

function shuffleInPlace<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function shuffledOrder(length: number, first: number): number[] {
  const start = Math.max(0, Math.min(first, Math.max(0, length - 1)));
  const rest = identityOrder(length).filter((i) => i !== start);
  return length === 0 ? [] : [start, ...shuffleInPlace(rest)];
}

function sameTrackList(a: BaseItem[], b: BaseItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.id === b[i]?.id);
}

function bandsFromFrames(frames: number[], count: number): number[] {
  const n = frames.length;
  if (!n) return Array.from({ length: count }, () => 0);
  const size = Math.max(1, Math.floor(n / count));
  const levels: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = i * size;
    const end = i === count - 1 ? n : Math.min(n, start + size);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += frames[j] * frames[j];
    levels.push(Math.min(1, Math.sqrt(sum / Math.max(1, end - start)) * 3.4));
  }
  return levels;
}

function htmlMedia(player: AudioPlayer | null): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || !player) return null;
  const raw = player as AudioPlayer & { media?: HTMLAudioElement };
  const media = raw.media;
  if (media && typeof media.buffered !== 'undefined' && typeof media.addEventListener === 'function') {
    return media;
  }
  return null;
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AbortError');
}

/**
 * One process-wide player.
 *
 * Position is always wall-clock time in the current song (0..duration).
 * startOffset exists only when a transcoded stream was opened at startTimeTicks.
 * pendingSeek is the playhead we still owe the user until seekTo lands.
 * wantPlaying is the UI transport state; audio is driven to match it.
 */
export class PlaybackEngine {
  private player: AudioPlayer | null = null;
  private session: Session | null = null;
  private source: BaseItem[] = [];
  private order: number[] = [];
  private index = -1;
  private shuffle = false;
  private repeat: RepeatModeUi = 'off';
  private playSessionId: string | null = null;
  private lastProgressAt = 0;
  private reportedStartFor: string | null = null;
  private listeners = new Set<Listener>();
  private error: string | null = null;
  private unsub: { remove: () => void } | null = null;
  private lastStatus: AudioStatus | null = null;
  private revision = 0;
  private startOffset = 0;
  private pendingSeek = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistGen = 0;
  private restorePosition = 0;
  private advancing = false;
  private endedHandled = false;
  private ignoreEndUntil = 0;
  private lastPos = 0;
  private lastPosAt = 0;
  private nextGate: Promise<void> | null = null;
  private attachGate: Promise<void> | null = null;
  private loadGen = 0;
  private wantPlaying = false;
  private contextId: string | null = null;
  private continueWithSr = false;
  private pendingItem: BaseItem | null = null;
  private preparing = false;
  private prepareGen = 0;
  private htmlBufferUnsub: (() => void) | null = null;
  private sourceAbort: AbortController | null = null;
  private sourceObjectUrl: string | null = null;
  private lastEmittedBuffered = -1;
  private sampleListeners = new Set<(levels: number[]) => void>();
  private sampleUnsub: { remove: () => void } | null = null;
  /** After a track change, force the element back to 0 if replace() kept the old currentTime. */
  private resetPlayhead = false;
  /** Repeat-one already posted REPLAY; do not also post PLAY_START. */
  private emitSrOnStart = true;
  private lastMediaTime = 0;
  private moveGen = 0;
  private transition: Promise<void> = Promise.resolve();
  private leftTrackId: string | null = null;
  private queued: BaseItem[] | null = null;
  private reportChain: Promise<void> = Promise.resolve();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Best-effort spectrum levels 0..1. Live samples on web; no mic permission. */
  subscribeSamples(listener: (levels: number[]) => void): () => void {
    this.sampleListeners.add(listener);
    this.ensureSampling();
    return () => {
      this.sampleListeners.delete(listener);
      if (this.sampleListeners.size === 0) this.stopSampling();
    };
  }

  snapshot(): PlaybackSnapshot {
    const player = this.player;
    const status = this.lastStatus;
    const current = this.currentItem();
    return {
      queue: this.playQueue(),
      index: this.index,
      current: this.preparing && this.pendingItem ? this.pendingItem : current,
      playing: this.wantPlaying,
      buffering: this.preparing || (player?.isBuffering ?? status?.isBuffering ?? false),
      preparing: this.preparing,
      loaded: player?.isLoaded ?? status?.isLoaded ?? false,
      position: this.displayPosition(),
      duration: this.displayDuration(),
      buffered: this.displayBuffered(),
      bufferedStart: this.displayBufferedStart(),
      shuffle: this.shuffle,
      repeat: this.repeat,
      contextId: this.contextId,
      continueWithSr: this.continueWithSr,
      error: this.error,
      revision: this.revision,
    };
  }

  async attach(session: Session) {
    this.session = session;
    if (!this.attachGate) {
      this.attachGate = this.attachImpl().finally(() => {
        this.attachGate = null;
      });
    }
    await this.attachGate;
  }

  private async attachImpl() {
    if (this.player) {
      this.emit();
      return;
    }

    silenceHtmlAudio();

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });

    if (this.player) {
      this.emit();
      return;
    }

    if (Platform.OS === 'android') {
      try {
        await requestNotificationPermissionsAsync();
      } catch {
        // Lock-screen notification may be limited without permission.
      }
    }

    this.player = createAudioPlayer(null, {
      updateInterval: 250,
      keepAudioSessionActive: true,
      // Music: keep minutes of audio, not a 20s "headlight" that rides the playhead.
      preferredForwardBufferDuration: 600,
    });
    this.player.loop = false;

    this.unsub = this.player.addListener('playbackStatusUpdate', (status) => {
      this.onStatus(status);
    });
    this.ensureSampling();

    if (this.source.length === 0) {
      await this.hydrate();
    }

    if (this.wantPlaying && this.currentItem()) {
      if (!this.player.isLoaded) {
        await this.loadCurrent(true, this.displayPosition() || this.restorePosition);
      } else {
        this.emit();
      }
      this.restorePosition = 0;
      return;
    }

    this.wantPlaying = false;
    if (this.currentItem()) {
      await this.loadCurrent(false, this.restorePosition);
      this.restorePosition = 0;
      return;
    }
    this.emit();
  }

  detach() {
    this.releaseSession();
    this.stopSampling();
    this.abortWebSource(true);
    this.htmlBufferUnsub?.();
    this.htmlBufferUnsub = null;
    this.unsub?.remove();
    this.unsub = null;
    this.wantPlaying = false;
    silenceHtmlAudio();
    try {
      this.player?.pause();
      this.player?.clearLockScreenControls();
      this.player?.remove();
    } catch {
      // Player may already be released.
    }
    this.player = null;
    this.lastStatus = null;
    this.emit();
  }

  async reset() {
    this.prepareGen += 1;
    this.persistGen += 1;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.releaseSession();
    this.abortWebSource(true);
    this.htmlBufferUnsub?.();
    this.htmlBufferUnsub = null;
    this.source = [];
    this.order = [];
    this.index = -1;
    this.shuffle = false;
    this.repeat = 'off';
    this.startOffset = 0;
    this.pendingSeek = 0;
    this.restorePosition = 0;
    this.wantPlaying = false;
    this.contextId = null;
    this.continueWithSr = false;
    this.pendingItem = null;
    this.preparing = false;
    this.error = null;
    this.reportedStartFor = null;
    silenceHtmlAudio();
    try {
      this.player?.pause();
    } catch {
      // Player may already be released.
    }
    await this.clearPersisted();
    this.emit();
  }

  async playItems(items: BaseItem[], startIndex = 0, options?: PlayItemsOptions) {
    const tracks = items.filter(isAudio);
    if (tracks.length === 0) return;
    this.prepareGen += 1;
    this.preparing = false;
    this.pendingItem = null;

    if (
      options?.shuffle === undefined &&
      options?.startPosition === undefined &&
      !options?.paused &&
      !options?.keepOrder &&
      sameTrackList(tracks, this.source) &&
      this.order.length === tracks.length
    ) {
      if (options?.contextId) this.contextId = options.contextId;
      if (options?.continueWithSr !== undefined) this.continueWithSr = options.continueWithSr;
      const playIndex = this.shuffle
        ? this.order.findIndex((sourceIndex) => sourceIndex === startIndex)
        : startIndex;
      const nextIndex = playIndex >= 0 ? playIndex : 0;
      if (nextIndex === this.index) {
        await this.togglePlay();
        return;
      }
      this.stopAudible();
      this.leaveCurrent(false);
      this.releaseSession();
      this.index = nextIndex;
      this.wantPlaying = true;
      this.queued = null;
      await this.loadCurrent(true);
      return;
    }

    this.stopAudible();
    this.leaveCurrent(false);
    this.releaseSession();
    this.queued = null;
    if (options?.shuffle !== undefined) this.shuffle = options.shuffle;
    if (options?.repeat !== undefined) this.repeat = options.repeat;
    this.contextId = options?.contextId ?? null;
    this.continueWithSr =
      options?.continueWithSr !== undefined
        ? Boolean(options.continueWithSr)
        : isMixContext(this.contextId);
    this.source = [...tracks];
    const start = Math.max(0, Math.min(startIndex, tracks.length - 1));
    if (this.shuffle && !options?.keepOrder) {
      this.order = shuffledOrder(tracks.length, start);
      this.index = 0;
    } else {
      this.order = identityOrder(tracks.length);
      this.index = start;
    }
    const startSeconds = Math.max(0, options?.startPosition ?? 0);
    this.startOffset = 0;
    this.pendingSeek = 0;
    this.restorePosition = 0;
    this.wantPlaying = !options?.paused;
    this.lastStatus = null;
    this.emit();
    await this.loadCurrent(this.wantPlaying, startSeconds);
  }

  /** Play a collection that is already in memory, capped by the play-all setting. */
  async playCollection(items: BaseItem[], options?: PlayItemsOptions) {
    const tracks = items.filter(isAudio);
    if (!tracks.length) {
      if (options?.seed && isMixContext(options.contextId)) {
        await this.playMix(options.seed, options);
        return;
      }
      if (options?.seed) {
        await this.playItem(options.seed, options);
        return;
      }
      return;
    }
    const cap = resolvePlayAllLimit(useSettings.getState().playAllLimit);
    const picked = tracks.slice(0, cap);
    await this.playItems(picked, 0, options);
  }

  /** Radio / “This Is” only. Instant Mix is never used for a direct artist/album/playlist play. */
  async playMix(item: BaseItem, options?: PlayItemsOptions) {
    const ctx: PlayItemsOptions = {
      ...options,
      contextId: options?.contextId ?? `mix:${item.id}`,
      continueWithSr: options?.continueWithSr ?? true,
    };
    if (this.preparing && this.contextId === ctx.contextId) return;
    this.stopAudible();
    const gen = ++this.prepareGen;
    this.markPreparing(item, ctx.contextId);
    try {
      const tracks = await this.tracksForMix(item);
      if (gen !== this.prepareGen) return;
      this.preparing = false;
      this.pendingItem = null;
      if (!tracks.length) {
        this.wantPlaying = false;
        this.error = 'Nothing to play';
        this.emit();
        useToast.getState().show('Nothing to play');
        return;
      }
      await this.playItems(tracks, 0, ctx);
    } catch (error) {
      if (gen !== this.prepareGen) return;
      this.preparing = false;
      this.pendingItem = null;
      this.wantPlaying = false;
      this.error = error instanceof Error ? error.message : 'Could not start playback';
      this.emit();
      useToast.getState().show(this.error);
    }
  }

  /** Play a tile: one track, or that album / playlist / artist catalog. Never Instant Mix. */
  async playItem(item: BaseItem, options?: PlayItemsOptions) {
    const ctx: PlayItemsOptions = { ...options, contextId: options?.contextId ?? item.id };
    const collection =
      item.type === 'MusicArtist' || item.type === 'MusicAlbum' || item.type === 'Playlist';
    if (isAudio(item) && !collection) {
      await this.playItems([item], 0, ctx);
      return;
    }
    if (this.preparing && this.contextId === (ctx.contextId ?? item.id)) return;
    this.stopAudible();
    const gen = ++this.prepareGen;
    this.markPreparing(item, ctx.contextId);
    try {
      const tracks = await this.tracksForItem(item);
      if (gen !== this.prepareGen) return;
      this.preparing = false;
      this.pendingItem = null;
      if (!tracks.length) {
        this.wantPlaying = false;
        this.error = 'Nothing to play';
        this.emit();
        useToast.getState().show('Nothing to play');
        return;
      }
      await this.playItems(tracks, 0, ctx);
    } catch (error) {
      if (gen !== this.prepareGen) return;
      this.preparing = false;
      this.pendingItem = null;
      this.wantPlaying = false;
      this.error = error instanceof Error ? error.message : 'Could not start playback';
      this.emit();
      useToast.getState().show(this.error);
    }
  }

  private markPreparing(item: BaseItem, contextId?: string) {
    this.contextId = contextId ?? item.id;
    this.pendingItem = item;
    this.preparing = true;
    this.wantPlaying = true;
    this.error = null;
    this.emit();
  }

  private cancelPrepare() {
    this.prepareGen += 1;
    this.preparing = false;
    this.pendingItem = null;
    this.wantPlaying = false;
    if (!this.currentItem()) this.contextId = null;
    this.stopAudible();
    this.emit();
  }

  /** Stop output now so a new play cannot overlap the previous stream. */
  private stopAudible() {
    this.loadGen += 1;
    this.moveGen += 1;
    this.endedHandled = true;
    this.advancing = true;
    this.ignoreEndUntil = Date.now() + 2000;
    this.abortWebSource();
    this.htmlBufferUnsub?.();
    this.htmlBufferUnsub = null;
    try {
      this.player?.pause();
    } catch {
      // Player may already be released.
    }
    silenceHtmlAudio();
  }

  private replaceSource(source: { uri: string; headers?: Record<string, string>; name?: string }) {
    try {
      this.player?.pause();
    } catch {
      // Player may already be released.
    }
    silenceHtmlAudio();
    this.player?.replace(source);
    silenceHtmlAudio(htmlMedia(this.player));
  }

  private playAllCap() {
    return resolvePlayAllLimit(useSettings.getState().playAllLimit);
  }

  private async tracksForItem(item: BaseItem): Promise<BaseItem[]> {
    const session = this.session;
    if (!session) return [];
    const api = createApi(session);
    const limit = this.playAllCap();
    const userId = session.userId;
    if (item.type === 'Playlist') {
      const cached = takeCachedTracks(
        queryClient.getQueryData<BaseItem[]>(queryKeys.playlistItems.detail(userId, item.id)),
        limit
      );
      if (cached) {
        emitNet({ method: 'GET', path: `/Playlists/${item.id}/Items`, ms: 0, cacheHit: true });
        return cached;
      }
      return queryClient.fetchQuery({
        queryKey: queryKeys.playlistItems.detail(userId, item.id),
        queryFn: () => fetchPlaylistTracks(api, item.id, Math.max(limit, 2000)),
      }).then((tracks) => tracks.slice(0, limit));
    }
    if (item.type === 'MusicAlbum') {
      const cached = takeCachedTracks(
        queryClient.getQueryData<BaseItem[]>(queryKeys.albumTracks.detail(userId, item.id)),
        limit
      );
      if (cached) {
        emitNet({ method: 'GET', path: `/Items`, ms: 0, cacheHit: true, action: 'album-play' });
        return cached;
      }
      return queryClient.fetchQuery({
        queryKey: queryKeys.albumTracks.detail(userId, item.id),
        queryFn: () => fetchAlbumTracks(api, item.id, Math.max(limit, 500)),
      }).then((tracks) => tracks.slice(0, limit));
    }
    if (item.type === 'MusicArtist') {
      const cached = takeCachedTracks(
        queryClient.getQueryData<BaseItem[]>(queryKeys.artistTracks.detail(userId, item.id)),
        limit
      );
      if (cached) {
        emitNet({ method: 'GET', path: `/Items`, ms: 0, cacheHit: true, action: 'artist-play' });
        return cached;
      }
      return queryClient.fetchQuery({
        queryKey: queryKeys.artistTracks.detail(userId, item.id),
        queryFn: () => fetchArtistTracks(api, item.id, Math.max(limit, 200)),
      }).then((tracks) => tracks.slice(0, limit));
    }
    return [];
  }

  private async tracksForMix(item: BaseItem): Promise<BaseItem[]> {
    const session = this.session;
    if (!session) return [];
    const api = createApi(session);
    const limit = this.playAllCap();
    if (isSrEnabled()) {
      try {
        const kind =
          item.type === 'MusicArtist' ? 'artist' : item.type === 'MusicAlbum' ? 'album' : 'track';
        const payload = await fetchSrRadio(kind, item.id, limit);
        const items = await hydrateSrTracks(session, payload);
        if (items.length) return items.filter(isAudio).slice(0, limit);
      } catch {
        // Fall through to Jellyfin InstantMix.
      }
    }
    const mix = await api.instantMix(item.id, limit);
    return (mix.items ?? []).filter(isAudio).slice(0, limit);
  }

  async playItemInContext(item: BaseItem, context: BaseItem[], options?: PlayItemsOptions) {
    const tracks = context.filter(isAudio);
    const index = tracks.findIndex((entry) => entry.id === item.id);
    await this.playItems(tracks.length ? tracks : [item], index >= 0 ? index : 0, options);
  }

  async playNext(item: BaseItem) {
    if (!isAudio(item)) {
      if (this.source.length === 0 || this.index < 0) await this.playItem(item);
      return;
    }
    if (this.source.length === 0 || this.index < 0) {
      await this.playItems([item], 0);
      return;
    }
    this.source = [...this.source, item];
    const sourceIndex = this.source.length - 1;
    const next = [...this.order];
    next.splice(this.index + 1, 0, sourceIndex);
    this.order = next;
    this.queued = null;
    this.emit();
  }

  enqueue(item: BaseItem) {
    if (!isAudio(item)) {
      if (this.source.length === 0) void this.playItem(item);
      return;
    }
    if (this.source.length === 0) {
      void this.playItems([item], 0);
      return;
    }
    this.source = [...this.source, item];
    this.order = [...this.order, this.source.length - 1];
    this.queued = null;
    this.emit();
  }

  async togglePlay() {
    if (this.preparing) {
      this.cancelPrepare();
      return;
    }
    if (!this.player) return;
    if (this.wantPlaying) {
      this.wantPlaying = false;
      silenceHtmlAudio(htmlMedia(this.player));
      this.player.pause();
      this.lastStatus = this.player.currentStatus
        ? { ...this.player.currentStatus, playing: false }
        : this.lastStatus;
      this.emit();
      await this.report('progress', true);
      this.emitSrTransport('PAUSE');
      return;
    }

    this.wantPlaying = true;
    this.emit();
    await this.applyPendingSeek();
    if (!this.player.isLoaded && this.currentItem()) {
      await this.loadCurrent(true, this.displayPosition());
      return;
    }
    await this.safePlay();
    this.lastStatus = this.player.currentStatus
      ? { ...this.player.currentStatus, playing: true }
      : this.lastStatus;
    this.emit();
    await this.report('progress', false);
    this.emitSrTransport('RESUME');
  }

  async pause() {
    this.wantPlaying = false;
    silenceHtmlAudio();
    this.player?.pause();
    await this.report('progress', true);
    this.emitSrTransport('PAUSE');
    this.emit();
  }

  async next() {
    return this.enqueueTransition((gen) => this.nextImpl(gen));
  }

  private enqueueTransition(work: (gen: number) => Promise<void>) {
    const gen = ++this.moveGen;
    const run = this.transition.then(() => {
      if (gen !== this.moveGen) return;
      return work(gen);
    });
    this.transition = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async nextImpl(gen: number) {
    if (this.order.length === 0) return;
    const leaving = this.currentItem();
    const pos = this.displayPosition();
    const dur = this.displayDuration();
    const naturalEnd = this.endedHandled;
    this.leaveCurrent(naturalEnd);
    if (this.repeat === 'one') {
      this.emitSrReplay(leaving);
      this.emitSrOnStart = false;
      this.endedHandled = false;
      this.advancing = false;
      this.wantPlaying = true;
      this.resetPlayhead = true;
      await this.seek(0);
      if (gen !== this.moveGen) return;
      await this.safePlay();
      return;
    }
    const last = this.index >= this.order.length - 1;
    if (last && this.repeat !== 'all') {
      const extended = await this.extendQueueFromSr();
      if (gen !== this.moveGen) return;
      if (extended) {
        this.releaseSession();
        this.index += 1;
        this.queued = null;
        this.wantPlaying = true;
        await this.loadCurrent(true);
        return;
      }
      this.quietStop();
      this.releaseSession();
      this.emit();
      return;
    }
    this.releaseSession();
    this.index = last ? 0 : this.index + 1;
    this.queued = null;
    this.wantPlaying = true;
    if (gen !== this.moveGen) return;
    await this.loadCurrent(true);
  }

  private leaveCurrent(naturalEnd = false) {
    const leaving = this.currentItem();
    if (!leaving || this.leftTrackId === leaving.id) return;
    this.leftTrackId = leaving.id;
    this.emitSrLeave(leaving, this.displayPosition(), this.displayDuration(), naturalEnd);
  }

  private emitSrTransport(eventType: 'PAUSE' | 'RESUME') {
    const item = this.currentItem();
    if (!item || !isSrEnabled()) return;
    postSrEventSafe({
      eventType,
      trackId: item.id,
      positionMs: this.displayPosition() * 1000,
      durationMs: this.displayDuration() * 1000,
    });
  }

  private emitSrLeave(item: BaseItem | null, position: number, duration: number, naturalEnd: boolean) {
    if (!item || !isSrEnabled()) return;
    postSrEventSafe({
      eventType: leaveEventType(position, duration, naturalEnd),
      trackId: item.id,
      positionMs: position * 1000,
      durationMs: duration * 1000,
    });
  }

  private emitSrReplay(item: BaseItem | null) {
    if (!item || !isSrEnabled()) return;
    postSrEventSafe({
      eventType: 'REPLAY',
      trackId: item.id,
      positionMs: 0,
      durationMs: this.displayDuration() * 1000,
    });
  }

  private async extendQueueFromSr(): Promise<boolean> {
    if (!this.continueWithSr || !isSrEnabled() || !this.session) return false;
    const current = this.currentItem();
    if (!current) return false;
    try {
      const payload = await fetchSrNext(current.id, 20);
      const tracks = await hydrateSrTracks(this.session, payload);
      const seen = new Set(this.source.map((item) => item.id));
      const extra = tracks.filter((item) => !seen.has(item.id));
      if (!extra.length) return false;
      for (const item of extra) {
        this.source = [...this.source, item];
        this.order = [...this.order, this.source.length - 1];
      }
      return true;
    } catch {
      return false;
    }
  }

  async previous() {
    if (this.order.length === 0) return;
    if (this.displayPosition() > 3) {
      await this.seek(0);
      return;
    }
    const first = this.index <= 0;
    if (first && this.repeat !== 'all') {
      await this.seek(0);
      return;
    }
    const target = first ? this.order.length - 1 : this.index - 1;
    return this.enqueueTransition(async (gen) => {
      if (this.index === target) return;
      this.leaveCurrent(false);
      this.releaseSession();
      this.index = target;
      this.queued = null;
      this.wantPlaying = true;
      this.resetPlayhead = true;
      if (gen !== this.moveGen) return;
      await this.loadCurrent(true);
    });
  }

  /** Lock-screen / headset next: skip the current track even when repeat-one is on. */
  async userNext() {
    if (this.order.length === 0) return;
    const last = this.index >= this.order.length - 1;
    if (!last) {
      await this.skipTo(this.index + 1);
      return;
    }
    if (this.repeat === 'all') {
      await this.skipTo(0);
      return;
    }
    await this.next();
  }

  async reloadCurrent() {
    if (!this.currentItem() || this.preparing) return;
    await this.loadCurrent(this.wantPlaying, this.displayPosition());
  }

  async skipTo(index: number) {
    if (index < 0 || index >= this.order.length) return;
    if (index === this.index) return;
    return this.enqueueTransition(async (gen) => {
      if (index === this.index) return;
      this.leaveCurrent(false);
      this.releaseSession();
      this.index = index;
      this.queued = null;
      this.wantPlaying = true;
      this.resetPlayhead = true;
      if (gen !== this.moveGen) return;
      await this.loadCurrent(true);
    });
  }

  async seek(seconds: number) {
    const duration = this.displayDuration();
    const target = Math.max(0, duration > 0 ? Math.min(seconds, Math.max(0, duration - 0.15)) : seconds);
    const resume = this.wantPlaying;
    this.ignoreEndUntil = Date.now() + 1600;
    this.endedHandled = true;
    this.pendingSeek = target;
    this.emit();

    const mediaTarget = Math.max(0, target - this.startOffset);
    const mediaBuf = this.mediaBufferedEnd();
    const inBuffer = mediaBuf != null && mediaTarget <= mediaBuf + 0.35;
    const canFileSeek = this.canNativeSeek() && this.startOffset <= 0.05;
    if (this.player && !this.player.currentStatus?.didJustFinish && (canFileSeek || inBuffer)) {
      const nativeTarget = canFileSeek ? target : mediaTarget;
      try {
        await this.player.seekTo(nativeTarget);
        const landed = this.player.currentTime;
        if (Number.isFinite(landed) && Math.abs(landed - nativeTarget) <= 1.25) {
          this.pendingSeek = 0;
          if (canFileSeek) this.startOffset = 0;
          this.lastStatus = this.player.currentStatus
            ? { ...this.player.currentStatus, currentTime: landed, didJustFinish: false }
            : this.lastStatus;
          this.endedHandled = false;
          this.lastPos = canFileSeek ? landed : this.startOffset + landed;
          this.lastPosAt = Date.now();
          if (resume) this.player.play();
          await this.report('progress', !resume);
          this.emit();
          return;
        }
      } catch {
        // Native seek did not land — reopen at startTimeTicks.
      }
    }

    await this.loadCurrent(resume, target);
    await this.report('progress', !resume);
  }

  async toggleShuffle() {
    if (this.source.length === 0) {
      this.shuffle = !this.shuffle;
      this.emit();
      return;
    }
    const sourceIndex = this.order[this.index] ?? 0;
    this.shuffle = !this.shuffle;
    if (this.shuffle) {
      this.order = shuffledOrder(this.source.length, sourceIndex);
      this.index = 0;
    } else {
      this.order = identityOrder(this.source.length);
      this.index = sourceIndex;
    }
    this.emit();
    await this.report('progress', !this.wantPlaying);
  }

  cycleRepeat() {
    this.repeat = this.repeat === 'off' ? 'all' : this.repeat === 'all' ? 'one' : 'off';
    // Native loop swallows ended() and leaves currentTime at duration across replace().
    // Repeat-one is handled in software so REPLAY fires and skip-to-next can start at 0.
    if (this.player) this.player.loop = false;
    this.emit();
  }

  removeAt(index: number) {
    if (index < 0 || index >= this.order.length) return;
    const sourceIndex = this.order[index];
    const removingCurrent = index === this.index;
    if (removingCurrent) this.leaveCurrent(false);
    if (this.order.length === 1) this.releaseSession();
    this.order = this.order.filter((_, i) => i !== index).map((si) => (si > sourceIndex ? si - 1 : si));
    this.source = this.source.filter((_, i) => i !== sourceIndex);
    if (this.source.length === 0) {
      this.index = -1;
      this.startOffset = 0;
      this.pendingSeek = 0;
      this.wantPlaying = false;
      silenceHtmlAudio();
      this.player?.pause();
      void this.clearPersisted();
      this.emit();
      return;
    }
    if (index < this.index) this.index -= 1;
    else if (removingCurrent) {
      this.index = Math.min(index, this.order.length - 1);
      this.wantPlaying = true;
      void this.loadCurrent(true);
      return;
    }
    this.emit();
  }

  move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= this.order.length || to >= this.order.length) return;
    const next = [...this.order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    if (this.index === from) this.index = to;
    else if (from < this.index && to >= this.index) this.index -= 1;
    else if (from > this.index && to <= this.index) this.index += 1;
    this.order = next;
    this.emit();
  }

  updateItem(item: BaseItem) {
    this.source = this.source.map((entry) => (sameId(entry.id, item.id) ? { ...entry, ...item } : entry));
    this.emit();
  }

  private currentItem(): BaseItem | null {
    const sourceIndex = this.order[this.index];
    if (sourceIndex == null) return null;
    return this.source[sourceIndex] ?? null;
  }

  private playQueue(): BaseItem[] {
    const next = this.order
      .map((sourceIndex) => this.source[sourceIndex])
      .filter((item): item is BaseItem => Boolean(item));
    if (
      this.queued &&
      this.queued.length === next.length &&
      this.queued.every((item, i) => item === next[i])
    ) {
      return this.queued;
    }
    this.queued = next;
    return next;
  }

  private mediaTime(): number {
    const raw = this.player?.currentTime ?? this.lastStatus?.currentTime ?? 0;
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  }

  private displayPosition(): number {
    const media = this.startOffset + this.mediaTime();
    if (this.resetPlayhead && this.mediaTime() > 1.25) {
      return Math.max(0, this.pendingSeek);
    }
    if (this.pendingSeek > 0.05 && this.mediaTime() + 1 < this.pendingSeek) {
      return this.pendingSeek;
    }
    return media;
  }

  private displayBuffered(): number {
    return this.bufferRange().end;
  }

  private displayBufferedStart(): number {
    return this.bufferRange().start;
  }

  /**
   * Loaded region in wall-clock track time.
   * Unknown native buffers stay at the playhead — never a fake lookahead.
   */
  private bufferRange(): { start: number; end: number } {
    const position = this.displayPosition();
    const duration = this.displayDuration();
    const item = this.currentItem();
    if (!item || duration <= 0) return { start: position, end: position };
    if (useDownloads.getState().isDownloaded(item.id)) return { start: 0, end: duration };

    const media = htmlMedia(this.player);
    if (!media) return { start: position, end: position };

    const mediaTime = this.mediaTime();
    const loaded = rangeContaining(media.buffered, mediaTime) ?? rangeContaining(media.seekable, mediaTime);
    if (!loaded) return { start: position, end: position };

    const start = Math.min(duration, Math.max(0, this.startOffset + loaded.start));
    const end = Math.min(duration, Math.max(position, this.startOffset + loaded.end));
    return { start: Math.min(start, end), end };
  }

  /** End of the buffered media-time range that contains the playhead, or null if unknown. */
  private mediaBufferedEnd(): number | null {
    const media = htmlMedia(this.player);
    if (!media) return null;
    const loaded = rangeContaining(media.buffered, this.mediaTime());
    return loaded ? loaded.end : null;
  }

  private abortWebSource(revokeNow = false) {
    this.sourceAbort?.abort();
    this.sourceAbort = null;
    const stale = this.sourceObjectUrl;
    this.sourceObjectUrl = null;
    if (revokeNow) revokeMediaSourceUrl(stale);
    return stale;
  }

  private releaseSession() {
    const sessionId = this.playSessionId;
    const item = this.currentItem();
    const positionTicks = secondsToTicks(this.displayPosition());
    const queue = this.playQueue().map((entry) => ({ id: entry.id }));
    this.playSessionId = null;
    if (!sessionId || !item) return;
    void this.enqueueReport(() => this.reportStopped(item, sessionId, positionTicks, queue));
  }

  private async safePlay() {
    try {
      await Promise.resolve(this.player?.play());
    } catch (error) {
      if (isAbortError(error)) return;
      throw error;
    }
  }

  private ensureSampling() {
    if (Platform.OS !== 'web' || !this.player || this.sampleUnsub || this.sampleListeners.size === 0) return;
    if (!this.player.isAudioSamplingSupported) return;
    try {
      this.player.setAudioSamplingEnabled(true);
      this.sampleUnsub = this.player.addListener('audioSampleUpdate', (sample: AudioSample) => {
        const frames = sample.channels[0]?.frames;
        if (!frames?.length) return;
        const levels = bandsFromFrames(frames, 5);
        this.sampleListeners.forEach((listener) => listener(levels));
      });
    } catch {
      this.sampleUnsub = null;
    }
  }

  private stopSampling() {
    try {
      this.sampleUnsub?.remove();
      this.player?.setAudioSamplingEnabled(false);
    } catch {
      // Sampling is optional.
    }
    this.sampleUnsub = null;
  }

  private emitBufferOnly() {
    const end = this.displayBuffered();
    if (Math.abs(end - this.lastEmittedBuffered) < 0.2) return;
    this.lastEmittedBuffered = end;
    this.revision += 1;
    const snap = this.snapshot();
    this.listeners.forEach((listener) => listener(snap));
  }

  private bindHtmlBufferWatch() {
    this.htmlBufferUnsub?.();
    this.htmlBufferUnsub = null;
    const media = htmlMedia(this.player);
    if (!media) return;
    try {
      media.preload = 'auto';
    } catch {
      // Some wrappers ignore preload.
    }
    const handler = () => this.emitBufferOnly();
    media.addEventListener('progress', handler);
    media.addEventListener('loadeddata', handler);
    media.addEventListener('canplay', handler);
    media.addEventListener('canplaythrough', handler);
    const timer = setInterval(handler, 350);
    this.htmlBufferUnsub = () => {
      media.removeEventListener('progress', handler);
      media.removeEventListener('loadeddata', handler);
      media.removeEventListener('canplay', handler);
      media.removeEventListener('canplaythrough', handler);
      clearInterval(timer);
    };
  }

  private displayDuration(): number {
    const fromItem = ticksToSeconds(this.currentItem()?.runTimeTicks);
    const raw = this.player?.duration ?? this.lastStatus?.duration ?? 0;
    const fromPlayer = Number.isFinite(raw) && raw > 1 ? raw : 0;
    if (this.startOffset > 0) {
      if (fromItem > 0) return fromItem;
      if (fromPlayer > 0) return fromPlayer + this.startOffset;
      return 0;
    }
    return fromPlayer > 1 ? fromPlayer : fromItem;
  }

  private canNativeSeek(): boolean {
    const item = this.currentItem();
    if (!item) return false;
    if (useDownloads.getState().isDownloaded(item.id)) return true;
    const playerDur = this.player?.duration ?? this.lastStatus?.duration ?? 0;
    if (!Number.isFinite(playerDur) || playerDur <= 1) return false;
    const itemDur = ticksToSeconds(item.runTimeTicks);
    if (itemDur > 1 && Math.abs(playerDur - itemDur) > 2.5) return false;
    return true;
  }

  private async applyPendingSeek() {
    const target = this.pendingSeek;
    if (!(target > 0.05) || !this.player) return;
    if (!this.canNativeSeek()) return;
    try {
      await this.player.seekTo(target);
      const landed = this.player.currentTime;
      if (!Number.isFinite(landed) || Math.abs(landed - target) > 1.25) {
        return;
      }
      this.pendingSeek = 0;
      this.startOffset = 0;
      this.lastStatus = this.player.currentStatus
        ? { ...this.player.currentStatus, currentTime: landed, didJustFinish: false }
        : this.lastStatus;
      this.lastPos = landed;
      this.lastPosAt = Date.now();
    } catch {
      // Keep pendingSeek; loadCurrent / seek will fall back to startTimeTicks.
    }
  }

  private quietStop() {
    this.wantPlaying = false;
    this.startOffset = 0;
    this.pendingSeek = 0;
    this.advancing = false;
    this.endedHandled = true;
    silenceHtmlAudio();
    try {
      this.player?.pause();
    } catch {
      // Player may already be released.
    }
    this.lastStatus = this.player?.currentStatus
      ? { ...this.player.currentStatus, playing: false, didJustFinish: false }
      : this.lastStatus;
  }

  private async advanceFromEnd() {
    if (this.endedHandled || this.advancing) return;
    this.endedHandled = true;
    this.advancing = true;
    this.startOffset = 0;
    this.pendingSeek = 0;
    this.ignoreEndUntil = Date.now() + 1500;
    await this.next();
  }

  private reachedEnd(status: AudioStatus): boolean {
    if (Date.now() < this.ignoreEndUntil) return false;
    if (this.resetPlayhead) return false;
    if (this.pendingSeek > 0.05) return false;
    if (status.didJustFinish) return true;
    if (!this.wantPlaying) return false;
    const dur = this.displayDuration();
    const pos = this.displayPosition();
    if (!(dur > 2) || !(pos > 0)) return false;
    const remain = dur - pos;
    if (remain > Math.max(0.35, dur * 0.012)) return false;
    return Date.now() - this.lastPosAt > 800 && Math.abs(pos - this.lastPos) < 0.08;
  }

  private async loadCurrent(autoplay: boolean, startSeconds = 0) {
    const session = this.session;
    const player = this.player;
    const item = this.currentItem();
    const gen = (this.loadGen += 1);
    this.wantPlaying = autoplay;
    if (!item) {
      this.advancing = false;
      this.wantPlaying = false;
      this.emit();
      return;
    }
    if (!session || !player) {
      this.emit();
      return;
    }

    this.error = null;
    this.advancing = true;
    this.endedHandled = true;
    this.ignoreEndUntil = Date.now() + 2500;
    this.lastPos = startSeconds;
    this.lastPosAt = Date.now();
    this.lastMediaTime = 0;
    this.lastStatus = null;
    this.resetPlayhead = startSeconds <= 0.05;
    if (gen !== this.loadGen) return;
    if (this.playSessionId) this.releaseSession();
    this.playSessionId = createPlaySessionId();
    this.reportedStartFor = null;
    this.leftTrackId = null;

    const downloaded = useDownloads.getState().isDownloaded(item.id)
      ? useDownloads.getState().items[item.id]
      : undefined;
    const quality = useSettings.getState().quality;
    const start = Math.max(0, startSeconds);
    this.pendingSeek = start;
    const preferFileSeek = Boolean(downloaded) || (Platform.OS !== 'web' && quality === 'original');
    this.startOffset = preferFileSeek || start <= 0.05 ? 0 : start;
    const staleUrl = this.abortWebSource();
    this.lastEmittedBuffered = -1;

    const uri =
      downloaded?.uri ??
      streamUrl(session, item.id, quality, {
        startTimeTicks: this.startOffset > 0.05 ? secondsToTicks(this.startOffset) : undefined,
        playSessionId: this.playSessionId,
      });
    const headers = downloaded || Platform.OS === 'web' ? undefined : streamHeaders(session);

    const useDirect = (reason?: unknown) => {
      if (gen !== this.loadGen) return;
      revokeMediaSourceUrl(this.sourceObjectUrl);
      this.sourceObjectUrl = null;
      try {
        this.replaceSource({ uri, headers, name: item.name });
        if (this.wantPlaying) void this.safePlay();
        else player.pause();
        this.bindHtmlBufferWatch();
      } catch (error) {
        if (!isAbortError(error) && reason) {
          this.error = error instanceof Error ? error.message : 'Unable to start playback';
          this.emit();
        }
      }
    };

    try {
      player.loop = false;
      if (gen !== this.loadGen) {
        revokeMediaSourceUrl(staleUrl);
        return;
      }

      const handle =
        !downloaded && Platform.OS === 'web' && canPumpMp3() ? createMediaSourceHandle() : null;

      if (handle) {
        this.sourceAbort = new AbortController();
        this.sourceObjectUrl = handle.objectUrl;
        const abort = this.sourceAbort;
        let gotChunk = false;
        this.replaceSource({ uri: handle.objectUrl, name: item.name });
        revokeMediaSourceUrl(staleUrl);
        void pumpIntoMediaSource({
          mediaSource: handle.mediaSource,
          url: uri,
          mime: handle.mime,
          signal: abort.signal,
          onProgress: () => {
            if (gen !== this.loadGen || abort.signal.aborted) return;
            const first = !gotChunk;
            gotChunk = true;
            if (first && this.wantPlaying) void this.safePlay();
            this.emitBufferOnly();
          },
        }).catch((error) => {
          if (abort.signal.aborted || gen !== this.loadGen) return;
          if (isAbortError(error)) return;
          if (gotChunk) return;
          useDirect(error);
        });
      } else {
        this.replaceSource({
          uri,
          headers,
          name: item.name,
        });
        revokeMediaSourceUrl(staleUrl);
        if (preferFileSeek && start > 0.05) {
          try {
            await player.seekTo(start);
            const landed = player.currentTime;
            if (Number.isFinite(landed) && Math.abs(landed - start) <= 1.25) {
              this.pendingSeek = 0;
              this.startOffset = 0;
              this.resetPlayhead = false;
            }
          } catch {
            // Status handler will retry via resetPlayhead / pendingSeek.
          }
        }
        if (gen !== this.loadGen) return;
        if (autoplay) await this.safePlay();
        else player.pause();
      }
      if (gen !== this.loadGen) return;
      this.bindHtmlBufferWatch();
      this.applyLockScreen(item);
      useRecents.getState().touch(item);
      this.emit();
    } catch (error) {
      revokeMediaSourceUrl(staleUrl);
      if (gen !== this.loadGen) return;
      if (isAbortError(error)) return;
      this.advancing = false;
      this.wantPlaying = false;
      this.error = error instanceof Error ? error.message : 'Unable to start playback';
      this.emit();
    }
  }

  private applyLockScreen(item: BaseItem) {
    const session = this.session;
    const player = this.player;
    if (!session || !player) return;
    const artworkUrl = imageUrl(session, item, 600) ?? undefined;
    player.setActiveForLockScreen(true, {
      title: item.name,
      artist: artistLine(item),
      albumTitle: item.album,
      artworkUrl,
    });
    bindMediaSessionSkip(this);
  }

  private onStatus(status: AudioStatus) {
    if (status.error) {
      this.error = status.error;
    }

    const requestedStart = this.startOffset > 0.05 ? this.startOffset : 0;
    const stuck = playheadLooksStuckAtEnd(
      status.currentTime,
      status.duration,
      status.didJustFinish,
      requestedStart
    );
    if (this.resetPlayhead && stuck && Date.now() < this.ignoreEndUntil) {
      if (this.player) {
        void Promise.resolve(this.player.seekTo(0))
          .then(() => {
            if (this.wantPlaying) this.player?.play();
          })
          .catch(() => {});
      }
      this.emit();
      return;
    }
    if (this.resetPlayhead && !status.didJustFinish && status.currentTime <= 1.25) {
      this.resetPlayhead = false;
    }

    const prevMedia = this.lastMediaTime;
    this.lastMediaTime = Number.isFinite(status.currentTime) ? status.currentTime : 0;
    if (
      this.repeat === 'one' &&
      !this.advancing &&
      !this.resetPlayhead &&
      !status.didJustFinish &&
      isNativeLoopWrap(prevMedia, this.lastMediaTime, this.displayDuration() || status.duration)
    ) {
      const item = this.currentItem();
      this.emitSrLeave(item, prevMedia, this.displayDuration() || status.duration, true);
      this.emitSrReplay(item);
      this.emitSrOnStart = false;
      this.reportedStartFor = item?.id ?? this.reportedStartFor;
    }

    this.lastStatus = status;
    this.syncWantPlayingFromStatus(status);

    const pos = this.displayPosition();
    if (Math.abs(pos - this.lastPos) >= 0.08) {
      this.lastPos = pos;
      this.lastPosAt = Date.now();
    }

    if (this.advancing && status.playing && !status.didJustFinish && status.currentTime > 0.12) {
      this.advancing = false;
      this.endedHandled = false;
      this.resetPlayhead = false;
    }

    if (status.isLoaded && this.pendingSeek > 0.05 && !status.didJustFinish) {
      if (this.canNativeSeek()) {
        void this.applyPendingSeek();
      } else if (this.startOffset > 0.05 || status.duration <= 1) {
        this.pendingSeek = 0;
      }
    }

    if (this.reachedEnd(status)) {
      void this.advanceFromEnd();
      this.emit();
      return;
    }

    const now = Date.now();
    if (this.wantPlaying && status.playing && now - this.lastProgressAt > 10_000) {
      this.lastProgressAt = now;
      void this.report('progress', false);
    }
    if (this.wantPlaying && status.playing && this.reportedStartFor !== this.currentItem()?.id) {
      void this.report('start');
    }
    this.emit();
  }

  private enqueueReport(work: () => Promise<void>) {
    this.reportChain = this.reportChain.then(work, work);
    return this.reportChain;
  }

  private async report(kind: 'start' | 'progress', paused?: boolean) {
    const session = this.session;
    const item = this.currentItem();
    const playSessionId = this.playSessionId;
    if (!session || !item || !playSessionId) return;
    const isPaused = paused ?? !this.wantPlaying;
    await this.enqueueReport(async () => {
      if (this.playSessionId !== playSessionId) return;
      if (this.session?.accessToken !== session.accessToken) return;
      const api = createApi(session);
      const positionTicks = secondsToTicks(this.displayPosition());
      const queue = this.playQueue().map((entry) => ({ id: entry.id }));
      const quality = useSettings.getState().quality;
      const localFile = useDownloads.getState().isDownloaded(item.id);
      const playMethod: PlayMethod =
        localFile || (Platform.OS !== 'web' && quality === 'original') ? 'DirectPlay' : 'Transcode';
      const body = buildPlayingBody({
        kind,
        itemId: item.id,
        playSessionId,
        isPaused,
        canSeek: localFile || this.startOffset <= 0.05,
        positionTicks,
        playMethod,
        repeatMode: jellyfinRepeat(this.repeat),
        playbackOrder: (this.shuffle ? 'Shuffle' : 'Default') as PlaybackOrder,
        queue,
      });
      try {
        if (kind === 'start') {
          await api.reportPlaying(body);
          this.reportedStartFor = item.id;
          if (this.emitSrOnStart) {
            postSrEventSafe({
              eventType: 'PLAY_START',
              trackId: item.id,
              positionMs: this.displayPosition() * 1000,
              durationMs: this.displayDuration() * 1000,
            });
          }
          this.emitSrOnStart = true;
        } else {
          await api.reportProgress(body);
        }
      } catch {
        // Reporting is best-effort; streaming still works without it.
      }
    });
  }

  private syncWantPlayingFromStatus(status: AudioStatus) {
    if (this.advancing || this.preparing || this.resetPlayhead) return;
    if (!status.isLoaded || status.didJustFinish || status.isBuffering) return;
    if (this.pendingSeek > 0.05) return;
    if (this.wantPlaying === status.playing) return;
    this.wantPlaying = status.playing;
    bindMediaSessionSkip(this);
    if (status.playing) {
      void this.report('progress', false);
      this.emitSrTransport('RESUME');
    } else {
      void this.report('progress', true);
      this.emitSrTransport('PAUSE');
    }
  }

  private async reportStopped(
    item: BaseItem,
    playSessionId: string,
    positionTicks: number,
    queue: { id: string }[]
  ) {
    const session = this.session;
    if (!session) return;
    const api = createApi(session);
    try {
      await api.reportStopped({
        itemId: item.id,
        playSessionId,
        positionTicks,
        nowPlayingQueue: queue,
      });
    } catch {
      // Best-effort.
    }
  }

  private emit() {
    this.revision += 1;
    const snap = this.snapshot();
    this.listeners.forEach((listener) => listener(snap));
    this.schedulePersist();
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    const gen = this.persistGen;
    this.persistTimer = setTimeout(() => {
      void this.persist(gen);
    }, 600);
  }

  private async persist(gen = this.persistGen) {
    if (gen !== this.persistGen) return;
    if (this.source.length === 0) {
      await this.clearPersisted();
      return;
    }
    const payload: PersistedPlayback = {
      source: this.source,
      order: this.order,
      index: this.index,
      shuffle: this.shuffle,
      repeat: this.repeat,
      position: this.displayPosition(),
      contextId: this.contextId,
      continueWithSr: this.continueWithSr,
      userId: this.session?.userId,
      serverId: this.session?.serverId,
      serverUrl: this.session?.serverUrl,
    };
    try {
      await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
      if (gen !== this.persistGen && this.source.length === 0) {
        await AsyncStorage.removeItem(PERSIST_KEY);
      }
    } catch {
      // Persistence is best-effort.
    }
  }

  private async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedPlayback;
      if (!Array.isArray(saved.source) || saved.source.length === 0) return;
      if (this.source.length > 0) return;
      const session = this.session;
      if (saved.userId && session?.userId && saved.userId !== session.userId) return;
      if (saved.serverId && session?.serverId && saved.serverId !== session.serverId) return;
      if (!saved.serverId && saved.serverUrl && session?.serverUrl && saved.serverUrl !== session.serverUrl) return;
      this.source = saved.source;
      this.order =
        Array.isArray(saved.order) && saved.order.length === saved.source.length
          ? saved.order
          : identityOrder(saved.source.length);
      this.index = Math.max(0, Math.min(saved.index ?? 0, this.order.length - 1));
      this.shuffle = Boolean(saved.shuffle);
      this.repeat = saved.repeat === 'all' || saved.repeat === 'one' ? saved.repeat : 'off';
      const duration = ticksToSeconds(this.currentItem()?.runTimeTicks);
      const position = Math.max(0, saved.position ?? 0);
      this.restorePosition = duration > 0 && position > duration - 2 ? 0 : position;
      this.contextId = saved.contextId ?? null;
      this.continueWithSr = Boolean(saved.continueWithSr);
      this.wantPlaying = false;
    } catch {
      // Ignore a corrupt snapshot.
    }
  }

  private async clearPersisted() {
    this.persistGen += 1;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      await AsyncStorage.removeItem(PERSIST_KEY);
    } catch {
      // Ignore.
    }
  }
}

export const playback = new PlaybackEngine();

export { emptySnapshot };
