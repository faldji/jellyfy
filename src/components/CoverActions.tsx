import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { useFavoriteMutation } from '@/api/hooks';
import type { BaseItem } from '@/api/types';
import { SpectrumBars } from '@/components/SpectrumBars';
import { isCollectionItem, isItemActive } from '@/lib/media';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export { isItemActive } from '@/lib/media';

function halt(e?: GestureResponderEvent) {
  e?.stopPropagation?.();
}

function tap(e?: GestureResponderEvent) {
  halt(e);
  void Haptics.selectionAsync().catch(() => undefined);
}

type DiscProps = {
  size: number;
  playing: boolean;
  onPlay: () => void;
  inset?: number;
  compact?: boolean;
  busy?: boolean;
};

/** Accent play/pause disc on artwork, matching collection play buttons. */
export function CoverPlayDisc({ size, playing, onPlay, inset = 8, compact, busy }: DiscProps) {
  const c = useColors();
  const playSize = compact ? 22 : Math.max(32, Math.min(48, Math.round(size * 0.26)));
  return (
    <Pressable
      onPress={(e) => {
        tap(e);
        onPlay();
      }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Loading' : playing ? 'Pause' : 'Play'}
      style={({ pressed }) => [
        styles.play,
        {
          width: playSize,
          height: playSize,
          borderRadius: playSize / 2,
          right: compact ? 4 : inset,
          bottom: compact ? 4 : inset,
          backgroundColor: pressed ? c.accentPress : c.accent,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}>
      {busy ? (
        <ActivityIndicator color={c.onAccent} size="small" />
      ) : playing ? (
        <SpectrumBars playing color={c.onAccent} height={Math.max(10, Math.round(playSize * 0.44))} />
      ) : (
        <Ionicons
          name="play"
          size={Math.round(playSize * 0.5)}
          color={c.onAccent}
          style={{ marginLeft: 1 }}
        />
      )}
    </Pressable>
  );
}

type Props = {
  item: BaseItem;
  size: number;
  compact?: boolean;
  /** Override tile play (e.g. play this track in an album queue). */
  onPlay?: () => void;
};

export function CoverActions({ item, size, compact, onPlay }: Props) {
  const c = useColors();
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const preparing = usePlayer((s) => s.preparing);
  const contextId = usePlayer((s) => s.contextId);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playItem = usePlayer((s) => s.playItem);
  const favorite = useFavoriteMutation();
  const active = isItemActive(item, current, contextId);
  const serverLiked = Boolean(item.userData?.isFavorite);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const liked = optimistic ?? serverLiked;
  const circle = item.type === 'MusicArtist';
  const showLike = !compact && size >= 84;
  const busy = preparing && contextId === item.id;

  useEffect(() => {
    setOptimistic(null);
  }, [item.id, serverLiked]);

  const handlePlay = () => {
    const sameCollection = Boolean(contextId && contextId === item.id);
    // Artist/album/playlist: pause only if this collection is already the queue.
    // A track from another context must not steal the disc (that blocked play-all).
    if (isCollectionItem(item)) {
      if (sameCollection) {
        void togglePlay();
        return;
      }
      void playItem(item);
      return;
    }
    if (active) {
      void togglePlay();
      return;
    }
    if (onPlay) {
      onPlay();
      return;
    }
    void playItem(item);
  };

  const handleLike = () => {
    const next = !liked;
    setOptimistic(next);
    favorite.mutate({ item, favorite: next });
  };

  return (
    <View style={styles.overlay}>
      <CoverPlayDisc
        size={size}
        playing={active && playing && !busy}
        busy={busy}
        onPlay={handlePlay}
        compact={compact}
        inset={circle ? 0 : 8}
      />
      {showLike ? (
        <Pressable
          onPress={(e) => {
            tap(e);
            handleLike();
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          style={({ pressed }) => [styles.like, { top: 6, right: 6, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color={liked ? c.accent : '#fff'} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    pointerEvents: 'box-none',
  },
  like: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  play: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...Platform.select({
      web: { boxShadow: '0px 3px 8px rgba(0,0,0,0.38)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.38,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      },
    }),
  },
});
