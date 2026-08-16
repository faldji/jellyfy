import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GlassSurface } from '@/components/GlassSurface';
import { radii, spacing } from '@/constants/theme';
import { HOME_SECTION_META, useHomeLayout, type HomeSectionConfig } from '@/store/home';
import { useColors } from '@/theme/useColors';

const ROW_H = 78;

export function HomeLayoutEditor() {
  const c = useColors();
  const layout = useHomeLayout((s) => s.layout);
  const move = useHomeLayout((s) => s.move);
  const setVisible = useHomeLayout((s) => s.setVisible);
  const setLimit = useHomeLayout((s) => s.setLimit);
  const resetLayout = useHomeLayout((s) => s.resetLayout);

  return (
    <View>
      <Text style={[styles.blurb, { color: c.textMuted }]}>
        Drag to reorder. Hide a section or change how many cards it shows.
      </Text>
      <GlassSurface style={[styles.list, { borderColor: c.hairline }]}>
        {layout.map((row, index) => (
          <EditorRow
            key={row.id}
            row={row}
            index={index}
            last={index === layout.length - 1}
            onMove={move}
            onVisible={setVisible}
            onLimit={setLimit}
          />
        ))}
      </GlassSurface>
      <Pressable onPress={resetLayout} style={styles.reset}>
        <Text style={[styles.resetText, { color: c.textSub }]}>Reset Home layout</Text>
      </Pressable>
    </View>
  );
}

function EditorRow({
  row,
  index,
  last,
  onMove,
  onVisible,
  onLimit,
}: {
  row: HomeSectionConfig;
  index: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
  onVisible: (id: HomeSectionConfig['id'], visible: boolean) => void;
  onLimit: (id: HomeSectionConfig['id'], limit: number) => void;
}) {
  const c = useColors();
  const meta = HOME_SECTION_META[row.id];
  const dragY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(120)
        .onStart(() => {
          dragging.value = 1;
        })
        .onUpdate((e) => {
          dragY.value = e.translationY;
        })
        .onEnd((e) => {
          const delta = Math.round(e.translationY / ROW_H);
          dragY.value = withTiming(0, { duration: 140 });
          dragging.value = 0;
          if (delta) runOnJS(onMove)(index, index + delta);
        })
        .onFinalize(() => {
          dragY.value = withTiming(0, { duration: 140 });
          dragging.value = 0;
        }),
    [dragY, dragging, index, onMove]
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    zIndex: dragging.value ? 4 : 0,
    opacity: dragging.value ? 0.92 : 1,
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        style,
        { borderBottomColor: c.hairline, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}>
      <GestureDetector gesture={gesture}>
        <View style={styles.handle} accessibilityLabel="Drag to reorder">
          <Ionicons name="reorder-three" size={24} color={c.textMuted} />
        </View>
      </GestureDetector>
      <View style={styles.meta}>
        <Text style={[styles.name, { color: row.visible ? c.text : c.textMuted }]} numberOfLines={1}>
          {meta.label}
        </Text>
        <Text style={[styles.hint, { color: c.textMuted }]} numberOfLines={1}>
          {meta.hint}
        </Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onLimit(row.id, row.limit - 1)}
            disabled={row.limit <= meta.min}
            style={[styles.step, { borderColor: c.hairline }]}
            accessibilityLabel="Fewer items">
            <Ionicons name="remove" size={16} color={row.limit <= meta.min ? c.textMuted : c.text} />
          </Pressable>
          <Text style={[styles.count, { color: c.text }]}>{row.limit}</Text>
          <Pressable
            onPress={() => onLimit(row.id, row.limit + 1)}
            disabled={row.limit >= meta.max}
            style={[styles.step, { borderColor: c.hairline }]}
            accessibilityLabel="More items">
            <Ionicons name="add" size={16} color={row.limit >= meta.max ? c.textMuted : c.text} />
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => onVisible(row.id, !row.visible)}
        accessibilityRole="button"
        accessibilityLabel={row.visible ? 'Hide section' : 'Show section'}
        style={styles.eye}>
        <Ionicons name={row.visible ? 'eye-outline' : 'eye-off-outline'} size={22} color={row.visible ? c.text : c.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blurb: { paddingHorizontal: spacing.lg, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  list: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    backgroundColor: 'transparent',
  },
  handle: { width: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  meta: { flex: 1, minWidth: 0, paddingVertical: 10 },
  name: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minWidth: 20, textAlign: 'center', fontWeight: '800', fontVariant: ['tabular-nums'] },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reset: { alignItems: 'center', paddingVertical: 14 },
  resetText: { fontWeight: '700', fontSize: 13 },
});
