import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { CoverArt } from '@/components/CoverArt';
import { GlassSurface } from '@/components/GlassSurface';
import { IconButton } from '@/components/IconButton';
import { ProgressTrack } from '@/components/ProgressTrack';
import { MINI_PLAYER_HEIGHT, radii, spacing, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useSmoothProgress } from '@/hooks/use-smooth-progress';
import { hideAppChrome } from '@/lib/chrome';
import { hexAlpha } from '@/lib/color';
import { artistLine } from '@/lib/format';
import { neighborIndex } from '@/lib/queue';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

const ART = 56;

/** Bottom inset so content clears the persistent now-playing bar and tab bar. */
export function useNowPlayingPadding(extra = 24): number {
  const insets = useSafeAreaInsets();
  const current = usePlayer((s) => s.current);
  const bar = current ? MINI_PLAYER_HEIGHT + 12 : 0;
  const chrome = TAB_BAR_HEIGHT + Math.max(insets.bottom, 6);
  return chrome + bar + extra;
}

/** Floats above the persistent tab bar; hidden on the full player and other modals. */
export function NowPlayingBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const current = usePlayer((s) => s.current);
  if (!current || hideAppChrome(pathname)) return null;
  const bottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 6);
  return (
    <View style={[styles.slot, styles.slotPass, { bottom }]}>
      <View style={styles.lift}>
        <MiniPlayer />
      </View>
    </View>
  );
}

function bumpSkip() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}

