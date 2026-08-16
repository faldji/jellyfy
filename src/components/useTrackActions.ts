import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useFavoriteMutation, useRemoveFromPlaylist } from '@/api/hooks';
import type { BaseItem } from '@/api/types';
import { isAudio } from '@/lib/media';
import type { SheetAction } from '@/components/ActionSheet';
import { useDownloads } from '@/store/downloads';
import { usePlayer } from '@/store/player';
import { useToast } from '@/store/toast';

export function useTrackActions(options?: { playlistId?: string }) {
  const router = useRouter();
  const [item, setItem] = useState<BaseItem | null>(null);
  const favorite = useFavoriteMutation();
  const removeFromPlaylist = useRemoveFromPlaylist();
  const toast = useToast((s) => s.show);
  const playNext = usePlayer((s) => s.playNext);
  const enqueue = usePlayer((s) => s.enqueue);
  const playItem = usePlayer((s) => s.playItem);
  const downloaded = useDownloads((s) => (item ? s.isDownloaded(item.id) : false));
  const downloading = useDownloads((s) => (item ? s.progress[item.id] != null : false));
  const playlistId = options?.playlistId;

  const actions: SheetAction[] = useMemo(() => {
    if (!item) return [];
    const liked = Boolean(item.userData?.isFavorite);
    const audio = isAudio(item);
    const list: SheetAction[] = [];

    if (audio) {
      list.push(
        { key: 'next', label: 'Play next', onPress: () => void playNext(item) },
        { key: 'queue', label: 'Add to queue', onPress: () => enqueue(item) },
        {
          key: 'playlist',
          label: 'Add to playlist',
          onPress: () => router.push({ pathname: '/add-to-playlist', params: { ids: item.id } }),
        }
      );
    } else {
      list.push({
        key: 'play',
        label: 'Play',
        onPress: () => void playItem(item),
      });
    }

    list.push({
      key: 'like',
      label:
        item.type === 'MusicArtist'
          ? liked
            ? 'Unfollow'
            : 'Follow'
          : liked
            ? 'Remove from Liked Songs'
            : 'Add to Liked Songs',
      onPress: () => favorite.mutate({ item, favorite: !liked }),
    });

    list.push({
      key: 'radio',
      label: 'Go to radio',
      onPress: () => router.push({ pathname: '/radio/[id]', params: { id: item.id } }),
    });

    if (audio && item.albumId) {
      list.push({
        key: 'album',
        label: 'Go to album',
        onPress: () => router.push({ pathname: '/album/[id]', params: { id: item.albumId! } }),
      });
    }
    const artistId = item.artistItems?.[0]?.id ?? item.albumArtists?.[0]?.id;
    if (artistId) {
      list.push({
        key: 'artist',
        label: 'Go to artist',
        onPress: () => router.push({ pathname: '/artist/[id]', params: { id: artistId } }),
      });
    }

    if (audio && playlistId && item.playlistItemId) {
      list.push({
        key: 'remove-playlist',
        label: 'Remove from this playlist',
        destructive: true,
        onPress: () =>
          removeFromPlaylist.mutate({ playlistId, entryIds: [item.playlistItemId!] }),
      });
    }

    if (audio && Platform.OS !== 'web') {
      list.push({
        key: 'download',
        label: downloaded ? 'Remove download' : downloading ? 'Downloading…' : 'Download',
        disabled: downloading,
        destructive: downloaded,
        onPress: () => {
          if (downloaded) {
            void useDownloads.getState().remove(item.id);
            toast('Removed download');
          } else {
            void useDownloads
              .getState()
              .download(item)
              .then(() => toast('Downloaded'))
              .catch((error: Error) => toast(error.message));
          }
        },
      });
    }
    return list;
  }, [
    downloaded,
    downloading,
    enqueue,
    favorite,
    item,
    playItem,
    playNext,
    playlistId,
    removeFromPlaylist,
    router,
    toast,
  ]);

  return {
    target: item,
    open: setItem,
    close: () => setItem(null),
    visible: Boolean(item),
    actions,
  };
}
