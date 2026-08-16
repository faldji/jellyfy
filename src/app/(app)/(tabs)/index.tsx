import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useItems, useLatest, useMusicParent, useSimilar, useSrHomeTracks } from '@/api/hooks';
import type { BaseItem } from '@/api/types';
import { CoverArt } from '@/components/CoverArt';
import { CoverPlayDisc } from '@/components/CoverActions';
import { EmptyState } from '@/components/EmptyState';
import { LikedCover } from '@/components/LikedCover';
import { MediaCard } from '@/components/MediaCard';
import { HorizontalRail, Section } from '@/components/Section';
import { Skeleton } from '@/components/Skeleton';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { UserAvatar } from '@/components/UserAvatar';
import { CARD_SIZE, radii, spacing } from '@/constants/theme';
import { albumsFromAudio, artistsFromAudio, mergeItemsById } from '@/lib/derive-media';
import { normId } from '@/lib/ids';
import { isAudio } from '@/lib/media';
import { greetingForNow } from '@/lib/format';
import { hrefForItem } from '@/lib/navigation';
import { canSeeAll, takeRail } from '@/lib/rail';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { HOME_SECTION_META, sectionConfig, useHomeLayout } from '@/store/home';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useRecents } from '@/store/recents';
import { useColors } from '@/theme/useColors';

