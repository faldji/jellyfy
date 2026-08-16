import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authorizationHeader } from '@/api/client';
import { createApi } from '@/api/jellyfin';
import type { BaseItem } from '@/api/types';
import { getSession } from '@/store/auth';

export type DownloadRecord = {
  id: string;
  name: string;
  artists?: string[];
  album?: string;
  albumId?: string;
  imageTags?: BaseItem['imageTags'];
  albumPrimaryImageTag?: string;
  runTimeTicks?: number;
  uri: string;
  bytes?: number;
  downloadedAt: string;
  ownerId?: string;
};

type DownloadsState = {
  items: Record<string, DownloadRecord>;
  progress: Record<string, number>;
  download: (item: BaseItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  isDownloaded: (id: string) => boolean;
  recordFor: (id: string) => DownloadRecord | undefined;
  pruneMissing: () => Promise<void>;
};

function downloadsDir(): Directory {
  return new Directory(Paths.document, 'jellyfy-downloads');
}

export const useDownloads = create<DownloadsState>()(
  persist(
    (set, get) => ({
      items: {},
      progress: {},

      recordFor(id) {
        const record = get().items[id];
        if (!record) return undefined;
        const uid = getSession()?.userId;
        if (record.ownerId && uid && record.ownerId !== uid) return undefined;
        return record;
      },

      isDownloaded(id) {
        return Boolean(get().recordFor(id));
      },

      async pruneMissing() {
        if (Platform.OS === 'web') return;
        const items = { ...get().items };
        let changed = false;
        for (const [id, record] of Object.entries(items)) {
          try {
            const file = new File(record.uri);
            if (!file.exists) {
              delete items[id];
              changed = true;
            }
          } catch {
            delete items[id];
            changed = true;
          }
        }
        if (changed) set({ items });
      },

      async download(item) {
        if (Platform.OS === 'web') {
          throw new Error('Downloads are available in the iOS and Android apps.');
        }
        const session = getSession();
        if (!session) throw new Error('Not signed in.');
        const api = createApi(session);
        const dir = downloadsDir();
        if (!dir.exists) {
          dir.create();
        }
        const file = new File(dir, `${item.id}.audio`);
        set((state) => ({ progress: { ...state.progress, [item.id]: 0 } }));
        try {
          const downloaded = await File.downloadFileAsync(api.downloadUrl(item.id), file, {
            headers: {
              Authorization: authorizationHeader(session),
            },
            idempotent: true,
            onProgress: ({ bytesWritten, totalBytes }) => {
              const ratio = totalBytes > 0 ? bytesWritten / totalBytes : 0;
              set((state) => ({ progress: { ...state.progress, [item.id]: ratio } }));
            },
          });
          const record: DownloadRecord = {
            id: item.id,
            name: item.name ?? 'Track',
            artists: item.artists,
            album: item.album,
            albumId: item.albumId,
            imageTags: item.imageTags,
            albumPrimaryImageTag: item.albumPrimaryImageTag,
            runTimeTicks: item.runTimeTicks,
            uri: downloaded.uri,
            bytes: downloaded.size ?? undefined,
            downloadedAt: new Date().toISOString(),
            ownerId: session.userId,
          };
          set((state) => {
            const progress = { ...state.progress };
            delete progress[item.id];
            return { items: { ...state.items, [item.id]: record }, progress };
          });
        } catch (error) {
          try {
            if (file.exists) file.delete();
          } catch {
            // Partial file is optional to clean up.
          }
          set((state) => {
            const progress = { ...state.progress };
            delete progress[item.id];
            return { progress };
          });
          throw error;
        }
      },

      async remove(id) {
        const record = get().items[id];
        if (record && Platform.OS !== 'web') {
          try {
            const file = new File(record.uri);
            if (file.exists) file.delete();
          } catch {
            // Ignore missing files.
          }
        }
        set((state) => {
          const items = { ...state.items };
          delete items[id];
          return { items };
        });
      },
    }),
    {
      name: 'jellyfy.downloads',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
