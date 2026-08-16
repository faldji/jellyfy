import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useItem, useRadioMix } from '@/api/hooks';
import { IconButton } from '@/components/IconButton';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { CollectionActions } from '@/components/PlayControls';
import { TrackRow } from '@/components/TrackRow';
import { spacing } from '@/constants/theme';
import { closeOverlay } from '@/lib/navigation';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function RadioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const seed = useItem(id);
  const mix = useRadioMix(id);
  const items = mix.data?.items ?? [];
  const playItems = usePlayer((s) => s.playItems);
  const collection = useCollectionPlayback(id ? `radio:${id}` : undefined, items, seed.data);
  const bottomPad = useNowPlayingPadding();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.bg }]} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
      </View>
      <Text style={[styles.kicker, { color: c.accent }]}>Radio</Text>
      <Text style={[styles.title, { color: c.text }]}>
        {seed.data?.name ? `${seed.data.name} Radio` : seed.isLoading ? '' : 'Radio'}
      </Text>
      <CollectionActions
        playing={collection.playing}
        busy={collection.busy}
        onPlay={collection.play}
        onShuffle={collection.shuffle}
      />
      {mix.isLoading ? <ActivityIndicator color={c.text} style={{ marginTop: 24 }} /> : null}
      {items.map((item, index) => (
        <TrackRow
          key={`${item.id}-${index}`}
          item={item}
          onPress={() => void playItems(items, index, { contextId: id ? `radio:${id}` : undefined, continueWithSr: true })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { paddingHorizontal: spacing.lg },
  kicker: { fontWeight: '800', paddingHorizontal: spacing.lg, marginTop: 12 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: spacing.lg, marginBottom: 8 },
});
