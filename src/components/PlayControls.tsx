import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

type Props = {
  onPlay: () => void;
  onShuffle?: () => void;
  playing?: boolean;
  busy?: boolean;
};

export function GreenPlayButton({
  onPlay,
  playing,
  busy,
}: {
  onPlay: () => void;
  playing?: boolean;
  busy?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPlay();
      }}
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Loading' : playing ? 'Pause' : 'Play'}
      style={({ pressed }) => [styles.play, { backgroundColor: c.accent }, pressed && { transform: [{ scale: 0.96 }] }]}>
      {busy ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Ionicons name={playing ? 'pause' : 'play'} size={28} color={c.onAccent} />
      )}
    </Pressable>
  );
}

export function CollectionActions({ onPlay, onShuffle, playing, busy }: Props) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {onShuffle ? (
        <Pressable onPress={onShuffle} style={[styles.shuffle, { borderColor: c.textMuted }]}>
          <Text style={[styles.shuffleText, { color: c.text }]}>Shuffle</Text>
        </Pressable>
      ) : (
        <View />
      )}
      <GreenPlayButton onPlay={onPlay} playing={playing} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffle: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  shuffleText: { fontWeight: '800' },
});
