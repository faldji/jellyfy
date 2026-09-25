export type MediaSessionHost = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  userNext: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  position: () => number;
};

export type MediaSessionDetails = {
  seekOffset?: number | null;
  seekTime?: number | null;
};

type ActionSession = {
  setActionHandler?: (
    action: string,
    handler: ((details?: MediaSessionDetails) => void) | null
  ) => void;
};

type MetadataSession = {
  metadata?: unknown;
  playbackState?: string;
  setPositionState?: (state?: {
    duration?: number;
    playbackRate?: number;
    position?: number;
  }) => void;
};

export type MediaSessionTimeline = {
  position: number;
  duration: number;
};

const DEFAULT_SEEK_SECONDS = 10;

/** Browser Media Session transport. Native lock-screen buttons stay in expo-audio. */
export function bindMediaSession(host: MediaSessionHost) {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  bindMediaSessionActions(session as ActionSession | undefined, host);
}

export function bindMediaSessionActions(
  session: ActionSession | null | undefined,
  host: MediaSessionHost
) {
  if (!session?.setActionHandler) return;
  const set = (action: string, handler: (details?: MediaSessionDetails) => void) => {
    try {
      session.setActionHandler?.(action, handler);
    } catch {
      // Browser may reject an unsupported action.
    }
  };

  set('play', () => {
    void host.play();
  });
  set('pause', () => {
    void host.pause();
  });
  set('nexttrack', () => {
    void host.userNext();
  });
  set('previoustrack', () => {
    void host.previous();
  });
  set('seekforward', (details) => {
    const offset = details?.seekOffset ?? DEFAULT_SEEK_SECONDS;
    void host.seek(host.position() + offset);
  });
  set('seekbackward', (details) => {
    const offset = details?.seekOffset ?? DEFAULT_SEEK_SECONDS;
    void host.seek(host.position() - offset);
  });
  set('seekto', (details) => {
    if (details?.seekTime == null || !Number.isFinite(details.seekTime)) return;
    void host.seek(details.seekTime);
  });
}

export function syncMediaSessionPlaybackState(playing: boolean, timeline?: MediaSessionTimeline) {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  applyMediaSessionPlaybackState(session, playing, timeline);
}

export function applyMediaSessionPlaybackState(
  session: MetadataSession | null | undefined,
  playing: boolean,
  timeline?: MediaSessionTimeline
) {
  if (!session) return;
  try {
    session.playbackState = playing ? 'playing' : 'paused';
    applyTimeline(session, playing, timeline);
  } catch {
    // Some browsers expose metadata only.
  }
}

export function publishMediaSessionMetadata(input: {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  playing: boolean;
  position?: number;
  duration?: number;
}) {
  const session = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  applyMediaSessionMetadata(session, input, typeof MediaMetadata === 'function' ? MediaMetadata : undefined);
}

export function applyMediaSessionMetadata(
  session: MetadataSession | null | undefined,
  input: {
    title: string;
    artist: string;
    album: string;
    artworkUrl?: string;
    playing: boolean;
    position?: number;
    duration?: number;
  },
  Metadata?: new (init: {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: { src: string }[];
  }) => unknown
) {
  if (!session) return;
  try {
    if (Metadata) {
      session.metadata = new Metadata({
        title: input.title,
        artist: input.artist,
        album: input.album,
        artwork: input.artworkUrl ? [{ src: input.artworkUrl }] : [],
      });
    }
    session.playbackState = input.playing ? 'playing' : 'paused';
    if (input.position != null && input.duration != null) {
      applyTimeline(session, input.playing, { position: input.position, duration: input.duration });
    }
  } catch {
    // Metadata is best-effort; playback does not depend on it.
  }
}

function applyTimeline(session: MetadataSession, playing: boolean, timeline?: MediaSessionTimeline) {
  if (!timeline || !session.setPositionState) return;
  const { duration, position } = timeline;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
  session.setPositionState({
    duration,
    playbackRate: playing ? 1 : 0,
    position: Math.min(Math.max(position, 0), duration),
  });
}
