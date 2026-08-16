import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlbumTracks, useFavoriteMutation, useItem } from '@/api/hooks';
import { ActionSheet } from '@/components/ActionSheet';
import { CoverArt } from '@/components/CoverArt';
import { IconButton } from '@/components/IconButton';
import { TrackRow } from '@/components/TrackRow';
import { useTrackActions } from '@/components/useTrackActions';
import { spacing } from '@/constants/theme';
import { groupAlbumDiscs } from '@/lib/album';
import { artistLine, formatTicks, plural, yearOf } from '@/lib/format';
import { closeOverlay } from '@/lib/navigation';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const album = useItem(id);
  const tracks = useAlbumTracks(id);
  const playItems = usePlayer((s) => s.playItems);
  const actions = useTrackActions();
  const favorite = useFavoriteMutation();
  const items = tracks.data ?? [];
  const discs = useMemo(() => groupAlbumDiscs(items), [items]);
  const multiDisc = discs.length > 1;
  const collection = useCollectionPlayback(id, items, album.data);
  const albumPlaying = collection.playing || collection.busy;
  const bottomPad = useNowPlayingPadding();
  const artistId = album.data?.albumArtists?.[0]?.id ?? album.data?.artistItems?.[0]?.id;
  const meta = [
    yearOf(album.data ?? {}),
    items.length ? plural(items.length, 'song') : null,
    album.data?.runTimeTicks || album.data?.cumulativeRunTimeTicks
      ? formatTicks(album.data.cumulativeRunTimeTicks ?? album.data.runTimeTicks)
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
      </View>

      <View style={styles.artWrap}>
        <CoverArt item={album.data} size={220} />
      </View>

      <Text style={[styles.title, { color: c.text }]}>{album.data?.name ?? (album.isLoading ? '' : 'Album')}</Text>

      {artistId ? (
        <Pressable
          style={styles.artistRow}
          onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artistId } })}>
          <CoverArt item={album.data} size={24} rounded="circle" />
          <Text style={[styles.artistName, { color: c.text }]}>{artistLine(album.data ?? {})}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.artistName, { color: c.text, paddingHorizontal: spacing.lg }]}>
          {artistLine(album.data ?? {})}
        </Text>
      )}

      <Text style={[styles.meta, { color: c.textMuted }]}>{meta}</Text>

      <View style={styles.actions}>
        <IconButton
          name={album.data?.userData?.isFavorite ? 'heart' : 'heart-outline'}
          color={album.data?.userData?.isFavorite ? c.accent : c.textSub}
          accessibilityLabel="Like album"
          onPress={() =>
            album.data && favorite.mutate({ item: album.data, favorite: !album.data.userData?.isFavorite })
          }
        />
        <IconButton
          name="ellipsis-horizontal"
          color={c.textSub}
          accessibilityLabel="More"
          onPress={() => album.data && actions.open(album.data)}
        />
        <View style={{ flex: 1 }} />
        <IconButton
          name="shuffle"
          color={c.text}
          accessibilityLabel="Shuffle album"
          onPress={collection.shuffle}
        />
        <Pressable
          onPress={collection.play}
          style={[styles.play, { backgroundColor: c.accent }]}
          accessibilityLabel={collection.busy ? 'Loading' : albumPlaying ? 'Pause' : 'Play'}>
          {collection.busy ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Ionicons name={albumPlaying ? 'pause' : 'play'} size={28} color={c.onAccent} />
          )}
        </Pressable>
      </View>

      {discs.map((group) => (
        <View key={group.disc}>
          {multiDisc ? (
            <Text style={[styles.disc, { color: c.textMuted }]}>Disc {group.disc}</Text>
          ) : null}
          {group.tracks.map((item, index) => (
            <TrackRow
              key={item.id}
              item={item}
              index={index}
              showCover={false}
              subtitle={artistLine(item)}
              onPress={() =>
                void playItems(items, items.findIndex((row) => row.id === item.id), { contextId: id })
              }
              onMore={() => actions.open(item)}
            />
          ))}
        </View>
      ))}

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        subtitle={album.data?.name}
        actions={actions.actions}
        onClose={actions.close}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: spacing.lg, marginBottom: 8 },
  artWrap: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: spacing.lg },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    marginTop: 10,
  },
  artistName: { fontWeight: '700', fontSize: 14 },
  meta: { paddingHorizontal: spacing.lg, marginTop: 6, fontSize: 13 },
  disc: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: 12,
    marginBottom: 8,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
