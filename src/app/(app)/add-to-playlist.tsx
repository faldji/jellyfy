import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { musicScope, useAddToPlaylist, useCreatePlaylist, useItems, useMusicParent } from '@/api/hooks';
import { CoverArt } from '@/components/CoverArt';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { SearchField } from '@/components/SearchField';
import { TrackRow } from '@/components/TrackRow';
import { spacing } from '@/constants/theme';
import { useDebounced } from '@/hooks/use-debounce';
import { SheetGrabber, useSwipeDownClose } from '@/hooks/use-swipe-down-close';
import { closeOverlay } from '@/lib/navigation';
import { usePlayer } from '@/store/player';
import { useColors } from '@/theme/useColors';

export default function AddToPlaylistScreen() {
  const { ids, playlistId } = useLocalSearchParams<{ ids?: string; playlistId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const parentId = useMusicParent();
  const add = useAddToPlaylist();
  const create = useCreatePlaylist();
  const playItem = usePlayer((s) => s.playItem);
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim(), 250);
  const trackIds = (ids ?? '').split(',').filter(Boolean);
  const close = () => closeOverlay(router);
  const { gesture, style } = useSwipeDownClose(close);

  const playlists = useItems(
    ['user-playlists'],
    {
      includeItemTypes: ['Playlist'],
      sortBy: ['SortName'],
      limit: 200,
      ...musicScope(parentId),
    },
    !playlistId
  );

  const songs = useItems(
    ['add-songs', playlistId, q],
    {
      includeItemTypes: ['Audio'],
      searchTerm: q || undefined,
      sortBy: q ? ['SortName'] : ['Random'],
      limit: 60,
      ...musicScope(parentId),
    },
    Boolean(playlistId)
  );

  const header = (
    <GestureDetector gesture={gesture}>
      <View>
        <SheetGrabber color={c.textMuted} />
        <View style={styles.nav}>
          <IconButton
            name={playlistId ? 'chevron-back' : 'close'}
            accessibilityLabel={playlistId ? 'Back' : 'Close'}
            onPress={close}
          />
          <Text style={[styles.title, { color: c.text }]}>
            {playlistId ? 'Add to this playlist' : 'Add to playlist'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    </GestureDetector>
  );

  if (playlistId) {
    const items = songs.data?.items ?? [];
    return (
      <Animated.View style={[styles.screen, style, { backgroundColor: c.bg, paddingTop: insets.top + 2 }]}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {header}
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: 8 }}>
            <SearchField
              value={term}
              onChangeText={setTerm}
              placeholder="What would you like to add?"
              variant="surface"
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            {songs.isLoading ? (
              <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
            ) : items.length === 0 ? (
              <EmptyState title={q ? `No songs for “${q}”` : 'No songs'} subtitle="Try another search." />
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.suggestRow}>
                  <View style={{ flex: 1 }}>
                    <TrackRow
                      item={item}
                      onPress={() => add.mutate({ playlistId, ids: [item.id] })}
                      onCoverPlay={() => void playItem(item)}
                    />
                  </View>
                  <IconButton
                    name="add-circle-outline"
                    accessibilityLabel="Add"
                    onPress={() => add.mutate({ playlistId, ids: [item.id] })}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.screen, style, { backgroundColor: c.bg, paddingTop: insets.top + 2 }]}>
      {header}
      <Pressable
        style={styles.row}
        onPress={() => {
          create.mutate({ name: 'New playlist', ids: trackIds }, { onSuccess: close });
        }}>
        <View style={[styles.new, { backgroundColor: c.elevate }]}>
          <Text style={[styles.plus, { color: c.text }]}>+</Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>New playlist</Text>
      </Pressable>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {(playlists.data?.items ?? []).map((playlist) => (
          <Pressable
            key={playlist.id}
            style={styles.row}
            onPress={() => {
              add.mutate({ playlistId: playlist.id, ids: trackIds }, { onSuccess: close });
            }}>
            <CoverArt item={playlist} size={52} rounded="square" />
            <Text style={[styles.name, { color: c.text }]}>{playlist.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
  },
  title: { fontWeight: '800', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  new: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 28, fontWeight: '300' },
  name: { fontSize: 16, fontWeight: '600' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
});
