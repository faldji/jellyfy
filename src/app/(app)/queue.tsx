import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { TrackRow } from '@/components/TrackRow';
import { spacing } from '@/constants/theme';
import { SheetGrabber, useSwipeDownClose } from '@/hooks/use-swipe-down-close';
import { closeOverlay } from '@/lib/navigation';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function QueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const skipTo = usePlayer((s) => s.skipTo);
  const removeAt = usePlayer((s) => s.removeAt);
  const move = usePlayer((s) => s.move);
  const nextUp = queue.slice(index + 1);
  const close = () => closeOverlay(router);
  const { gesture, style } = useSwipeDownClose(close);

  return (
    <Animated.View style={[styles.screen, style, { backgroundColor: c.bg, paddingTop: insets.top + 2 }]}>
      <GestureDetector gesture={gesture}>
        <View>
          <SheetGrabber color={c.textMuted} />
          <View style={styles.nav}>
            <IconButton name="chevron-down" accessibilityLabel="Close" onPress={close} />
            <Text style={[styles.title, { color: c.text }]}>Queue</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>
      </GestureDetector>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {!current ? (
          <EmptyState
            title="Nothing in the queue"
            subtitle="Play an album, playlist, or song and it will show up here."
          />
        ) : (
          <>
            <Text style={[styles.label, { color: playing ? c.accent : c.text }]}>
              Now playing{playing ? '' : ' (paused)'}
            </Text>
            <TrackRow item={current} onPress={() => void skipTo(index)} />
            <Text style={[styles.label, { color: c.text }]}>Next up</Text>
            {nextUp.map((item, i) => {
              const realIndex = index + 1 + i;
              return (
                <View key={`${item.id}-${realIndex}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <TrackRow item={item} onPress={() => void skipTo(realIndex)} />
                  </View>
                  <IconButton
                    name="chevron-up"
                    size={18}
                    color={c.textSub}
                    accessibilityLabel="Move up"
                    disabled={i === 0}
                    onPress={() => move(realIndex, realIndex - 1)}
                  />
                  <IconButton
                    name="chevron-down"
                    size={18}
                    color={c.textSub}
                    accessibilityLabel="Move down"
                    disabled={realIndex >= queue.length - 1}
                    onPress={() => move(realIndex, realIndex + 1)}
                  />
                  <Pressable
                    onPress={() => removeAt(realIndex)}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel="Remove">
                    <Text style={[styles.removeText, { color: c.textSub }]}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}
            {nextUp.length === 0 ? (
              <Text style={[styles.empty, { color: c.textSub }]}>The queue ends here.</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: 8,
  },
  title: { fontWeight: '800', fontSize: 16 },
  label: {
    fontWeight: '800',
    fontSize: 18,
    paddingHorizontal: spacing.lg,
    marginTop: 16,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  remove: { paddingRight: 16 },
  removeText: { fontWeight: '700', fontSize: 12 },
  empty: { padding: 24 },
});
