import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BaseItem } from '@/api/types';
import { useFavoriteMutation } from '@/api/hooks';
import { ActionSheet } from '@/components/ActionSheet';
import { CoverArt } from '@/components/CoverArt';
import { IconButton } from '@/components/IconButton';
import { LyricsCard } from '@/components/LyricsCard';
import { SeekBar } from '@/components/SeekBar';
import { SpectrumBars } from '@/components/SpectrumBars';
import { useTrackActions } from '@/components/useTrackActions';
import { spacing } from '@/constants/theme';
import { SheetGrabber, useSwipeDownClose } from '@/hooks/use-swipe-down-close';
import { resolveDeviceName } from '@/lib/device';
import { artistLine } from '@/lib/format';
import { colorFromId } from '@/lib/hash-color';
import { closeOverlay } from '@/lib/navigation';
import { neighborIndex } from '@/lib/queue';
import { usePlayer } from '@/store/player';
import { useSettings } from '@/store/settings';
import { useColors } from '@/theme/useColors';

const QUALITY_LABEL: Record<string, string> = {
  original: 'Original',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

function playingFrom(
  contextId: string | null,
  current: BaseItem
): { kicker: string; label: string; href?: Href } {
  if (contextId === 'likes') {
    return { kicker: 'Playing from', label: 'Liked Songs', href: '/(app)/(tabs)/likes' };
  }
  if (contextId === 'downloads') {
    return { kicker: 'Playing from', label: 'Downloads', href: '/downloads' };
  }
  if (contextId === 'library') {
    return { kicker: 'Playing from', label: 'Your Library', href: '/(app)/(tabs)/library' };
  }
  if (contextId === 'search') {
    return { kicker: 'Playing from', label: 'Search', href: '/(app)/(tabs)/search' };
  }
  if (contextId?.startsWith('radio:')) {
    const id = contextId.slice(6);
    return {
      kicker: 'Playing from',
      label: 'Radio',
      href: { pathname: '/radio/[id]', params: { id } },
    };
  }
  if (contextId?.startsWith('mix:')) {
    const id = contextId.slice(4);
    return {
      kicker: 'Playing from',
      label: 'Mix',
      href: { pathname: '/artist/[id]', params: { id } },
    };
  }
  if (contextId && current.albumId && contextId === current.albumId) {
    return {
      kicker: 'Playing from',
      label: current.album ?? 'Album',
      href: { pathname: '/album/[id]', params: { id: current.albumId } },
    };
  }
  if (contextId && contextId !== current.id) {
    const artistMatch =
      current.artistItems?.some((entry) => entry.id === contextId) ||
      current.albumArtists?.some((entry) => entry.id === contextId);
    if (artistMatch) {
      return {
        kicker: 'Playing from',
        label: current.albumArtist ?? current.artists?.[0] ?? 'Artist',
        href: { pathname: '/artist/[id]', params: { id: contextId } },
      };
    }
    return {
      kicker: 'Playing from',
      label: 'Playlist',
      href: { pathname: '/playlist/[id]', params: { id: contextId } },
    };
  }
  if (current.albumId) {
    return {
      kicker: 'Now playing',
      label: current.album ?? 'Queue',
      href: { pathname: '/album/[id]', params: { id: current.albumId } },
    };
  }
  return { kicker: 'Now playing', label: 'Queue' };
}

function bumpSkip() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const current = usePlayer((s) => s.current);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const contextId = usePlayer((s) => s.contextId);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const preparing = usePlayer((s) => s.preparing);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const bufferedStart = usePlayer((s) => s.bufferedStart);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const error = usePlayer((s) => s.error);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const previous = usePlayer((s) => s.previous);
  const seek = usePlayer((s) => s.seek);
  const skipTo = usePlayer((s) => s.skipTo);
  const next = usePlayer((s) => s.next);
  const continueWithSr = usePlayer((s) => s.continueWithSr);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const quality = useSettings((s) => s.quality);
  const favorite = useFavoriteMutation();
  const actions = useTrackActions();
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const wrap = repeat === 'all';
  const prevIndex = current ? neighborIndex(index, queue.length, -1, wrap) : null;
  const nextIndex = current ? neighborIndex(index, queue.length, 1, wrap) : null;
  const canNext = nextIndex != null || Boolean(continueWithSr);
  const liked = Boolean(current?.userData?.isFavorite);
  const artistId = current?.artistItems?.[0]?.id ?? current?.albumArtists?.[0]?.id;
  const source = current ? playingFrom(contextId, current) : null;
  const device = resolveDeviceName();
  const artSize = Math.round(Math.min(width - 64, Math.max(196, height * 0.34), 328));
  const wash = current ? colorFromId(current.id) : c.bg;

  const pageW = useSharedValue(artSize);
  const dragX = useSharedValue(0);
  const canPrevSv = useSharedValue(0);
  const canNextSv = useSharedValue(0);

  useEffect(() => {
    canPrevSv.value = prevIndex != null ? 1 : 0;
    canNextSv.value = canNext ? 1 : 0;
  }, [canNext, canNextSv, canPrevSv, prevIndex]);

  useEffect(() => {
    dragX.value = 0;
    pageW.value = artSize;
  }, [artSize, current?.id, dragX, pageW]);

  useEffect(() => {
    setLyricsOpen(false);
  }, [current?.id]);

  const close = () => {
    dragX.value = 0;
    closeOverlay(router);
  };
  const { gesture: dismissPan, style: sheetStyle } = useSwipeDownClose(close);
  const goPrevTrack = () => {
    if (prevIndex == null) return;
    bumpSkip();
    void skipTo(prevIndex);
  };
  const goNextTrack = () => {
    bumpSkip();
    if (nextIndex != null) {
      void skipTo(nextIndex);
      return;
    }
    if (continueWithSr) void next();
  };

  const skipPan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      const w = Math.max(1, pageW.value);
      let x = e.translationX;
      if (x > 0 && !canPrevSv.value) x *= 0.22;
      if (x < 0 && !canNextSv.value) x *= 0.22;
      dragX.value = Math.max(-w * 0.92, Math.min(w * 0.92, x));
    })
    .onEnd((e) => {
      const w = Math.max(1, pageW.value);
      const threshold = Math.min(80, w * 0.24);
      if ((e.translationX < -threshold || e.velocityX < -650) && canNextSv.value) {
        dragX.value = withTiming(-w, { duration: 160 }, (done) => {
          if (!done) return;
          runOnJS(goNextTrack)();
          dragX.value = 0;
        });
        return;
      }
      if ((e.translationX > threshold || e.velocityX > 650) && canPrevSv.value) {
        dragX.value = withTiming(w, { duration: 160 }, (done) => {
          if (!done) return;
          runOnJS(goPrevTrack)();
          dragX.value = 0;
        });
        return;
      }
      dragX.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageW.value + dragX.value }],
  }));

  if (!current) {
    return (
      <Animated.View style={[styles.screen, sheetStyle, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}>
        <GestureDetector gesture={dismissPan}>
          <View>
            <SheetGrabber color={c.textMuted} />
            <View style={styles.topBar}>
              <IconButton name="chevron-down" accessibilityLabel="Close" onPress={close} />
              <View style={{ width: 24 }} />
            </View>
          </View>
        </GestureDetector>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing is playing</Text>
        <Text style={[styles.emptySub, { color: c.textSub }]}>Play a song from your library.</Text>
        <Pressable
          onPress={close}
          style={[styles.emptyBtn, { backgroundColor: c.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Text style={[styles.emptyBtnText, { color: c.onAccent }]}>Back</Text>
        </Pressable>
      </Animated.View>
    );
  }

  const prevItem = prevIndex != null ? queue[prevIndex] : null;
  const nextItem = nextIndex != null ? queue[nextIndex] : null;
  const repeatLabel = repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off';

  return (
    <Animated.View
      style={[
        styles.screen,
        sheetStyle,
        { backgroundColor: c.bg, paddingTop: insets.top + 2, paddingBottom: insets.bottom + 10 },
      ]}>
      <LinearGradient colors={[wash, c.bg]} style={styles.wash} pointerEvents="none" />
      <GestureDetector gesture={dismissPan}>
        <View>
          <SheetGrabber color={c.textMuted} />
          <View style={styles.topBar}>
            <IconButton name="chevron-down" accessibilityLabel="Close" onPress={close} />
            <Pressable
              disabled={!source?.href}
              onPress={() => source?.href && router.push(source.href)}
              style={styles.nowWrap}
              accessibilityRole={source?.href ? 'button' : undefined}
              accessibilityLabel={source ? `${source.kicker} ${source.label}` : 'Now playing'}>
              <Text style={[styles.kicker, { color: c.textMuted }]}>{source?.kicker}</Text>
              <Text style={[styles.now, { color: c.text }]} numberOfLines={1}>
                {source?.label}
                {queue.length > 1 ? ` · ${index + 1} of ${queue.length}` : ''}
              </Text>
            </Pressable>
            <IconButton
              name="ellipsis-horizontal"
              accessibilityLabel="More"
              onPress={() => actions.open(current)}
            />
          </View>

          <GestureDetector gesture={skipPan}>
            <View
              style={[
                styles.artLift,
                styles.artFrame,
                { width: artSize, height: artSize },
                Platform.OS === 'web' ? webPan : null,
              ]}
              onLayout={(e) => {
                pageW.value = Math.max(1, e.nativeEvent.layout.width);
              }}
              accessibilityRole="adjustable"
              accessibilityLabel="Album art. Swipe for previous or next track"
              accessibilityActions={[
                ...(prevIndex != null ? [{ name: 'decrement' as const, label: 'Previous track' }] : []),
                ...(nextIndex != null ? [{ name: 'increment' as const, label: 'Next track' }] : []),
              ]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'decrement') goPrevTrack();
                if (event.nativeEvent.actionName === 'increment') goNextTrack();
              }}>
              <Animated.View style={[styles.artSlider, sliderStyle]}>
                <ArtSlide item={prevItem} size={artSize} dimmed />
                <ArtSlide item={current} size={artSize} />
                <ArtSlide item={nextItem} size={artSize} dimmed />
              </Animated.View>
            </View>
          </GestureDetector>

          <View style={styles.meta}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                {current.name}
              </Text>
              {artistId ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artistId } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open artist ${artistLine(current)}`}>
                  <Text style={[styles.artist, { color: c.textSub }]} numberOfLines={1}>
                    {artistLine(current)}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.artist, { color: c.textSub }]} numberOfLines={1}>
                  {artistLine(current)}
                </Text>
              )}
            </View>
            <IconButton
              name={liked ? 'heart' : 'heart-outline'}
              color={liked ? c.accent : c.text}
              size={26}
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              onPress={() => favorite.mutate({ item: current, favorite: !liked })}
            />
          </View>
        </View>
      </GestureDetector>

      <View style={{ paddingHorizontal: spacing.xl }}>
        <SeekBar
          position={position}
          duration={duration}
          playing={playing && !preparing}
          buffered={buffered}
          bufferedStart={bufferedStart}
          onSeek={(s) => void seek(s)}
        />
        {error ? <Text style={[styles.status, { color: c.danger }]}>{error}</Text> : null}
        {preparing && !error ? <Text style={[styles.status, { color: c.textSub }]}>Loading…</Text> : null}
      </View>

      <View style={styles.controls}>
        <IconButton
          name="shuffle"
          color={shuffle ? c.accent : c.textSub}
          accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
          onPress={() => void toggleShuffle()}
        />
        <IconButton
          name="play-skip-back"
          size={36}
          accessibilityLabel="Previous"
          onPress={() => void previous()}
        />
        <Pressable
          onPress={() => void togglePlay()}
          style={({ pressed }) => [
            styles.bigPlay,
            styles.playLift,
            { backgroundColor: c.text, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={preparing ? 'Cancel' : playing ? 'Pause' : 'Play'}>
          {preparing || (buffering && !playing) ? (
            <ActivityIndicator color={c.bg} />
          ) : (
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={34}
              color={c.bg}
              style={playing ? undefined : styles.playNudge}
            />
          )}
        </Pressable>
        <IconButton
          name="play-skip-forward"
          size={36}
          color={canNext ? c.text : c.textMuted}
          disabled={!canNext}
          accessibilityLabel="Next"
          onPress={goNextTrack}
        />
        <IconButton
          name="list"
          color={c.textSub}
          accessibilityLabel="Queue"
          onPress={() => router.push('/queue')}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.device}
          accessibilityRole="button"
          accessibilityLabel={`Playing on ${device}`}>
          <SpectrumBars playing={playing && !preparing && !error} color={playing ? c.accent : c.textMuted} height={16} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.deviceName, { color: c.text }]} numberOfLines={1}>
              {device}
            </Text>
            <Text style={[styles.deviceSub, { color: c.textMuted }]} numberOfLines={1}>
              {QUALITY_LABEL[quality] ?? quality}
            </Text>
          </View>
        </Pressable>
        <View>
          <IconButton
            name={repeat === 'one' ? 'repeat' : 'repeat'}
            color={repeat === 'off' ? c.textSub : c.accent}
            accessibilityLabel={repeatLabel}
            onPress={cycleRepeat}
          />
          {repeat === 'one' ? <Text style={[styles.one, { color: c.accent }]}>1</Text> : null}
        </View>
        <IconButton
          name="chatbubble-ellipses-outline"
          color={lyricsOpen ? c.accent : c.textSub}
          accessibilityLabel={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
          onPress={() => setLyricsOpen((open) => !open)}
        />
      </View>

      <LyricsCard open={lyricsOpen} onClose={() => setLyricsOpen(false)} />

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        subtitle={artistLine(actions.target ?? current)}
        actions={actions.actions}
        onClose={actions.close}
      />
    </Animated.View>
  );
}

function ArtSlide({
  item,
  size,
  dimmed = false,
}: {
  item: BaseItem | null | undefined;
  size: number;
  dimmed?: boolean;
}) {
  return (
    <View style={[styles.artSlide, { width: size, height: size }, dimmed && { opacity: 0.4 }]}>
      {item ? <CoverArt item={item} size={size} /> : null}
    </View>
  );
}

const webPan = { touchAction: 'none' } as Record<string, string>;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '46%',
    opacity: 0.55,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  nowWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  now: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
  artLift: {
    ...Platform.select({
      web: { boxShadow: '0 16px 40px rgba(0,0,0,0.35)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
      },
    }),
  },
  artFrame: {
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 22,
    overflow: 'hidden',
    borderRadius: 8,
  },
  artSlider: { flexDirection: 'row', width: '300%', height: '100%' },
  artSlide: { alignItems: 'center', justifyContent: 'center' },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: 10,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  artist: { fontSize: 15, marginTop: 4 },
  status: { fontSize: 12, marginTop: 4 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: 8,
  },
  bigPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLift: {
    ...Platform.select({
      web: { boxShadow: '0 8px 20px rgba(0,0,0,0.28)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      },
    }),
  },
  playNudge: { marginLeft: 3 },
  one: { position: 'absolute', right: -2, top: -4, fontSize: 10, fontWeight: '900' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: 16,
    gap: 12,
  },
  device: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: { fontSize: 13, fontWeight: '700' },
  deviceSub: { fontSize: 11, marginTop: 1 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 64 },
  emptySub: { fontSize: 15, textAlign: 'center', marginTop: 8 },
  emptyBtn: {
    alignSelf: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyBtnText: { fontWeight: '800' },
});