export function MiniPlayer() {
  const router = useRouter();
  const c = useColors();
  const current = usePlayer((s) => s.current);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const repeat = usePlayer((s) => s.repeat);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const preparing = usePlayer((s) => s.preparing);
  const error = usePlayer((s) => s.error);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const bufferedStart = usePlayer((s) => s.bufferedStart);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const skipTo = usePlayer((s) => s.skipTo);
  const next = usePlayer((s) => s.next);
  const continueWithSr = usePlayer((s) => s.continueWithSr);

  const progress = useSmoothProgress(position, duration, playing && !preparing);
  const pageW = useSharedValue(1);
  const dragX = useSharedValue(0);
  const canPrevSv = useSharedValue(0);
  const canNextSv = useSharedValue(0);

  const wrap = repeat === 'all';
  const prevIndex = neighborIndex(index, queue.length, -1, wrap);
  const nextIndex = neighborIndex(index, queue.length, 1, wrap);
  const prevItem = prevIndex != null ? queue[prevIndex] : null;
  const nextItem = nextIndex != null ? queue[nextIndex] : null;
  const canNext = nextIndex != null || Boolean(continueWithSr);

  useEffect(() => {
    canPrevSv.value = prevIndex != null ? 1 : 0;
    canNextSv.value = canNext ? 1 : 0;
  }, [canNext, canNextSv, canPrevSv, prevIndex]);

  useEffect(() => {
    dragX.value = 0;
  }, [current?.id, dragX]);

  const openPlayer = () => router.push('/player');
  const openQueue = () => router.push('/queue');
  const goPrev = () => {
    if (prevIndex == null) return;
    bumpSkip();
    void skipTo(prevIndex);
  };
  const goNext = () => {
    bumpSkip();
    if (nextIndex != null) {
      void skipTo(nextIndex);
      return;
    }
    if (continueWithSr) void next();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const w = Math.max(1, pageW.value);
      let x = e.translationX;
      if (x > 0 && !canPrevSv.value) x *= 0.22;
      if (x < 0 && !canNextSv.value) x *= 0.22;
      const max = w * 0.92;
      dragX.value = Math.max(-max, Math.min(max, x));
    })
    .onEnd((e) => {
      const w = Math.max(1, pageW.value);
      const threshold = Math.min(72, w * 0.28);
      const toNext = e.translationX < -threshold || e.velocityX < -650;
      const toPrev = e.translationX > threshold || e.velocityX > 650;
      if (toNext && canNextSv.value) {
        dragX.value = withTiming(-w, { duration: 160 }, (done) => {
          if (!done) return;
          runOnJS(goNext)();
          dragX.value = 0;
        });
        return;
      }
      if (toPrev && canPrevSv.value) {
        dragX.value = withTiming(w, { duration: 160 }, (done) => {
          if (!done) return;
          runOnJS(goPrev)();
          dragX.value = 0;
        });
        return;
      }
      dragX.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const longPress = Gesture.LongPress()
    .minDuration(420)
    .onStart(() => {
      runOnJS(openQueue)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(openPlayer)();
  });

  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageW.value + dragX.value }],
  }));

  if (!current) return null;

  const track = queue.length > 1 && index >= 0 ? `${index + 1} of ${queue.length}` : 'Now playing';
  const subtitle = error ? error : preparing ? 'Loading…' : artistLine(current) || track;
  const bufferColor = hexAlpha(c.accent, c.isDark ? 0.38 : 0.3);
  const trackColor = c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';

  return (
    <GlassSurface style={[styles.wrap, { borderColor: c.hairline }]}>
      <View style={styles.row}>
        <GestureDetector gesture={Gesture.Exclusive(pan, longPress, tap)}>
          <View
            style={[styles.swipe, Platform.OS === 'web' ? webPan : null]}
            onLayout={(e) => {
              pageW.value = Math.max(1, e.nativeEvent.layout.width);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${current.name}. ${subtitle}. ${track}. Tap for now playing, long press for queue`}
            accessibilityHint="Swipe to change tracks"
            accessibilityActions={[
              ...(prevIndex != null ? [{ name: 'decrement' as const, label: 'Previous track' }] : []),
              ...(nextIndex != null ? [{ name: 'increment' as const, label: 'Next track' }] : []),
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'decrement') goPrev();
              if (event.nativeEvent.actionName === 'increment') goNext();
            }}>
            <Animated.View style={[styles.slider, sliderStyle]}>
              <MiniSlide item={prevItem} dimmed />
              <MiniSlide item={current} subtitle={subtitle} danger={Boolean(error)} />
              <MiniSlide item={nextItem} dimmed />
            </Animated.View>
          </View>
        </GestureDetector>
        <Pressable
          onPress={() => void togglePlay()}
          accessibilityRole="button"
          accessibilityLabel={preparing ? 'Cancel' : playing ? 'Pause' : 'Play'}
          hitSlop={4}
          style={({ pressed }) => [styles.play, { backgroundColor: c.accent, opacity: pressed ? 0.82 : 1 }]}>
          {preparing || (buffering && !playing) ? (
            <ActivityIndicator color={c.onAccent} size="small" />
          ) : (
            <Ionicons
              name={playing ? 'pause' : 'play'}
              size={22}
              color={c.onAccent}
              style={playing ? undefined : styles.playNudge}
            />
          )}
        </Pressable>
        <IconButton
          name="play-skip-forward"
          size={28}
          color={canNext ? c.text : c.textMuted}
          disabled={!canNext}
          accessibilityLabel="Next"
          onPress={goNext}
        />
      </View>
      <ProgressTrack
        progress={progress}
        duration={duration}
        buffered={buffered}
        bufferedStart={bufferedStart}
        height={3}
        accent={c.accent}
        bufferColor={bufferColor}
        trackColor={trackColor}
      />
    </GlassSurface>
  );
}

function MiniSlide({
  item,
  subtitle,
  dimmed = false,
  danger = false,
}: {
  item: BaseItem | null | undefined;
  subtitle?: string;
  dimmed?: boolean;
  danger?: boolean;
}) {
  const c = useColors();
  const line = subtitle ?? (item ? artistLine(item) : '');
  return (
    <View style={[styles.slide, dimmed ? styles.slideDim : null]}>
      {item ? (
        <>
          <CoverArt item={item} size={ART} rounded="album" />
          <View style={styles.meta}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.sub, { color: danger ? c.danger : c.textSub }]} numberOfLines={1}>
              {line}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export function MiniPlayerSpacer() {
  const pad = useNowPlayingPadding(0);
  return pad > 0 ? <View style={{ height: pad }} /> : null;
}

const webPan = { touchAction: 'none' } as Record<string, string>;

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
  slotPass: {
    pointerEvents: 'box-none',
  },
  lift: {
    marginHorizontal: 10,
    marginBottom: 8,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0,0,0,0.32)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
      },
    }),
  },
  wrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    height: MINI_PLAYER_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 8,
    paddingRight: 6,
  },
  swipe: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    overflow: 'hidden',
  },
  slider: {
    height: '100%',
    flexDirection: 'row',
    width: '300%',
  },
  slide: {
    width: '33.333%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: 8,
  },
  slideDim: { opacity: 0.38 },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNudge: { marginLeft: 2 },
  meta: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  sub: { fontSize: 13 },
});
