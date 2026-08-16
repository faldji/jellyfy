import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useItem, useItems, useMusicParent } from '@/api/hooks';
import { IconButton } from '@/components/IconButton';
import { MediaCard } from '@/components/MediaCard';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { spacing } from '@/constants/theme';
import { closeOverlay, hrefForItem } from '@/lib/navigation';
import { useColors } from '@/theme/useColors';

export default function GenreScreen() {
  const { name, title } = useLocalSearchParams<{ name: string; title?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const parentId = useMusicParent();
  const bottomPad = useNowPlayingPadding();
  const genre = useItem(name);
  const albums = useItems(
    ['genre', name],
    {
      genreIds: name ? [name] : undefined,
      includeItemTypes: ['MusicAlbum'],
      sortBy: ['PremiereDate'],
      sortOrder: 'Descending',
      limit: 80,
      ...musicScope(parentId),
    },
    Boolean(name)
  );

  return (
    <ScrollView style={[styles.screen, { backgroundColor: c.bg }]} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
        <Text style={[styles.title, { color: c.text }]}>{title || genre.data?.name || 'Genre'}</Text>
      </View>
      <View style={styles.grid}>
        {(albums.data?.items ?? []).map((item) => (
          <MediaCard key={item.id} item={item} onPress={() => router.push(hrefForItem(item))} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  grid: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
});
