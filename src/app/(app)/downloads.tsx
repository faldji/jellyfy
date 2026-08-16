import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BaseItem } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { closeOverlay } from '@/lib/navigation';
import { CollectionActions } from '@/components/PlayControls';
import { TrackRow } from '@/components/TrackRow';
import { spacing } from '@/constants/theme';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/store/auth';
import { useDownloads } from '@/store/downloads';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const ownerId = useAuth((s) => s.session?.userId);
  const items = Object.values(useDownloads((s) => s.items)).filter(
    (item) => !item.ownerId || !ownerId || item.ownerId === ownerId
  );
  const playItems = usePlayer((s) => s.playItems);
  const asTracks = items.map(
    (d) =>
      ({
        id: d.id,
        name: d.name,
        type: 'Audio',
        artists: d.artists,
        album: d.album,
        albumId: d.albumId,
        imageTags: d.imageTags,
        albumPrimaryImageTag: d.albumPrimaryImageTag,
        runTimeTicks: d.runTimeTicks,
      }) satisfies BaseItem
  );
  const collection = useCollectionPlayback('downloads', asTracks);
  const bottomPad = useNowPlayingPadding();

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.bg }]} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>Downloads</Text>
      <CollectionActions
        playing={collection.playing}
        busy={collection.busy}
        onPlay={collection.play}
        onShuffle={collection.shuffle}
      />
      {asTracks.map((item, index) => (
        <View key={item.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <TrackRow item={item} onPress={() => void playItems(asTracks, index, { contextId: 'downloads' })} />
          </View>
          <IconButton
            name="trash-outline"
            color={c.textSub}
            accessibilityLabel="Remove download"
            onPress={() => void useDownloads.getState().remove(item.id)}
          />
        </View>
      ))}
      {asTracks.length === 0 ? (
        <EmptyState title="No downloads" subtitle="Download songs from the track menu for offline listening." />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { paddingHorizontal: spacing.lg },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: spacing.lg, marginVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
});
