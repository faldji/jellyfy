import { createApi, type Session } from '@/api/jellyfin';
import type { BaseItem, RepeatMode, SessionInfo } from '@/api/types';
import { ticksToSeconds } from '@/lib/format';
import { sameId } from '@/lib/ids';
import { isAudio } from '@/lib/media';
import { resolvePlayAllLimit } from '@/lib/play-all';
import { playback, type RepeatModeUi } from '@/playback/engine';
import { useSettings } from '@/store/settings';
import { useToast } from '@/store/toast';

/** Only consider sessions that reported playback recently. */
const ACTIVE_WITHIN_SECONDS = 120;
const ID_CHUNK = 50;

function toRepeat(mode?: RepeatMode): RepeatModeUi {
  if (mode === 'RepeatOne') return 'one';
  if (mode === 'RepeatAll') return 'all';
  return 'off';
}

export function pickHandoffSession(
  sessions: SessionInfo[],
  local: { userId: string; deviceId: string }
): SessionInfo | null {
  const candidates = sessions.filter(
    (entry) =>
      sameId(entry.userId, local.userId) &&
      Boolean(entry.deviceId) &&
      !sameId(entry.deviceId, local.deviceId) &&
      isAudio(entry.nowPlayingItem)
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const ta = Date.parse(a.lastPlaybackCheckIn || a.lastActivityDate || '') || 0;
    const tb = Date.parse(b.lastPlaybackCheckIn || b.lastActivityDate || '') || 0;
    return tb - ta;
  });
  return candidates[0] ?? null;
}

function queueIds(remote: SessionInfo): string[] {
  const fromQueue = (remote.nowPlayingQueue ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => Boolean(id));
  if (fromQueue.length) return fromQueue;
  const current = remote.nowPlayingItem?.id;
  return current ? [current] : [];
}

function startIndexOf(remote: SessionInfo, ids: string[]): number {
  const playlistItemId = remote.playlistItemId;
  if (playlistItemId) {
    const fromPlaylist = (remote.nowPlayingQueue ?? []).findIndex(
      (entry) => entry.playlistItemId === playlistItemId
    );
    if (fromPlaylist >= 0) return fromPlaylist;
  }
  const currentId = remote.nowPlayingItem?.id;
  if (currentId) {
    const fromItem = ids.findIndex((id) => sameId(id, currentId));
    if (fromItem >= 0) return fromItem;
  }
  return 0;
}

async function loadTracks(session: Session, ids: string[]): Promise<BaseItem[]> {
  if (!ids.length) return [];
  const api = createApi(session);
  const byId = new Map<string, BaseItem>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const slice = ids.slice(i, i + ID_CHUNK);
    const result = await api.items({
      ids: slice,
      includeItemTypes: ['Audio'],
      mediaTypes: ['Audio'],
      limit: slice.length,
    });
    for (const item of result.items ?? []) {
      if (item.id) byId.set(item.id.replace(/-/g, '').toLowerCase(), item);
    }
  }
  return ids
    .map((id) => byId.get(id.replace(/-/g, '').toLowerCase()))
    .filter((item): item is BaseItem => Boolean(item) && isAudio(item));
}

function windowAround(ids: string[], current: number, cap: number): { ids: string[]; index: number } {
  if (ids.length <= cap) return { ids, index: current };
  const before = Math.min(current, Math.floor(cap / 4));
  const from = Math.max(0, current - before);
  const sliced = ids.slice(from, from + cap);
  return { ids: sliced, index: current - from };
}

/**
 * If this device has no local queue, copy another same-user audio session
 * (GET /Sessions) and stop the remote player. Jellyfin has no transfer API.
 */
export async function adoptRemoteIfIdle(session: Session): Promise<boolean> {
  const snap = playback.snapshot();
  if (snap.current || snap.queue.length || snap.preparing) return false;

  let remote: SessionInfo | null = null;
  try {
    const sessions = await createApi(session).sessions({ activeWithinSeconds: ACTIVE_WITHIN_SECONDS });
    remote = pickHandoffSession(sessions, { userId: session.userId, deviceId: session.deviceId });
  } catch {
    return false;
  }
  if (!remote) return false;

  const allIds = queueIds(remote);
  if (!allIds.length) return false;
  const current = startIndexOf(remote, allIds);
  const cap = resolvePlayAllLimit(useSettings.getState().playAllLimit);
  const window = windowAround(allIds, current, cap);

  let tracks: BaseItem[] = [];
  try {
    tracks = await loadTracks(session, window.ids);
  } catch {
    return false;
  }
  const playing = remote.nowPlayingItem;
  if (playing && isAudio(playing) && !tracks.some((item) => item.id === playing.id)) {
    tracks = [playing, ...tracks];
  }
  if (!tracks.length) return false;
  if (playback.snapshot().current || playback.snapshot().queue.length) return false;

  const currentId = remote.nowPlayingItem?.id ?? window.ids[window.index];
  const found = tracks.findIndex((item) => sameId(item.id, currentId));
  const startIndex = found >= 0 ? found : 0;
  const duration = ticksToSeconds(tracks[startIndex]?.runTimeTicks);
  let position = ticksToSeconds(remote.playState?.positionTicks);
  if (duration > 0 && position > duration - 2) position = 0;

  const remotePlaying = remote.playState?.isPaused === false;
  await playback.playItems(tracks, startIndex, {
    shuffle: remote.playState?.playbackOrder === 'Shuffle',
    keepOrder: true,
    startPosition: position,
    paused: !remotePlaying,
    repeat: toRepeat(remote.playState?.repeatMode),
  });

  if (remote.id && remotePlaying) {
    try {
      await createApi(session).sendPlaystateCommand(remote.id, 'Stop');
    } catch {
      // Remote may not accept control; local queue is already ours.
    }
  }

  const from = remote.deviceName?.trim() || remote.client?.trim() || 'another device';
  useToast.getState().show(`Continuing from ${from}`);
  return true;
}
