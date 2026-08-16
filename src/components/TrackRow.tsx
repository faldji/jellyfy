import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFavoriteMutation } from '@/api/hooks';
import type { BaseItem } from '@/api/types';
import { CoverArt } from '@/components/CoverArt';
import { CoverActions } from '@/components/CoverActions';
import { IconButton } from '@/components/IconButton';
import { SpectrumBars } from '@/components/SpectrumBars';
import { spacing } from '@/constants/theme';
import { albumTrackNumber } from '@/lib/album';
import { artistLine, formatTicks } from '@/lib/format';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

type Props = {
  item: BaseItem;
  index?: number;
  showCover?: boolean;
  subtitle?: string;
  onPress?: () => void;
  /** Play from the cover. Defaults to onPress so album/playlist rows keep queue context. */
  onCoverPlay?: () => void;
  onMore?: () => void;
};

export function TrackRow({ item, index, showCover = true, subtitle, onPress, onCoverPlay, onMore }: Props) {
  const c = useColors();
  const currentId = usePlayer((s) => s.current?.id);
  const playing = usePlayer((s) => s.playing);
  const favorite = useFavoriteMutation();
  const active = currentId === item.id;
  const liked = Boolean(item.userData?.isFavorite);
  const line = subtitle ?? [artistLine(item), item.album].filter(Boolean).join(' • ');
  const number = !showCover ? albumTrackNumber(item, index) : null;

  return (
    <View style={styles.row}>
      {number != null ? (
        <Pressable onPress={onPress} style={styles.indexWrap} accessibilityRole="button" accessibilityLabel={item.name}>
          {active && playing ? (
            <SpectrumBars playing color={c.accent} height={14} />
          ) : (
            <Text style={[styles.index, { color: active ? c.accent : c.textSub }]}>{number}</Text>
          )}
        </Pressable>
      ) : null}
      {showCover ? (
        <View style={styles.cover}>
          <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.name}>
            <CoverArt item={item} size={48} rounded="square" />
          </Pressable>
          <CoverActions item={item} size={48} compact onPlay={onCoverPlay ?? onPress} />
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && { backgroundColor: c.surfaceHover }]}
        accessibilityRole="button"
        accessibilityLabel={item.name}>
        <View style={styles.meta}>
          <Text style={[styles.title, { color: active ? c.accent : c.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.subRow}>
            {liked ? <Ionicons name="heart" size={12} color={c.accent} /> : null}
            <Text style={[styles.sub, { color: c.textSub }]} numberOfLines={1}>
              {line}
            </Text>
          </View>
        </View>
        <Text style={[styles.duration, { color: c.textMuted }]}>{formatTicks(item.runTimeTicks)}</Text>
      </Pressable>
      <IconButton
        name={liked ? 'heart' : 'heart-outline'}
        size={18}
        color={liked ? c.accent : c.textSub}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
        onPress={() => favorite.mutate({ item, favorite: !liked })}
      />
      {onMore ? (
        <IconButton name="ellipsis-horizontal" size={20} color={c.textSub} onPress={onMore} accessibilityLabel="More" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    minHeight: 60,
  },
  cover: { marginLeft: spacing.lg },
  indexWrap: {
    width: 40,
    paddingLeft: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minWidth: 0,
  },
  index: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '500' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: 13, flex: 1 },
  duration: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
