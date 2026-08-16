import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  musicScope,
  useAddToPlaylist,
  useDeletePlaylist,
  useItem,
  useItems,
  useMusicParent,
  usePlaylistItems,
  useRenamePlaylist,
} from '@/api/hooks';
import { ActionSheet } from '@/components/ActionSheet';
import { CoverArt } from '@/components/CoverArt';
import { GlassSurface } from '@/components/GlassSurface';
import { IconButton } from '@/components/IconButton';
import { CollectionActions } from '@/components/PlayControls';
import { TrackRow } from '@/components/TrackRow';
import { useTrackActions } from '@/components/useTrackActions';
import { UserAvatar } from '@/components/UserAvatar';
import { radii, spacing } from '@/constants/theme';
import { artistLine } from '@/lib/format';
import { closeOverlay } from '@/lib/navigation';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/store/auth';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const userName = useAuth((s) => s.session?.userName);
  const playlist = useItem(id);
  const tracks = usePlaylistItems(id);
  const parentId = useMusicParent();
  const items = tracks.data ?? [];
  const [suggestReady, setSuggestReady] = useState(false);
  useEffect(() => {
    if (!items.length) return;
    const handle = setTimeout(() => setSuggestReady(true), 480);
    return () => clearTimeout(handle);
  }, [items.length]);
  const suggested = useItems(
    ['playlist-suggested', id],
    {
      includeItemTypes: ['Audio'],
      sortBy: ['Random'],
      limit: 12,
      ...musicScope(parentId),
    },
    suggestReady,
    { staleTime: 30 * 60_000 }
  );
  const add = useAddToPlaylist();
  const rename = useRenamePlaylist();
  const remove = useDeletePlaylist();
  const playItems = usePlayer((s) => s.playItems);
  const actions = useTrackActions({ playlistId: id });
  const collection = useCollectionPlayback(id, items, playlist.data);
  const bottomPad = useNowPlayingPadding();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nextName, setNextName] = useState('');
  const canEdit = playlist.data?.canDelete !== false;
  const ownerLabel = canEdit ? (userName ?? 'you') : 'Shared playlist';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
      </View>

      <View style={styles.hero}>
        <CoverArt item={playlist.data} size={120} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>{playlist.data?.name ?? 'Playlist'}</Text>
          <View style={styles.owner}>
            {canEdit ? <UserAvatar size={22} /> : null}
            <Text style={{ color: c.text, fontWeight: '600' }}>{ownerLabel}</Text>
          </View>
        </View>
      </View>

      {canEdit ? (
        <View style={styles.toolbar}>
          <IconButton name="ellipsis-horizontal" color={c.textSub} accessibilityLabel="More" onPress={() => setMenu(true)} />
        </View>
      ) : null}

      <CollectionActions
        playing={collection.playing}
        busy={collection.busy}
        onPlay={collection.play}
        onShuffle={collection.shuffle}
      />

      {canEdit ? (
        <Pressable
          style={[styles.addPill, { backgroundColor: c.text }]}
          onPress={() => router.push({ pathname: '/add-to-playlist', params: { playlistId: id } })}>
          <Text style={[styles.addPillText, { color: c.bg }]}>+ Add to this playlist</Text>
        </Pressable>
      ) : null}

      {items.map((item, index) => (
        <TrackRow
          key={`${item.id}-${item.playlistItemId ?? index}`}
          item={item}
          subtitle={artistLine(item)}
          onPress={() => void playItems(items, index, { contextId: id })}
          onMore={() => actions.open(item)}
        />
      ))}

      {canEdit && suggested.data?.items?.length ? (
        <View style={{ marginTop: 24 }}>
          <Text style={[styles.recTitle, { color: c.text }]}>Songs you might add</Text>
          {suggested.data.items
            .filter((s) => !items.some((t) => t.id === s.id))
            .slice(0, 8)
            .map((item) => (
              <View key={item.id} style={styles.suggestRow}>
                <View style={{ flex: 1 }}>
                  <TrackRow item={item} onPress={() => void playItems([item], 0)} />
                </View>
                <IconButton
                  name="add-circle-outline"
                  accessibilityLabel="Add"
                  onPress={() => id && add.mutate({ playlistId: id, ids: [item.id] })}
                />
              </View>
            ))}
        </View>
      ) : null}

      <ActionSheet
        visible={actions.visible}
        title={actions.target?.name}
        actions={actions.actions}
        onClose={actions.close}
      />
      <ActionSheet
        visible={menu}
        title={playlist.data?.name}
        subtitle={`by ${ownerLabel}`}
        actions={
          canEdit
            ? [
                {
                  key: 'add',
                  label: 'Add songs',
                  onPress: () => router.push({ pathname: '/add-to-playlist', params: { playlistId: id } }),
                },
                {
                  key: 'rename',
                  label: 'Rename',
                  onPress: () => {
                    setNextName(playlist.data?.name ?? '');
                    setRenaming(true);
                  },
                },
                {
                  key: 'delete',
                  label: 'Delete playlist',
                  destructive: true,
                  onPress: () => {
                    if (!id) return;
                    remove.mutate(id, { onSuccess: () => closeOverlay(router) });
                  },
                },
              ]
            : []
        }
        onClose={() => setMenu(false)}
      />
      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <View style={[styles.renameBackdrop, { backgroundColor: c.overlay }]}>
          <GlassSurface style={[styles.renameCard, { borderColor: c.hairline }]}>
            <Text style={[styles.renameTitle, { color: c.text }]}>Rename playlist</Text>
            <TextInput
              value={nextName}
              onChangeText={setNextName}
              autoFocus
              style={[styles.renameInput, { color: c.text, borderBottomColor: c.text }]}
            />
            <View style={styles.renameRow}>
              <Pressable onPress={() => setRenaming(false)} style={[styles.renameBtn, { borderColor: c.textMuted }]}>
                <Text style={{ color: c.text, fontWeight: '800' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const name = nextName.trim();
                  if (!id || !name) return;
                  rename.mutate(
                    { playlistId: id, name, ids: items.map((item) => item.id) },
                    { onSuccess: () => setRenaming(false) }
                  );
                }}
                style={[styles.renameBtn, { backgroundColor: c.accent, borderColor: c.accent }]}>
                <Text style={{ color: c.onAccent, fontWeight: '800' }}>Save</Text>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { paddingHorizontal: spacing.lg },
  hero: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  toolbar: { flexDirection: 'row', paddingHorizontal: spacing.md, marginTop: 8 },
  addPill: {
    alignSelf: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  addPillText: { fontWeight: '800', fontSize: 15 },
  recTitle: { fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, marginBottom: 8 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  renameBackdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  renameCard: { borderRadius: radii.lg, padding: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  renameTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  renameInput: { fontSize: 20, fontWeight: '700', borderBottomWidth: 2, paddingVertical: 8 },
  renameRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  renameBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1 },
});