type HomeFilter = 'all' | 'albums' | 'artists' | 'playlists';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useColors();
  const [filter, setFilter] = useState<HomeFilter>('all');
  const parentId = useMusicParent();
  const recents = useRecents((s) => s.items);
  const playItems = usePlayer((s) => s.playItems);
  const layout = useHomeLayout((s) => s.layout);
  const setLibraryTab = useLibrary((s) => s.setTab);
  const setLikedOnly = useLibrary((s) => s.setLikedOnly);
  const bottomPad = useNowPlayingPadding();
  const scope = musicScope(parentId);
  const [railsReady, setRailsReady] = useState(false);
  useEffect(() => {
    const handle = setTimeout(() => setRailsReady(true), 0);
    return () => clearTimeout(handle);
  }, []);

  const openLibrary = (tab: 'albums' | 'artists' | 'playlists' | 'all', liked = false) => {
    setLibraryTab(tab === 'all' ? 'all' : tab);
    setLikedOnly(liked);
    router.push('/(app)/(tabs)/library');
  };

  const likedSongs = useItems(['home-liked-songs'], {
    includeItemTypes: ['Audio'],
    filters: ['IsFavorite'],
    sortBy: ['DatePlayed', 'DateCreated'],
    sortOrder: 'Descending',
    limit: 80,
    ...scope,
  });
  const albumsLikeCap = sectionConfig(layout, 'albumsYouLike').limit;
  const favArtistsCap = sectionConfig(layout, 'favoriteArtists').limit;
  const latestCap = sectionConfig(layout, 'recentlyAdded').limit;
  const playlistCap = sectionConfig(layout, 'playlists').limit;
  const moreLikeCap = sectionConfig(layout, 'moreLike').limit;
  const recentsCap = sectionConfig(layout, 'recents').limit;

  const likedAlbums = useItems(
    ['home-liked-albums'],
    {
      includeItemTypes: ['MusicAlbum'],
      filters: ['IsFavorite'],
      sortBy: ['DatePlayed', 'DateCreated'],
      sortOrder: 'Descending',
      limit: albumsLikeCap + 1,
      ...scope,
    },
    railsReady
  );
  const likedArtists = useItems(
    ['home-liked-artists'],
    {
      includeItemTypes: ['MusicArtist'],
      filters: ['IsFavorite'],
      sortBy: ['DatePlayed', 'SortName'],
      sortOrder: 'Descending',
      limit: favArtistsCap + 1,
      ...scope,
    },
    railsReady
  );
  const latestAlbums = useLatest(
    { includeItemTypes: ['MusicAlbum'], ...scope, limit: latestCap + 1 },
    railsReady
  );
  const playlists = useItems(
    ['home-playlists'],
    {
      includeItemTypes: ['Playlist'],
      sortBy: ['DatePlayed'],
      sortOrder: 'Descending',
      limit: playlistCap + 1,
      ...scope,
    },
    railsReady && (filter === 'all' || filter === 'playlists')
  );

  const likedTrackList = likedSongs.data?.items ?? [];
  const likesPlayback = useCollectionPlayback('likes', likedTrackList);
  const featureAlbums = useMemo(() => {
    const likedCounts = new Map<string, number>();
    for (const track of likedTrackList) {
      if (!track.albumId) continue;
      likedCounts.set(track.albumId, (likedCounts.get(track.albumId) ?? 0) + 1);
    }
    const derived = mergeItemsById(albumsFromAudio(likedTrackList), likedAlbums.data?.items);
    derived.sort((a, b) => (likedCounts.get(b.id) ?? 0) - (likedCounts.get(a.id) ?? 0));
    return derived;
  }, [likedAlbums.data?.items, likedTrackList]);

  const followedArtists = likedArtists.data?.items ?? [];
  const favoriteArtists = useMemo(() => {
    return mergeItemsById(likedArtists.data?.items, artistsFromAudio(likedTrackList));
  }, [likedArtists.data?.items, likedTrackList]);
  const likedAlbumList = likedAlbums.data?.items ?? [];
  const likedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of [...likedTrackList, ...likedAlbumList, ...followedArtists]) {
      const key = normId(item.id);
      if (key) ids.add(key);
    }
    return ids;
  }, [followedArtists, likedAlbumList, likedTrackList]);

  const markLiked = (items: BaseItem[]) =>
    items.map((item) => {
      if (item.userData?.isFavorite || !likedIds.has(normId(item.id))) return item;
      return { ...item, userData: { key: item.userData?.key ?? item.id, ...item.userData, isFavorite: true } };
    });

  const seedArtist =
    likedArtists.data?.items?.[0] ??
    favoriteArtists[0] ??
    recents.find((item) => item.type === 'MusicArtist');

  const moreLikeOn = sectionConfig(layout, 'moreLike').visible && (filter === 'all' || filter === 'artists');
  const recOn = sectionConfig(layout, 'recommendedForYou').visible && filter === 'all';
  const similar = useSimilar(railsReady && moreLikeOn ? seedArtist?.id : undefined, moreLikeCap + 1);
  const recommendedLimit = sectionConfig(layout, 'recommendedForYou').limit;
  const recommended = useSrHomeTracks(recommendedLimit, railsReady && recOn);

  const refreshing =
    likedSongs.isRefetching ||
    likedAlbums.isRefetching ||
    likedArtists.isRefetching ||
    latestAlbums.isRefetching ||
    recommended.isRefetching;
  const loadingHero = likedSongs.isLoading || likedAlbums.isLoading;

  const chips: { key: HomeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'albums', label: 'Albums' },
    { key: 'artists', label: 'Artists' },
    { key: 'playlists', label: 'Playlists' },
  ];

  const showEmpty =
    !loadingHero &&
    featureAlbums.length === 0 &&
    !(latestAlbums.data?.length) &&
    favoriteArtists.length === 0 &&
    recents.length === 0 &&
    !(playlists.data?.items?.length) &&
    !(recommended.data?.length);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.bg }]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void likedSongs.refetch();
            void likedAlbums.refetch();
            void likedArtists.refetch();
            void latestAlbums.refetch();
            void playlists.refetch();
            void recommended.refetch();
          }}
          tintColor={c.text}
        />
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerRow}>
        <UserAvatar onPress={() => router.push('/settings')} />
        {chips.map((chip) => {
          const on = filter === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={[
                styles.filter,
                {
                  backgroundColor: on ? c.accent : c.glass,
                  borderColor: on ? c.accent : c.hairline,
                },
              ]}>
              <Text style={[styles.filterText, { color: on ? c.onAccent : c.text }]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filter === 'all' ? (
        <Text style={[styles.hello, { color: c.text }]}>{greetingForNow()}</Text>
      ) : null}

      {showEmpty ? (
        <EmptyState title="Nothing to show yet" subtitle="Add music on your Jellyfin server, then pull to refresh." />
      ) : null}

      {loadingHero ? (
        <View style={styles.skelRow}>
          <Skeleton style={{ width: CARD_SIZE, height: CARD_SIZE }} />
          <Skeleton style={{ width: CARD_SIZE, height: CARD_SIZE }} />
        </View>
      ) : null}

      {layout.map((section) => {
        if (!section.visible) return null;
        const show = (kind: HomeFilter) => filter === 'all' || filter === kind;
        const rail = (items: BaseItem[], size = 148) => (
          <HorizontalRail>
            {markLiked(items).map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                size={size}
                playQueue={items.some((row) => isAudio(row)) ? items : undefined}
                continueWithSr={section.id === 'recommendedForYou'}
                onPress={() => {
                  if (item.type === 'Audio') {
                    const fromSr = section.id === 'recommendedForYou';
                    void playItems(fromSr ? items : [item], fromSr ? items.findIndex((row) => row.id === item.id) : 0, {
                      continueWithSr: fromSr,
                    });
                  }
                  else router.push(hrefForItem(item));
                }}
              />
            ))}
          </HorizontalRail>
        );

        if (section.id === 'recommendedForYou' && filter === 'all' && (recommended.data?.length ?? 0) > 0) {
          const { shown } = takeRail(recommended.data ?? [], section.limit);
          if (!shown.length) return null;
          return (
            <Section key={section.id} title={HOME_SECTION_META.recommendedForYou.label}>
              {rail(shown)}
            </Section>
          );
        }

        if (section.id === 'albumsYouLike' && show('albums') && featureAlbums.length) {
          const { shown } = takeRail(featureAlbums, section.limit);
          if (!shown.length) return null;
          return (
            <Section
              key={section.id}
              title={HOME_SECTION_META.albumsYouLike.label}
              onSeeAll={
                canSeeAll(likedAlbumList.length, shown.length) ? () => openLibrary('albums', true) : undefined
              }>
              {rail(shown, 168)}
            </Section>
          );
        }

        if (section.id === 'recentlyAdded' && show('albums') && latestAlbums.data?.length) {
          const all = latestAlbums.data;
          const { shown } = takeRail(all, section.limit);
          if (!shown.length) return null;
          return (
            <Section
              key={section.id}
              title={HOME_SECTION_META.recentlyAdded.label}
              onSeeAll={canSeeAll(all.length, shown.length) ? () => openLibrary('albums') : undefined}>
              {rail(shown, 168)}
            </Section>
          );
        }

        if (section.id === 'recents' && filter === 'all') {
          const { shown: recentCards } = takeRail(recents, recentsCap);
          return (
            <Section
              key={section.id}
              title={HOME_SECTION_META.recents.label}>
              <HorizontalRail>
                <View style={{ width: 148 }}>
                  <View>
                    <Pressable onPress={() => router.push('/likes')} accessibilityRole="button" accessibilityLabel="Liked Songs">
                      <LikedCover size={148} />
                    </Pressable>
                    <View style={styles.coverOverlay}>
                      <CoverPlayDisc
                        size={148}
                        playing={likesPlayback.playing}
                        busy={likesPlayback.busy}
                        onPlay={likesPlayback.play}
                      />
                    </View>
                  </View>
                  <Pressable onPress={() => router.push('/likes')} accessibilityRole="button" accessibilityLabel="Liked Songs">
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: likesPlayback.playing ? c.accent : c.text },
                      ]}>
                      Liked Songs
                    </Text>
                    <Text style={[styles.cardSub, { color: c.textSub }]}>Playlist</Text>
                  </Pressable>
                </View>
                {markLiked(recentCards as BaseItem[]).map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    playQueue={recentCards.filter((row) => row.type === 'Audio') as BaseItem[]}
                    onPress={() => {
                      if (item.type === 'Audio') {
                        const audio = recentCards.filter((row) => row.type === 'Audio') as BaseItem[];
                        void playItems(audio.length ? audio : [item as BaseItem], Math.max(0, audio.findIndex((row) => row.id === item.id)));
                      } else router.push(hrefForItem(item));
                    }}
                  />
                ))}
              </HorizontalRail>
            </Section>
          );
        }

        if (section.id === 'moreLike' && show('artists') && seedArtist) {
          const similarItems = (similar.data?.items ?? []).filter((item) => item.id !== seedArtist.id);
          const { shown } = takeRail(similarItems, section.limit);
          if (!shown.length) return null;
          return (
            <View key={section.id}>
              <View style={styles.moreLike}>
                <Pressable
                  style={styles.moreLikeMain}
                  onPress={() => router.push({ pathname: '/artist/[id]', params: { id: seedArtist.id } })}>
                  <CoverArt item={seedArtist} size={52} rounded="circle" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.moreKicker, { color: c.textMuted }]}>More like</Text>
                    <Text style={[styles.moreName, { color: c.text }]}>{seedArtist.name}</Text>
                  </View>
                </Pressable>
                {canSeeAll(similarItems.length, shown.length) ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/artist/[id]', params: { id: seedArtist.id } })}
                    accessibilityRole="button"
                    accessibilityLabel="Show all">
                    <Text style={[styles.seeAll, { color: c.accent }]}>Show all</Text>
                  </Pressable>
                ) : null}
              </View>
              {rail(shown)}
            </View>
          );
        }

        if (section.id === 'favoriteArtists' && show('artists') && favoriteArtists.length) {
          const { shown } = takeRail(favoriteArtists, section.limit);
          if (!shown.length) return null;
          return (
            <Section
              key={section.id}
              title={HOME_SECTION_META.favoriteArtists.label}
              onSeeAll={
                canSeeAll(followedArtists.length, shown.length) ? () => openLibrary('artists', true) : undefined
              }>
              {rail(shown)}
            </Section>
          );
        }

        if (section.id === 'playlists' && show('playlists') && playlists.data?.items?.length) {
          const all = playlists.data.items;
          const { shown } = takeRail(all, section.limit);
          if (!shown.length) return null;
          return (
            <Section
              key={section.id}
              title={HOME_SECTION_META.playlists.label}
              onSeeAll={canSeeAll(all.length, shown.length) ? () => openLibrary('playlists') : undefined}>
              {rail(shown)}
            </Section>
          );
        }

        return null;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    pointerEvents: 'box-none',
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  hello: {
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    marginBottom: 4,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterText: { fontWeight: '700', fontSize: 14 },
  cardTitle: { fontWeight: '700', fontSize: 13, marginTop: 8 },
  cardSub: { fontSize: 12, marginTop: 2 },
  moreLike: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 8,
  },
  moreLikeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  moreKicker: { fontSize: 12 },
  moreName: { fontSize: 22, fontWeight: '800' },
  skelRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginTop: 24 },
});
