import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useInfiniteItems, useMusicParent } from '@/api/hooks';
import type { BaseItem, BaseItemKind, ItemSortBy, SortOrder } from '@/api/types';
import { ActionSheet } from '@/components/ActionSheet';
import { CoverArt } from '@/components/CoverArt';
import { CoverActions, isItemActive } from '@/components/CoverActions';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { LibraryRow, librarySubtitle } from '@/components/LibraryRow';
import { LikedCover } from '@/components/LikedCover';
import { Skeleton } from '@/components/Skeleton';
import { useTrackActions } from '@/components/useTrackActions';
import { UserAvatar } from '@/components/UserAvatar';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { radii, spacing } from '@/constants/theme';
import { hrefForItem } from '@/lib/navigation';
import { plural } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useDownloads } from '@/store/downloads';
import { type LibrarySort, type LibraryTab, useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useUi } from '@/store/ui';
import { useColors } from '@/theme/useColors';

const TABS: { key: LibraryTab; label: string }[] = [
  { key: 'playlists', label: 'Playlists' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'tracks', label: 'Tracks' },
];

const SORTS: { key: LibrarySort; label: string; hint: string }[] = [
  { key: 'recents', label: 'Recents', hint: 'Last played' },
  { key: 'added', label: 'Recently added', hint: 'Date added to the library' },
  { key: 'alpha', label: 'Alphabetical', hint: 'A to Z' },
  { key: 'artist', label: 'Artist', hint: 'Album artist, then title' },
];

const PAGE_SIZE = 40;
const GRID_GAP = 12;
const GRID_PAD = spacing.lg;

function tabTypes(tab: LibraryTab): BaseItemKind[] {
  if (tab === 'playlists') return ['Playlist'];
  if (tab === 'albums') return ['MusicAlbum'];
  if (tab === 'artists') return ['MusicArtist'];
  if (tab === 'tracks') return ['Audio'];
  return ['Playlist', 'MusicAlbum', 'MusicArtist'];
}

