import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useInfiniteItems, useMusicParent } from '@/api/hooks';
import { ActionSheet } from '@/components/ActionSheet';
import { EmptyState } from '@/components/EmptyState';
import { CoverPlayDisc } from '@/components/CoverActions';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { LikedCover } from '@/components/LikedCover';
import { CollectionActions } from '@/components/PlayControls';
import { TrackRow } from '@/components/TrackRow';
import { useTrackActions } from '@/components/useTrackActions';
import { spacing } from '@/constants/theme';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function LikesTab() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const parentId = useMusicParent();
  const liked = useInfiniteItems(
    ['likes'],
    {
      includeItemTypes: ['Audio'],
      filters: ['IsFavorite'],
      sortBy: ['DatePlayed'],
      sortOrder: 'Descending',
      ...musicScope(parentId),
    },
    { pageSize: 50 }
  );
  const items = useMemo(
    () => liked.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [liked.data]
  );
  const playItems = usePlayer((s) => s.playItems);
  const actions = useTrackActions();
  const collection = useCollectionPlayback('likes', items);
  const bottomPad = useNowPlayingPadding();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        onEndReached={() => {
          if (liked.hasNextPage && !liked.isFetchingNextPage) void liked.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <View style={styles.head}>
              <View>
                <LikedCover size={88} />
                <CoverPlayDisc
                  size={88}
                  playing={collection.playing}
                  busy={collection.busy}
                  onPlay={collection.play}
                />
              </View>
              <Text style={[styles.title, { color: c.text }]}>Liked Songs</Text>
            </View>
            <CollectionActions
              playing={collection.playing}
              busy={collection.busy}
              onPlay={collection.play}
              onShuffle={collection.shuffle}
            />
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            item={item}
            onPress={() => void playItems(items, index, { contextId: 'likes' })}
            onMore={() => actions.open(item)}
          />
        )}
        ListEmptyComponent={
          !liked.isLoading ? (
            <EmptyState title="Songs you like will appear here" subtitle="Tap the heart on a track." />
          ) : (
            <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
          )
        }
        ListFooterComponent={
          liked.isFetchingNextPage ? <ActivityIndicator color={c.text} style={{ marginVertical: 16 }} /> : null
        }
      />
      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        actions={actions.actions}
        onClose={actions.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing.lg, marginTop: 8, marginBottom: 8, gap: 12 },
  title: { fontSize: 32, fontWeight: '900' },
});
