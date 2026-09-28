import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useInfiniteItems, useItem, useMusicParent } from '@/api/hooks';
import { COLLECTION_PAGE } from '@/api/paging';
import { IconButton } from '@/components/IconButton';
import { MediaCard } from '@/components/MediaCard';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { spacing } from '@/constants/theme';
import { nearListEnd } from '@/lib/near-list-end';
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
  const albums = useInfiniteItems(
    ['genre', name],
    {
      genreIds: name ? [name] : undefined,
      includeItemTypes: ['MusicAlbum'],
      sortBy: ['PremiereDate'],
      sortOrder: 'Descending',
      ...musicScope(parentId),
    },
    { enabled: Boolean(name), pageSize: COLLECTION_PAGE }
  );
  const items = useMemo(() => albums.data?.pages.flatMap((page) => page.items ?? []) ?? [], [albums.data]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.bg }]}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}
      scrollEventThrottle={16}
      onScroll={(event) => {
        if (nearListEnd(event) && albums.hasNextPage && !albums.isFetchingNextPage) void albums.fetchNextPage();
      }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
        <Text style={[styles.title, { color: c.text }]}>{title || genre.data?.name || 'Genre'}</Text>
      </View>
      <View style={styles.grid}>
        {items.map((item, index) => (
          <MediaCard key={`${item.id}-${index}`} item={item} onPress={() => router.push(hrefForItem(item))} />
        ))}
      </View>
      {albums.isLoading || albums.isFetchingNextPage ? (
        <ActivityIndicator color={c.text} style={{ marginVertical: 20 }} />
      ) : null}
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
