import { Ionicons } from '@expo/vector-icons';
import { Children, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { spacing } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

type Props = {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
};

export function Section({ title, onSeeAll, children }: Props) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show all">
            <Text style={[styles.seeAll, { color: c.accent }]}>Show all</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function railItems(children: React.ReactNode) {
  return Children.map(children, (child, index) =>
    child == null ? null : (
      <View key={index} collapsable={false} style={styles.item}>
        {child}
      </View>
    )
  );
}

export function HorizontalRail({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const { width: windowW } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [contentW, setContentW] = useState(0);

  const overflow = contentW > viewport + 8;
  const showArrows = overflow && (Platform.OS === 'web' || windowW >= 768);
  const atStart = offset <= 8;
  const atEnd = offset + viewport >= contentW - 8;
  const page = Math.max(160, viewport - 48);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(event.nativeEvent.contentOffset.x);
  };

  const scrollBy = (dir: -1 | 1) => {
    const next = Math.max(0, Math.min(Math.max(0, contentW - viewport), offset + dir * page));
    scrollRef.current?.scrollTo({ x: next, animated: true });
    setOffset(next);
  };

  return (
    <View style={styles.railWrap} onLayout={(event) => setViewport(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={(width) => setContentW(width)}
        style={styles.railScroll}
        contentContainerStyle={styles.railNative}
        {...(Platform.OS === 'web' ? { dataSet: { rail: '1' } } : {})}>
        {railItems(children)}
      </ScrollView>
      {showArrows && !atStart ? (
        <Pressable
          onPress={() => scrollBy(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous"
          style={[styles.arrow, styles.arrowLeft, { backgroundColor: c.elevate, borderColor: c.hairline }]}>
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
      ) : null}
      {showArrows && !atEnd ? (
        <Pressable
          onPress={() => scrollBy(1)}
          accessibilityRole="button"
          accessibilityLabel="Next"
          style={[styles.arrow, styles.arrowRight, { backgroundColor: c.elevate, borderColor: c.hairline }]}>
          <Ionicons name="chevron-forward" size={20} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.md },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '800', flex: 1, paddingRight: spacing.md },
  seeAll: { fontSize: 13, fontWeight: '700' },
  railWrap: { position: 'relative' },
  railScroll: { flexGrow: 0, flexShrink: 0 },
  railNative: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    flexGrow: 0,
  },
  item: { flexShrink: 0, flexGrow: 0 },
  arrow: {
    position: 'absolute',
    top: '36%',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' } as ViewStyle,
      default: { elevation: 4 },
    }),
  },
  arrowLeft: { left: 6 },
  arrowRight: { right: 6 },
});
