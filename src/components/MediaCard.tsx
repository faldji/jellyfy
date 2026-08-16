import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BaseItem } from '@/api/types';
import { CoverArt } from '@/components/CoverArt';
import { CoverActions, isItemActive } from '@/components/CoverActions';
import { CARD_SIZE, spacing } from '@/constants/theme';
import { artistLine, yearOf } from '@/lib/format';
import { isAudio } from '@/lib/media';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

type Props = {
  item: BaseItem;
  onPress: () => void;
  size?: number;
  /** When set, the cover play disc uses this queue instead of starting a one-track session. */
  playQueue?: BaseItem[];
  continueWithSr?: boolean;
};

export function MediaCard({ item, onPress, size = CARD_SIZE, playQueue, continueWithSr }: Props) {
  const c = useColors();
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const contextId = usePlayer((s) => s.contextId);
  const active = isItemActive(item, current, contextId);
  const circle = item.type === 'MusicArtist';
  const subtitle =
    item.type === 'MusicArtist'
      ? 'Artist'
      : item.type === 'Playlist'
        ? 'Playlist'
        : item.type === 'MusicAlbum'
          ? [yearOf(item), artistLine(item)].filter(Boolean).join(' • ')
          : artistLine(item);

  return (
    <View style={{ width: size, flexShrink: 0 }}>
      <View>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.name}>
          <CoverArt item={item} size={size} rounded={circle ? 'circle' : 'album'} />
        </Pressable>
        <CoverActions
          item={item}
          size={size}
          onPlay={
            playQueue?.length && isAudio(item)
              ? () => {
                  const start = Math.max(0, playQueue.findIndex((row) => row.id === item.id));
                  void usePlayer.getState().playItems(playQueue, start, { continueWithSr });
                }
              : undefined
          }
        />
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.name}>
        <Text style={[styles.title, { color: active && playing ? c.accent : c.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {subtitle ? (
          <Text style={[styles.sub, { color: c.textSub }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
