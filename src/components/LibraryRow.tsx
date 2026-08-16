import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFavoriteMutation } from '@/api/hooks';
import type { BaseItem } from '@/api/types';
import { CoverArt } from '@/components/CoverArt';
import { CoverActions, isItemActive } from '@/components/CoverActions';
import { IconButton } from '@/components/IconButton';
import { spacing } from '@/constants/theme';
import { artistLine } from '@/lib/format';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export function librarySubtitle(item: BaseItem, userName?: string | null): string {
  if (item.type === 'MusicArtist') return 'Artist';
  if (item.type === 'Playlist') return `Playlist • ${userName ?? 'you'}`;
  if (item.type === 'MusicAlbum') {
    const artist = artistLine(item);
    return artist ? `Album • ${artist}` : 'Album';
  }
  const artist = artistLine(item);
  return artist ? `Song • ${artist}` : 'Song';
}

type Props = {
  item: BaseItem;
  subtitle?: string;
  onPress: () => void;
  onMore?: () => void;
};

export function LibraryRow({ item, subtitle, onPress, onMore }: Props) {
  const c = useColors();
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const contextId = usePlayer((s) => s.contextId);
  const favorite = useFavoriteMutation();
  const active = isItemActive(item, current, contextId);
  const liked = Boolean(item.userData?.isFavorite);
  const circle = item.type === 'MusicArtist';

  return (
    <View style={styles.wrap}>
      <View style={styles.cover}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.name}>
          <CoverArt item={item} size={64} rounded={circle ? 'circle' : 'square'} />
        </Pressable>
        <CoverActions
          item={item}
          size={64}
          compact
          onPlay={item.type === 'Audio' ? onPress : undefined}
        />
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceHover }]}
        accessibilityRole="button"
        accessibilityLabel={item.name}>
        <View style={styles.meta}>
          <Text style={[styles.name, { color: active ? c.accent : c.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.sub, { color: active && playing ? c.accent : c.textSub }]} numberOfLines={1}>
            {active && playing ? 'Playing • ' : ''}
            {subtitle}
          </Text>
        </View>
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
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  cover: { marginLeft: spacing.lg },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
    paddingRight: spacing.lg,
    paddingVertical: 8,
    minWidth: 0,
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 3 },
});
