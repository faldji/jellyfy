import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useInfiniteItems, useItems, useLatest, useMusicParent, useRadioMix, useSearchAll } from '@/api/hooks';
import { splitSearchHits } from '@/lib/derive-media';
import { rankPopularTracks } from '@/lib/popular-tracks';
import type { BaseItem, BaseItemKind } from '@/api/types';
import { ActionSheet } from '@/components/ActionSheet';
import { CoverArt } from '@/components/CoverArt';
import { CoverPlayDisc } from '@/components/CoverActions';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { MediaCard } from '@/components/MediaCard';
import { HorizontalRail, Section } from '@/components/Section';
import { SearchField } from '@/components/SearchField';
import { SearchResultRow } from '@/components/SearchResultRow';
import { Skeleton } from '@/components/Skeleton';
import { useTrackActions } from '@/components/useTrackActions';
import { UserAvatar } from '@/components/UserAvatar';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { radii, spacing } from '@/constants/theme';
import { useDebounced } from '@/hooks/use-debounce';
import { hrefForItem } from '@/lib/navigation';
import { useLibrary, type LibraryTab } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useRecents } from '@/store/recents';
import { useColors } from '@/theme/useColors';

const FILTERS: { key: 'all' | BaseItemKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Audio', label: 'Songs' },
  { key: 'MusicArtist', label: 'Artists' },
  { key: 'MusicAlbum', label: 'Albums' },
  { key: 'Playlist', label: 'Playlists' },
  { key: 'MusicGenre', label: 'Genres' },
];

const TILES: { label: string; href: Href; tab?: LibraryTab; color: string }[] = [
  { label: 'Music', href: '/(app)/(tabs)/library', tab: 'all', color: '#E13300' },
  { label: 'Playlists', href: '/(app)/(tabs)/library', tab: 'playlists', color: '#1E7A5A' },
  { label: 'Liked Songs', href: '/likes', color: '#5038A0' },
  { label: 'Downloads', href: '/downloads', color: '#0D73EC' },
];

