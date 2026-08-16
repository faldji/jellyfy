import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authorizationHeader } from '@/api/client';
import { useArtistTracks, useFavoriteMutation, useFansAlsoLike, useItem, useItems, useMusicParent, musicScope } from '@/api/hooks';
import { imageUrl } from '@/api/jellyfin';
import { ActionSheet } from '@/components/ActionSheet';
import { IconButton } from '@/components/IconButton';
import { LibraryRow } from '@/components/LibraryRow';
import { MediaCard } from '@/components/MediaCard';
import { HorizontalRail, Section } from '@/components/Section';
import { TrackRow } from '@/components/TrackRow';
import { useTrackActions } from '@/components/useTrackActions';
import { spacing } from '@/constants/theme';
import { closeOverlay, hrefForItem } from '@/lib/navigation';
import { rankPopularTracks, sortAlbumsLatest } from '@/lib/popular-tracks';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/store/auth';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const session = useAuth((s) => s.session);
  const parentId = useMusicParent();
  const artist = useItem(id);
  const favorite = useFavoriteMutation();
  const albums = useItems(
    ['artist-albums', id],
    {
      albumArtistIds: id ? [id] : undefined,
      includeItemTypes: ['MusicAlbum'],
      sortBy: ['PremiereDate', 'ProductionYear', 'DateCreated'],
      sortOrder: 'Descending',
      limit: 80,
      enableTotalRecordCount: true,
      ...musicScope(parentId),
    },
    Boolean(id)
  );
  const catalog = useArtistTracks(id, 200);
  const fansAlsoLike = useFansAlsoLike(id);
  const playItems = usePlayer((s) => s.playItems);
  const actions = useTrackActions();
  const songs = useMemo(
    () => rankPopularTracks(catalog.data ?? [], id ?? '', 5),
    [id, catalog.data]
  );
  const catalogSongs = catalog.data?.length ? catalog.data : songs;
  const collection = useCollectionPlayback(
    id,
    catalogSongs,
    artist.data ?? (id ? { id, type: 'MusicArtist' } : null)
  );
  const bottomPad = useNowPlayingPadding();
  const following = Boolean(artist.data?.userData?.isFavorite);
  const hero = session && artist.data ? imageUrl(session, artist.data, 900, { tokenInQuery: false }) : null;
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const allAlbums = useMemo(
    () => sortAlbumsLatest(albums.data?.items ?? []),
    [albums.data?.items]
  );
  const albumPreview = 5;
  const visibleAlbums = showAllAlbums ? allAlbums : allAlbums.slice(0, albumPreview);
  const moreAlbums = allAlbums.length > albumPreview;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: bottomPad }}>
      <View style={styles.hero}>
        {hero ? (
          <Image
            source={{
              uri: hero,
              headers: session ? { Authorization: authorizationHeader(session) } : undefined,
            }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}
        <LinearGradient colors={['transparent', c.bg]} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroNav, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => closeOverlay(router)} style={styles.back} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.heroName}>{artist.data?.name ?? ''}</Text>
      </View>

      <Text style={[styles.listeners, { color: c.textMuted }]}>
        {artist.data?.albumCount
          ? `${artist.data.albumCount} albums`
          : artist.data?.songCount
            ? `${artist.data.songCount} songs`
            : 'Artist'}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={() => artist.data && favorite.mutate({ item: artist.data, favorite: !following })}
          style={[
            styles.follow,
            { borderColor: following ? c.accent : c.text, backgroundColor: following ? c.accent : 'transparent' },
          ]}>
          <Text style={{ color: following ? c.onAccent : c.text, fontWeight: '700' }}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
        <IconButton
          name="radio-outline"
          color={c.textSub}
          accessibilityLabel="Start radio"
          onPress={() => id && router.push({ pathname: '/radio/[id]', params: { id } })}
        />
        <View style={{ flex: 1 }} />
        <IconButton name="shuffle" color={c.accent} accessibilityLabel="Shuffle" onPress={collection.shuffle} />
        <Pressable
          onPress={collection.play}
          style={[styles.play, { backgroundColor: c.accent }]}
          accessibilityLabel={collection.busy ? 'Loading' : collection.playing ? 'Pause' : 'Play'}>
          {collection.busy ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Ionicons name={collection.playing ? 'pause' : 'play'} size={26} color={c.onAccent} />
          )}
        </Pressable>
      </View>

      {songs.length ? (
        <Section title="Popular">
          {songs.map((item, index) => (
            <TrackRow
              key={item.id}
              item={item}
              index={index}
              onPress={() => {
                const pool = catalogSongs.length ? catalogSongs : songs;
                const at = pool.findIndex((track) => track.id === item.id);
                void playItems(pool, at >= 0 ? at : 0, { contextId: id });
              }}
              onMore={() => actions.open(item)}
            />
          ))}
        </Section>
      ) : null}

      {visibleAlbums.length ? (
        <Section
          title="Albums"
          onSeeAll={moreAlbums && !showAllAlbums ? () => setShowAllAlbums(true) : undefined}>
          {visibleAlbums.map((item) => (
            <LibraryRow
              key={item.id}
              item={item}
              subtitle={`Album${item.productionYear ? ` • ${item.productionYear}` : ''}`}
              onPress={() => router.push(hrefForItem(item))}
            />
          ))}
        </Section>
      ) : null}

      {artist.data?.overview ? (
        <Section title="About">
          <Text style={{ color: c.textSub, paddingHorizontal: 16, lineHeight: 20 }}>{artist.data.overview}</Text>
        </Section>
      ) : null}

      {fansAlsoLike.data?.length ? (
        <Section title="Fans also like">
          <HorizontalRail>
            {fansAlsoLike.data.map((item) => (
              <MediaCard key={item.id} item={item} onPress={() => router.push(hrefForItem(item))} />
            ))}
          </HorizontalRail>
        </Section>
      ) : null}

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        actions={actions.actions}
        onClose={actions.close}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 340, justifyContent: 'flex-end', backgroundColor: '#222' },
  heroNav: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  listeners: { paddingHorizontal: spacing.lg, marginTop: 10, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: 12,
    gap: 6,
  },
  follow: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