function sortQuery(sort: LibrarySort, tab: LibraryTab): { sortBy: ItemSortBy[]; sortOrder: SortOrder } {
  if (sort === 'added') return { sortBy: ['DateCreated', 'SortName'], sortOrder: 'Descending' };
  if (sort === 'alpha') return { sortBy: ['SortName'], sortOrder: 'Ascending' };
  if (sort === 'artist' && tab !== 'artists' && tab !== 'playlists') {
    return { sortBy: ['AlbumArtist', 'SortName'], sortOrder: 'Ascending' };
  }
  return { sortBy: ['DatePlayed', 'SortName'], sortOrder: 'Descending' };
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useColors();
  const { width } = useWindowDimensions();
  const parentId = useMusicParent();
  const userName = useAuth((s) => s.session?.userName);
  const userId = useAuth((s) => s.session?.userId);
  const downloads = useDownloads((s) => s.items);
  const downloadCount = Object.values(downloads).filter(
    (item) => !item.ownerId || !userId || item.ownerId === userId
  ).length;
  const playItems = usePlayer((s) => s.playItems);
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const contextId = usePlayer((s) => s.contextId);
  const openCreate = useUi((s) => s.openCreate);
  const tab = useLibrary((s) => s.tab);
  const setTab = useLibrary((s) => s.setTab);
  const sort = useLibrary((s) => s.sort);
  const setSort = useLibrary((s) => s.setSort);
  const layout = useLibrary((s) => s.layout);
  const setLayout = useLibrary((s) => s.setLayout);
  const likedOnly = useLibrary((s) => s.likedOnly);
  const setLikedOnly = useLibrary((s) => s.setLikedOnly);
  const actions = useTrackActions();
  const [sortOpen, setSortOpen] = useState(false);
  const bottomPad = useNowPlayingPadding();

  const grid = layout === 'grid';
  const cols = width >= 900 ? 4 : 3;
  const tile = Math.floor((width - GRID_PAD * 2 - GRID_GAP * (cols - 1)) / cols);
  const sorting = sortQuery(sort, tab);
  const artistsTab = tab === 'artists';

  const query = useInfiniteItems(
    ['library', tab, sort, likedOnly],
    {
      includeItemTypes: artistsTab ? undefined : tabTypes(tab),
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
      filters: likedOnly ? ['IsFavorite'] : undefined,
      ...musicScope(parentId),
    },
    { pageSize: PAGE_SIZE, source: artistsTab ? 'albumArtists' : 'items' }
  );

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [query.data]
  );
  const total = query.data?.pages[0]?.totalRecordCount;
  const showPins = (tab === 'all' || tab === 'playlists') && !likedOnly && !grid;
  const sortLabel = SORTS.find((entry) => entry.key === sort)?.label ?? 'Recents';
  const availableSorts = tab === 'artists' || tab === 'playlists' ? SORTS.filter((entry) => entry.key !== 'artist') : SORTS;

  useEffect(() => {
    if ((tab === 'artists' || tab === 'playlists') && sort === 'artist') setSort('recents');
  }, [setSort, sort, tab]);

  const openItem = (item: BaseItem, index: number) => {
    if (item.type === 'Audio') {
      void playItems(items, index, { contextId: 'library' });
      return;
    }
    router.push(hrefForItem(item));
  };

  const header = (
    <View>
      {showPins ? (
        <>
          <Pressable style={styles.pinRow} onPress={() => router.push('/likes')}>
            <LikedCover size={64} />
            <View style={styles.pinMeta}>
              <Text style={[styles.pinName, { color: c.text }]}>Liked Songs</Text>
              <Text style={[styles.pinSub, { color: c.textSub }]}>Playlist • {userName ?? 'you'}</Text>
            </View>
          </Pressable>
          <Pressable style={styles.pinRow} onPress={() => router.push('/downloads')}>
            <View style={[styles.downloadPin, { backgroundColor: c.accent }]}>
              <Ionicons name="arrow-down" size={22} color={c.onAccent} />
            </View>
            <View style={styles.pinMeta}>
              <Text style={[styles.pinName, { color: c.text }]}>Downloads</Text>
              <Text style={[styles.pinSub, { color: c.textSub }]}>{plural(downloadCount, 'track')}</Text>
            </View>
          </Pressable>
        </>
      ) : null}

      <View style={styles.sortRow}>
        <Pressable
          onPress={() => setSortOpen(true)}
          style={styles.sortBtn}
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${sortLabel}`}>
          <Ionicons name="swap-vertical" size={16} color={c.text} />
          <Text style={[styles.sortLabel, { color: c.text }]}>{sortLabel}</Text>
        </Pressable>
        <View style={styles.sortRight}>
          {typeof total === 'number' ? (
            <Text style={[styles.count, { color: c.textMuted }]}>{plural(total, tab === 'tracks' ? 'song' : 'item')}</Text>
          ) : null}
          <IconButton
            name={grid ? 'list' : 'grid-outline'}
            accessibilityLabel={grid ? 'List view' : 'Grid view'}
            onPress={() => setLayout(grid ? 'list' : 'grid')}
          />
        </View>
      </View>
    </View>
  );

  const empty =
    !query.isLoading && items.length === 0 ? (
      <EmptyState
        title="Nothing here yet"
        subtitle={likedOnly ? 'Like something to see it here.' : 'Add music in Jellyfin, then pull to refresh.'}
      />
    ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <UserAvatar onPress={() => router.push('/settings')} />
          <Text style={[styles.title, { color: c.text }]}>Your Library</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton name="search" accessibilityLabel="Search" onPress={() => router.push('/(app)/(tabs)/search')} />
          <IconButton name="add" accessibilityLabel="Create" onPress={openCreate} />
        </View>
      </View>

      <View style={styles.chipWrap}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const active = tab === item.key;
            return (
              <Pressable
                onPress={() => setTab(active ? 'all' : item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.text : c.glass,
                    borderColor: active ? c.text : c.hairline,
                  },
                ]}>
                {active ? <Ionicons name="close" size={14} color={c.bg} /> : null}
                <Text style={[styles.chipText, { color: active ? c.bg : c.text }]}>{item.label}</Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <Pressable
              onPress={() => setLikedOnly(!likedOnly)}
              style={[
                styles.chip,
                {
                  backgroundColor: likedOnly ? c.accent : c.glass,
                  borderColor: likedOnly ? c.accent : c.hairline,
                },
              ]}>
              <Ionicons name={likedOnly ? 'heart' : 'heart-outline'} size={13} color={likedOnly ? c.onAccent : c.text} />
              <Text style={[styles.chipText, { color: likedOnly ? c.onAccent : c.text }]}>Liked</Text>
            </Pressable>
          }
        />
      </View>

      <FlatList
        key={`${layout}-${cols}`}
        data={items}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={grid ? cols : 1}
        renderItem={({ item, index }) =>
          grid ? (
            <View
              style={{ width: tile, marginLeft: index % cols === 0 ? GRID_PAD : GRID_GAP, marginBottom: spacing.lg }}>
              <View>
                <Pressable
                  onPress={() => openItem(item, index)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}>
                  <CoverArt
                    item={item}
                    size={tile}
                    rounded={item.type === 'MusicArtist' ? 'circle' : 'album'}
                  />
                </Pressable>
                <CoverActions
                  item={item}
                  size={tile}
                  onPlay={item.type === 'Audio' ? () => openItem(item, index) : undefined}
                />
              </View>
              <Pressable onPress={() => openItem(item, index)} accessibilityRole="button" accessibilityLabel={item.name}>
                <Text
                  style={[
                    styles.tileName,
                    { color: isItemActive(item, current, contextId) && playing ? c.accent : c.text },
                  ]}
                  numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.tileSub, { color: c.textSub }]} numberOfLines={2}>
                  {librarySubtitle(item, userName)}
                </Text>
              </Pressable>
            </View>
          ) : (
            <LibraryRow
              item={item}
              subtitle={librarySubtitle(item, userName)}
              onPress={() => openItem(item, index)}
              onMore={item.type === 'Audio' ? () => actions.open(item) : undefined}
            />
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.isLoading ? (
            <View style={{ paddingTop: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={i} style={styles.skelRow}>
                  <Skeleton style={{ width: 64, height: 64, borderRadius: 4 }} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton style={{ height: 14, width: '70%' }} />
                    <Skeleton style={{ height: 12, width: '40%' }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            empty
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={c.text} style={{ marginVertical: 20 }} />
          ) : items.length > 0 && !query.hasNextPage ? (
            <Text style={[styles.end, { color: c.textMuted }]}>You’re all caught up</Text>
          ) : (
            <View style={{ height: 12 }} />
          )
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={c.text}
          />
        }
        contentContainerStyle={{ paddingBottom: bottomPad }}
      />

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        actions={actions.actions}
        onClose={actions.close}
      />
      <ActionSheet
        visible={sortOpen}
        title="Sort by"
        actions={availableSorts.map((entry) => ({
          key: entry.key,
          label: sort === entry.key ? `✓  ${entry.label}` : entry.label,
          onPress: () => setSort(entry.key),
        }))}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', gap: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  chipWrap: { marginTop: 4 },
  chips: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 12, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: { fontWeight: '700', fontSize: 13 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    marginTop: 4,
    marginBottom: 6,
  },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  sortLabel: { fontWeight: '800', fontSize: 14 },
  sortRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontSize: 12, fontWeight: '600' },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  pinMeta: { flex: 1, minWidth: 0 },
  pinName: { fontSize: 16, fontWeight: '600' },
  pinSub: { fontSize: 13, marginTop: 3 },
  downloadPin: {
    width: 64,
    height: 64,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  tileSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  end: { textAlign: 'center', paddingVertical: 20, fontSize: 12 },
});