function rankMatch(items: BaseItem[], q: string): BaseItem | undefined {
  if (!items.length) return undefined;
  const n = q.toLowerCase();
  return (
    items.find((item) => item.name?.toLowerCase() === n) ??
    items.find((item) => item.name?.toLowerCase().startsWith(n)) ??
    items.find((item) => item.name?.toLowerCase().includes(n)) ??
    items[0]
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useColors();
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim(), 280);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key'] | 'all'>('all');
  const parentId = useMusicParent();
  const playItems = usePlayer((s) => s.playItems);
  const playCollection = usePlayer((s) => s.playCollection);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playing = usePlayer((s) => s.playing);
  const preparing = usePlayer((s) => s.preparing);
  const contextId = usePlayer((s) => s.contextId);
  const actions = useTrackActions();
  const queries = useRecents((s) => s.queries);
  const touchQuery = useRecents((s) => s.touchQuery);
  const removeQuery = useRecents((s) => s.removeQuery);
  const enabled = q.length >= 2;
  const scoped = musicScope(parentId);

  const mixed = useSearchAll(q, enabled && filter === 'all');
  const split = useMemo(() => splitSearchHits(mixed.data?.items), [mixed.data?.items]);
  const browseGenres = useItems(
    ['browse-genres'],
    { includeItemTypes: ['MusicGenre'], sortBy: ['SortName'], limit: 20, ...scoped },
    !enabled
  );

  const songItems = split.songs;
  const artistItems = split.artists;
  const albumItems = split.albums;
  const playlistItems = split.playlists;
  const genreItems = split.genres;

  const featured = useMemo(() => {
    if (!enabled) return null;
    return (
      rankMatch(artistItems, q) ??
      rankMatch(albumItems, q) ??
      rankMatch(songItems, q) ??
      rankMatch(playlistItems, q) ??
      rankMatch(genreItems, q) ??
      null
    );
  }, [albumItems, artistItems, enabled, genreItems, playlistItems, q, songItems]);

  const qNorm = q.toLowerCase();
  const featuredName = featured?.name?.toLowerCase() ?? '';
  const strongArtist =
    featured?.type === 'MusicArtist' &&
    (featuredName === qNorm || featuredName.startsWith(qNorm) || qNorm.startsWith(featuredName));

  const artistSongs = useItems(
    ['search-artist-songs', featured?.id],
    {
      artistIds: featured?.id ? [featured.id] : undefined,
      includeItemTypes: ['Audio'],
      sortBy: ['PlayCount', 'SortName'],
      limit: 8,
      ...scoped,
    },
    enabled && filter === 'all' && strongArtist
  );
  const artistAlbums = useItems(
    ['search-artist-albums', featured?.id],
    {
      albumArtistIds: featured?.id ? [featured.id] : undefined,
      includeItemTypes: ['MusicAlbum'],
      sortBy: ['PremiereDate'],
      sortOrder: 'Descending',
      limit: 8,
      ...scoped,
    },
    enabled && filter === 'all' && strongArtist
  );
  const paged = useInfiniteItems(
    ['search-page', q, filter],
    {
      searchTerm: q,
      includeItemTypes: filter === 'all' ? undefined : [filter],
      sortBy: ['SortName'],
      ...scoped,
    },
    { enabled: enabled && filter !== 'all', pageSize: 40 }
  );
  const discover = useLatest({ includeItemTypes: ['MusicAlbum'], ...scoped, limit: 8 }, !enabled);

  const pagedItems = useMemo(
    () => paged.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [paged.data]
  );

  const mix = useRadioMix(strongArtist ? featured?.id : undefined);
  const mixTracks = mix.data?.items ?? [];
  const thisIsPool = useItems(
    ['search-this-is', featured?.id],
    {
      artistIds: featured?.id ? [featured.id] : undefined,
      includeItemTypes: ['Audio'],
      sortBy: ['PlayCount', 'SortName'],
      limit: 50,
      ...scoped,
    },
    enabled && filter === 'all' && strongArtist
  );
  const thisIsTracks = useMemo(
    () => rankPopularTracks(thisIsPool.data?.items ?? [], featured?.id ?? '', 25),
    [featured?.id, thisIsPool.data?.items]
  );

  const feed = useMemo(() => {
    const skip = featured?.id;
    const rest: BaseItem[] = [];
    const push = (list: BaseItem[]) => {
      for (const item of list) {
        if (item.id !== skip && !rest.some((entry) => entry.id === item.id)) rest.push(item);
      }
    };
    if (strongArtist) {
      push(artistSongs.data?.items ?? []);
      push(artistAlbums.data?.items ?? []);
    } else {
      push(artistItems.slice(0, 4));
      push(songItems.slice(0, 6));
      push(albumItems.slice(0, 6));
      push(playlistItems.slice(0, 4));
      push(genreItems.slice(0, 4));
    }
    return rest;
  }, [
    albumItems,
    artistAlbums.data?.items,
    artistItems,
    artistSongs.data?.items,
    featured?.id,
    genreItems,
    playlistItems,
    songItems,
    strongArtist,
  ]);

  const loadingTop = mixed.isLoading;
  const hasTop = Boolean(featured) || feed.length > 0;

  const openItem = (item: BaseItem, list?: BaseItem[]) => {
    if (enabled) touchQuery(q);
    if (item.type === 'Audio') {
      const context = list?.filter((entry) => entry.type === 'Audio') ?? [item];
      void playItems(context, Math.max(0, context.findIndex((entry) => entry.id === item.id)), {
        contextId: 'search',
      });
      return;
    }
    router.push(hrefForItem(item));
  };

  const closeSearch = () => {
    setTerm('');
    setFilter('all');
  };

  const playContext = strongArtist ? (artistSongs.data?.items ?? songItems) : songItems;
  const bottomPad = useNowPlayingPadding(48);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      {!enabled ? (
        <View style={styles.header}>
          <UserAvatar onPress={() => router.push('/settings')} />
          <Text style={[styles.title, { color: c.text }]}>Search</Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        {enabled ? (
          <IconButton name="chevron-back" accessibilityLabel="Back" onPress={closeSearch} />
        ) : null}
        <SearchField
          value={term}
          onChangeText={setTerm}
          placeholder="What do you want to listen to?"
          style={styles.searchFlex}
          onSubmit={() => touchQuery(term)}
        />
      </View>

      {enabled ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(active ? 'all' : item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.accent : 'transparent',
                    borderColor: active ? c.accent : c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
                  },
                ]}>
                <Text style={{ color: active ? c.onAccent : c.text, fontWeight: '700', fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!enabled ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
          {queries.length ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.sectionLabel, { color: c.text }]}>Recent searches</Text>
              {queries.map((entry) => (
                <Pressable
                  key={entry}
                  style={styles.recentRow}
                  onPress={() => setTerm(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${entry}`}>
                  <Ionicons name="time-outline" size={20} color={c.textSub} />
                  <Text style={[styles.recentText, { color: c.text }]} numberOfLines={1}>
                    {entry}
                  </Text>
                  <Pressable onPress={() => removeQuery(entry)} hitSlop={10} accessibilityLabel="Remove">
                    <Ionicons name="close" size={18} color={c.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, { color: c.text }]}>Browse all</Text>
          <View style={styles.tileGrid}>
            {TILES.map((tile, index) => (
              <Pressable
                key={tile.label}
                style={[styles.tile, { backgroundColor: tile.color }]}
                onPress={() => {
                  if (tile.tab) useLibrary.getState().setTab(tile.tab);
                  router.push(tile.href);
                }}>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                {discover.data?.[index] ? (
                  <View style={styles.tileArt}>
                    <CoverArt item={discover.data[index]} size={72} rounded="square" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          {browseGenres.data?.items?.length ? (
            <Section title="Genres">
              <HorizontalRail>
                {browseGenres.data.items.map((item) => (
                  <MediaCard key={item.id} item={item} onPress={() => router.push(hrefForItem(item))} />
                ))}
              </HorizontalRail>
            </Section>
          ) : null}

          {discover.data?.length ? (
            <Section title="Discover something new">
              <HorizontalRail>
                {discover.data.map((item) => (
                  <MediaCard key={item.id} item={item} onPress={() => router.push(hrefForItem(item))} />
                ))}
              </HorizontalRail>
            </Section>
          ) : null}
        </ScrollView>
      ) : filter === 'all' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
          {loadingTop && !hasTop ? (
            <View style={{ paddingTop: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={styles.skelRow}>
                  <Skeleton style={{ width: 48, height: 48, borderRadius: 4 }} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton style={{ height: 14, width: '70%' }} />
                    <Skeleton style={{ height: 12, width: '40%' }} />
                  </View>
                </View>
              ))}
            </View>
          ) : !hasTop ? (
            <EmptyState title={`No results for “${q}”`} subtitle="Try another spelling or filter." />
          ) : (
            <>
              {featured ? (
                <SearchResultRow
                  item={featured}
                  onPress={() => openItem(featured, playContext)}
                  onMore={featured.type === 'Audio' ? () => actions.open(featured) : undefined}
                />
              ) : null}

              {strongArtist && featured ? (
                <View style={{ marginTop: 12, marginBottom: 8 }}>
                  <Text style={[styles.featuring, { color: c.text }]}>Featuring {featured.name}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featuringRail}>
                    <View style={styles.featCard}>
                      <View style={styles.featArt}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/radio/[id]', params: { id: featured.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={`${featured.name} Radio`}>
                          <CoverArt item={featured} size={160} />
                          <View style={[styles.featBadge, { backgroundColor: c.accent }]}>
                            <Text style={[styles.featBadgeText, { color: c.onAccent }]}>RADIO</Text>
                          </View>
                        </Pressable>
                        <View style={styles.coverOverlay}>
                          <CoverPlayDisc
                            size={160}
                            playing={playing && contextId === `radio:${featured.id}`}
                            busy={preparing && contextId === `radio:${featured.id}`}
                            onPlay={() => {
                              if (contextId === `radio:${featured.id}`) void togglePlay();
                              else if (mixTracks.length) {
                                void playCollection(mixTracks, {
                                  contextId: `radio:${featured.id}`,
                                  continueWithSr: true,
                                });
                              } else if (featured) {
                                void playCollection([], {
                                  contextId: `radio:${featured.id}`,
                                  seed: featured,
                                  continueWithSr: true,
                                });
                              }
                            }}
                          />
                        </View>
                      </View>
                      <Pressable
                        onPress={() => router.push({ pathname: '/radio/[id]', params: { id: featured.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={`${featured.name} Radio`}>
                        <Text style={[styles.featName, { color: c.text }]} numberOfLines={1}>
                          {featured.name} Radio
                        </Text>
                        <Text style={[styles.featSub, { color: c.textSub }]}>Radio</Text>
                      </Pressable>
                    </View>
                    <View style={styles.featCard}>
                      <View style={styles.featArt}>
                        <Pressable
                          onPress={() => {
                            if (thisIsTracks.length)
                              void playCollection(thisIsTracks, { contextId: `mix:${featured.id}` });
                            else router.push({ pathname: '/artist/[id]', params: { id: featured.id } });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`This Is ${featured.name}`}>
                          <CoverArt item={thisIsTracks[0] ?? featured} size={160} />
                          <View style={[styles.featWash, { backgroundColor: c.accent }]} />
                          <Text style={styles.featThisIs} numberOfLines={2}>
                            This Is{'\n'}
                            {featured.name}
                          </Text>
                        </Pressable>
                        <View style={styles.coverOverlay}>
                          <CoverPlayDisc
                            size={160}
                            playing={playing && contextId === `mix:${featured.id}`}
                            busy={preparing && contextId === `mix:${featured.id}`}
                            onPlay={() => {
                              if (contextId === `mix:${featured.id}`) void togglePlay();
                              else if (thisIsTracks.length) {
                                void playCollection(thisIsTracks, { contextId: `mix:${featured.id}` });
                              } else if (featured) {
                                void playCollection([], { contextId: `mix:${featured.id}`, seed: featured });
                              }
                            }}
                          />
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          if (thisIsTracks.length)
                            void playCollection(thisIsTracks, { contextId: `mix:${featured.id}` });
                          else router.push({ pathname: '/artist/[id]', params: { id: featured.id } });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`This Is ${featured.name}`}>
                        <Text style={[styles.featName, { color: c.text }]} numberOfLines={1}>
                          This Is {featured.name}
                        </Text>
                        <Text style={[styles.featSub, { color: c.textSub }]}>Popular mix</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              ) : null}

              {feed.map((item) => (
                <SearchResultRow
                  key={item.id}
                  item={item}
                  onPress={() => openItem(item, playContext)}
                  onMore={item.type === 'Audio' ? () => actions.open(item) : undefined}
                />
              ))}
              {songItems.length ? (
                <Pressable
                  onPress={() => setFilter('Audio')}
                  style={styles.showAll}
                  accessibilityRole="button"
                  accessibilityLabel="Show all songs">
                  <Text style={[styles.showAllText, { color: c.accent }]}>Show all songs</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={pagedItems}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <SearchResultRow
              item={item}
              onPress={() => openItem(item, pagedItems)}
              onMore={item.type === 'Audio' ? () => actions.open(item) : undefined}
            />
          )}
          ListEmptyComponent={
            paged.isLoading ? (
              <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
            ) : (
              <EmptyState title={`No results for “${q}”`} subtitle="Try another spelling or filter." />
            )
          }
          ListFooterComponent={
            paged.isFetchingNextPage ? <ActivityIndicator color={c.text} style={{ marginVertical: 16 }} /> : null
          }
          onEndReached={() => {
            if (paged.hasNextPage && !paged.isFetchingNextPage) void paged.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        subtitle={actions.target?.album}
        actions={actions.actions}
        onClose={actions.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 4,
    marginBottom: 10,
  },
  searchFlex: { flex: 1 },
  chips: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: 6, alignItems: 'center' },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    marginBottom: 10,
    marginTop: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  recentText: { flex: 1, fontSize: 16, fontWeight: '600' },
  tileGrid: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    height: 100,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  tileLabel: { color: '#fff', fontWeight: '800', fontSize: 16, zIndex: 1 },
  tileArt: {
    position: 'absolute',
    right: -8,
    bottom: -12,
    transform: [{ rotate: '24deg' }],
  },
  showAll: { paddingHorizontal: spacing.lg, paddingVertical: 16 },
  showAllText: { fontWeight: '800', fontSize: 15 },
  featuring: {
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    marginBottom: 14,
  },
  featuringRail: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: 12 },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    pointerEvents: 'box-none',
  },
  featCard: { width: 160 },
  featArt: { width: 160, height: 160, borderRadius: 4, overflow: 'hidden' },
  featBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  featWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    opacity: 0.92,
  },
  featThisIs: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 20,
  },
  featName: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  featSub: { fontSize: 12, marginTop: 2 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
});
