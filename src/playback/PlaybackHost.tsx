import { useEffect, useRef } from 'react';

import { createApi } from '@/api/jellyfin';
import { queryClient } from '@/api/query';
import { queryKeys } from '@/api/query-keys';
import { playback } from '@/playback/engine';
import { adoptRemoteIfIdle } from '@/playback/handoff';
import { bindPlayerStore } from '@/store/player';
import { useAuth } from '@/store/auth';
import { useDownloads } from '@/store/downloads';
import { useLibrary } from '@/store/library';
import { useRecents } from '@/store/recents';

export function PlaybackHost() {
  const session = useAuth((s) => s.session);
  const hadSession = useRef(false);
  const identity = useRef<string | null>(null);

  useEffect(() => {
    const unbind = bindPlayerStore();
    return () => {
      unbind();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      playback.detach();
      if (hadSession.current) {
        void playback.reset();
        queryClient.clear();
      }
      hadSession.current = false;
      identity.current = null;
      useLibrary.getState().setMusicViewId(null);
      return;
    }

    const key = `${session.serverUrl}:${session.userId}`;
    useRecents.getState().adopt(key);
    if (identity.current && identity.current !== key) {
      queryClient.clear();
    }
    identity.current = key;
    hadSession.current = true;
    let cancelled = false;
    (async () => {
      void useDownloads.getState().pruneMissing();
      await playback.attach(session);
      if (cancelled) return;
      try {
        await adoptRemoteIfIdle(session);
      } catch {
        // Handoff is best-effort; local persist / idle start still works.
      }
      try {
        const views = await queryClient.fetchQuery({
          queryKey: queryKeys.userViews.detail(session.userId),
          queryFn: () => createApi(session).userViews(),
          staleTime: 10 * 60_000,
        });
        const music = views.items?.find((view) => view.collectionType === 'music');
        if (!cancelled) {
          useLibrary.getState().setMusicViewId(music?.id ?? null);
        }
      } catch {
        if (!cancelled) useLibrary.getState().setMusicViewId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return null;
}
