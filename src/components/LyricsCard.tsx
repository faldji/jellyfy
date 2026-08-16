import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLyrics } from '@/api/hooks';
import type { LyricDto } from '@/api/types';
import { IconButton } from '@/components/IconButton';
import { spacing } from '@/constants/theme';
import { SheetGrabber, useSwipeDownClose } from '@/hooks/use-swipe-down-close';
import { colorFromId } from '@/lib/hash-color';
import { usePlayer } from '@/store/player';

function lyricUnit(starts: number[]): 'ticks' | 'ms' | 's' {
  const positive = starts.filter((value) => value > 0);
  if (!positive.length) return 's';
  const max = Math.max(...positive);
  if (max >= 10_000_000) return 'ticks';
  if (max > 1_000) return 'ms';
  return 's';
}

function lyricStartSeconds(start: number | undefined, unit: 'ticks' | 'ms' | 's'): number {
  if (!start || start < 0) return 0;
  if (unit === 'ticks') return start / 10_000_000;
  if (unit === 'ms') return start / 1_000;
  return start;
}

function linesFromDto(data?: LyricDto | null): { text: string; at: number; index: number }[] {
  const raw = data?.lyrics ?? [];
  const unit = lyricUnit(raw.map((line) => line.start ?? 0));
  const out: { text: string; at: number }[] = [];
  for (const line of raw) {
    const chunk = typeof line.text === 'string' ? line.text : '';
    const at = lyricStartSeconds(line.start, unit);
    for (const part of chunk.split(/\r?\n/)) {
      const text = part.trim();
      if (text) out.push({ text, at });
    }
  }
  return out.map((line, index) => ({ ...line, index }));
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function LyricsCard({ open, onClose }: Props) {
  const current = usePlayer((s) => s.current);
  const position = usePlayer((s) => s.position);
  const lyrics = useLyrics(current?.id, Boolean(current && open));
  const insets = useSafeAreaInsets();
  const { gesture, style } = useSwipeDownClose(onClose, open);
  const scrollRef = useRef<ScrollView>(null);
  const lineYs = useRef<Record<number, number>>({});
  const follow = useRef(true);

  const trackId = current?.id;
  const lines = useMemo(() => linesFromDto(lyrics.data), [lyrics.data]);
  const synced = lines.some((line) => line.at > 0);
  const activeIndex = useMemo(() => {
    if (!synced) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].at <= position + 0.05) index = i;
      else break;
    }
    return index;
  }, [lines, position, synced]);

  useEffect(() => {
    lineYs.current = {};
    follow.current = true;
  }, [trackId]);

  useEffect(() => {
    if (!follow.current || !open || activeIndex < 0) return;
    const y = lineYs.current[activeIndex];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
  }, [activeIndex, open]);

  if (!current) return null;

  const bg = colorFromId(current.id);
  const loading = lyrics.isLoading || (lyrics.isFetching && !lyrics.data);
  const empty = !loading && (lyrics.isError || lines.length === 0);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View
          style={[
            styles.sheet,
            style,
            { backgroundColor: bg, paddingTop: insets.top + 2, paddingBottom: insets.bottom + 16 },
          ]}>
          <GestureDetector gesture={gesture}>
            <View>
              <SheetGrabber color="rgba(255,255,255,0.7)" />
              <View style={styles.sheetNav}>
                <IconButton name="chevron-down" color="#fff" accessibilityLabel="Close lyrics" onPress={onClose} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {current.name}
                </Text>
                <View style={{ width: 24 }} />
              </View>
            </View>
          </GestureDetector>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.message}>Loading lyrics…</Text>
            </View>
          ) : empty ? (
            <View style={styles.center}>
              <Text style={styles.message}>No lyrics for this track</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              onScrollBeginDrag={() => {
                follow.current = false;
              }}
              contentContainerStyle={styles.lines}>
              {lines.map((line) => (
                <Text
                  key={`${trackId}-${line.index}`}
                  onLayout={(e) => {
                    lineYs.current[line.index] = e.nativeEvent.layout.y;
                  }}
                  style={[styles.line, line.index === activeIndex ? styles.lineActive : styles.lineIdle]}>
                  {line.text}
                </Text>
              ))}
            </ScrollView>
          )}
          {!loading && !empty ? (
            <Text style={styles.hint}>{synced ? 'Synced lyrics' : 'Lyrics'}</Text>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { flex: 1 },
  sheetNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
  },
  sheetTitle: { color: '#fff', fontWeight: '800', maxWidth: '70%', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: 12 },
  message: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  lines: { paddingHorizontal: spacing.xl, paddingBottom: 32, gap: 16 },
  line: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  lineActive: { color: '#fff' },
  lineIdle: { color: 'rgba(255,255,255,0.45)' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 8, color: 'rgba(255,255,255,0.7)' },
});
