import { Platform } from 'react-native';

import { authorizationHeader, jellyfinFetch, toQuery, type Session } from '@/api/client';
import type {
  BaseItem,
  ItemQuery,
  LyricDto,
  PlaybackProgressInfo,
  PlaybackStartInfo,
  PlaybackStopInfo,
  PlaystateCommand,
  PlaylistCreationResult,
  QueryResult,
  SessionInfo,
  StreamQuality,
  UserDto,
} from '@/api/types';
import { MUSIC_ITEM_FIELDS as DEFAULT_FIELDS, STREAM_BITRATES as BITRATES } from '@/api/types';
import { imagePixelSize } from '@/lib/image-size';

export type { Session };

const defaultQuery = {
  fields: DEFAULT_FIELDS,
  enableImageTypes: ['Primary', 'Backdrop', 'Thumb'] as const,
  enableUserData: true,
  enableImages: true,
};

export type FetchExtra = { soft?: boolean; signal?: AbortSignal };

export function createApi(session: Session) {
  const get = <T>(path: string, query?: Record<string, unknown>, extra?: FetchExtra) =>
    jellyfinFetch<T>(session.serverUrl, path, {
      auth: session,
      query,
      soft: extra?.soft,
      signal: extra?.signal,
    });

  const send = <T>(path: string, method: string, body?: unknown, query?: Record<string, unknown>, extra?: FetchExtra) =>
    jellyfinFetch<T>(session.serverUrl, path, {
      auth: session,
      method,
      body,
      query,
      soft: extra?.soft,
      signal: extra?.signal,
    });

  return {
    session,

    userViews() {
      return get<QueryResult>('/UserViews', { userId: session.userId, includeExternalContent: false });
    },

    items(query: ItemQuery = {}, opts?: FetchExtra) {
      return get<QueryResult>(
        '/Items',
        {
          userId: session.userId,
          ...defaultQuery,
          ...query,
        },
        opts
      );
    },

    item(itemId: string, opts?: FetchExtra) {
      return get<BaseItem>(
        `/Items/${itemId}`,
        {
          userId: session.userId,
          ...defaultQuery,
        },
        opts
      );
    },

    latest(query: ItemQuery = {}, opts?: FetchExtra) {
      return get<BaseItem[]>(
        '/Items/Latest',
        {
          userId: session.userId,
          ...defaultQuery,
          limit: 20,
          ...query,
        },
        opts
      );
    },

    resume(query: ItemQuery = {}) {
      return get<QueryResult>('/UserItems/Resume', {
        userId: session.userId,
        ...defaultQuery,
        ...query,
      });
    },

    artists(query: ItemQuery = {}, opts?: FetchExtra) {
      return get<QueryResult>(
        '/Artists',
        {
          userId: session.userId,
          ...defaultQuery,
          ...query,
        },
        opts
      );
    },

    albumArtists(query: ItemQuery = {}, opts?: FetchExtra) {
      return get<QueryResult>(
        '/Artists/AlbumArtists',
        {
          userId: session.userId,
          ...defaultQuery,
          ...query,
        },
        opts
      );
    },

    instantMix(itemId: string, limit = 50, opts?: FetchExtra) {
      return get<QueryResult>(
        `/Items/${itemId}/InstantMix`,
        {
          userId: session.userId,
          limit,
          ...defaultQuery,
        },
        opts
      );
    },

    similar(itemId: string, limit = 12, opts?: FetchExtra) {
      return get<QueryResult>(
        `/Items/${itemId}/Similar`,
        {
          userId: session.userId,
          limit,
          ...defaultQuery,
        },
        opts
      );
    },

    similarArtists(itemId: string, limit = 24, opts?: FetchExtra) {
      return get<QueryResult>(
        `/Artists/${itemId}/Similar`,
        {
          userId: session.userId,
          limit,
          ...defaultQuery,
        },
        opts
      );
    },

    usersPublic() {
      return get<UserDto[]>('/Users/Public', undefined, { soft: true });
    },

    lyrics(itemId: string) {
      return get<LyricDto>(`/Audio/${itemId}/Lyrics`);
    },

    playlistItems(
      playlistId: string,
      query: { limit?: number; startIndex?: number } = {},
      opts?: FetchExtra
    ) {
      return get<QueryResult>(
        `/Playlists/${playlistId}/Items`,
        {
          userId: session.userId,
          ...defaultQuery,
          ...query,
        },
        opts
      );
    },

    createPlaylist(name: string, ids: string[] = []) {
      return send<PlaylistCreationResult>('/Playlists', 'POST', {
        Name: name,
        Ids: ids,
        UserId: session.userId,
        MediaType: 'Audio',
      });
    },

    renamePlaylist(playlistId: string, name: string, ids?: string[]) {
      return send<void>(`/Playlists/${playlistId}`, 'POST', {
        Name: name,
        ...(ids ? { Ids: ids } : {}),
      });
    },

    deleteItem(itemId: string) {
      return send<void>(`/Items/${itemId}`, 'DELETE');
    },

    addToPlaylist(playlistId: string, ids: string[]) {
      return send<void>(`/Playlists/${playlistId}/Items`, 'POST', undefined, {
        ids,
        userId: session.userId,
      });
    },

    removeFromPlaylist(playlistId: string, entryIds: string[]) {
      return send<void>(`/Playlists/${playlistId}/Items`, 'DELETE', undefined, {
        entryIds,
      });
    },

    setFavorite(itemId: string, favorite: boolean) {
      return send<unknown>(`/UserFavoriteItems/${itemId}`, favorite ? 'POST' : 'DELETE', undefined, {
        userId: session.userId,
      });
    },

    sessions(query?: { deviceId?: string; activeWithinSeconds?: number; controllableByUserId?: string }) {
      return get<SessionInfo[]>('/Sessions', query);
    },

    sendPlaystateCommand(
      sessionId: string,
      command: PlaystateCommand,
      query?: { seekPositionTicks?: number; controllingUserId?: string }
    ) {
      return send<void>(`/Sessions/${sessionId}/Playing/${command}`, 'POST', undefined, query);
    },

    reportPlaying(info: PlaybackStartInfo) {
      return send<void>('/Sessions/Playing', 'POST', info);
    },

    reportProgress(info: PlaybackProgressInfo) {
      return send<void>('/Sessions/Playing/Progress', 'POST', info);
    },

    reportStopped(info: PlaybackStopInfo) {
      return send<void>('/Sessions/Playing/Stopped', 'POST', info);
    },

    logout() {
      return send<void>('/Sessions/Logout', 'POST');
    },

    imageUrl(item: Pick<BaseItem, 'id' | 'imageTags' | 'albumId' | 'albumPrimaryImageTag'>, size = 400) {
      return imageUrl(session, item, size);
    },

    streamUrl(itemId: string, quality: StreamQuality, options?: StreamUrlOptions) {
      return streamUrl(session, itemId, quality, options);
    },

    downloadUrl(itemId: string) {
      return `${session.serverUrl}/Items/${itemId}/Download?${toQuery({ api_key: session.accessToken })}`;
    },
  };
}

export type JellyfinApi = ReturnType<typeof createApi>;

export { imagePixelSize } from '@/lib/image-size';

export function imageUrl(
  session: Session,
  item: Pick<BaseItem, 'id' | 'imageTags' | 'albumId' | 'albumPrimaryImageTag' | 'parentId'>,
  size = 400,
  options: { tokenInQuery?: boolean } = {}
): string | null {
  const token = options.tokenInQuery === false ? undefined : session.accessToken;
  const tags = item.imageTags as Partial<Record<string, string>> | undefined;
  const tag = tags?.Primary ?? tags?.primary;
  size = imagePixelSize(size);
  if (tag) {
    return `${session.serverUrl}/Items/${item.id}/Images/Primary?${toQuery({
      fillHeight: size,
      fillWidth: size,
      quality: 85,
      tag,
      api_key: token,
    })}`;
  }
  if (item.albumId && item.albumPrimaryImageTag) {
    return `${session.serverUrl}/Items/${item.albumId}/Images/Primary?${toQuery({
      fillHeight: size,
      fillWidth: size,
      quality: 85,
      tag: item.albumPrimaryImageTag,
      api_key: token,
    })}`;
  }
  return `${session.serverUrl}/Items/${item.id}/Images/Primary?${toQuery({
    fillHeight: size,
    fillWidth: size,
    quality: 85,
    api_key: token,
  })}`;
}

export type StreamUrlOptions = {
  startTimeTicks?: number;
  playSessionId?: string;
};

export function streamUrl(
  session: Session,
  itemId: string,
  quality: StreamQuality,
  options: StreamUrlOptions = {}
): string {
  const bitrate = quality === 'original' ? 320_000 : BITRATES[quality];
  const startTimeTicks = options.startTimeTicks && options.startTimeTicks > 0 ? Math.round(options.startTimeTicks) : undefined;

  // /Audio/{id}/stream.mp3 transcodes FLAC but ignores startTimeTicks and has no
  // Content-Length, so HTML audio cannot seek. /universal with an explicit MP3
  // transcode profile:
  //   - direct-streams original MP3 (Content-Length + Range → native seek)
  //   - transcodes FLAC to progressive MP3 and honours startTimeTicks
  // Token is on the query string for <audio> on web.
  const mp3 = `${session.serverUrl}/Audio/${itemId}/universal?${toQuery({
    container: 'mp3',
    audioCodec: 'mp3',
    TranscodingContainer: 'mp3',
    TranscodingProtocol: 'http',
    audioBitRate: bitrate,
    MaxStreamingBitrate: bitrate,
    userId: session.userId,
    deviceId: session.deviceId,
    api_key: session.accessToken,
    playSessionId: options.playSessionId,
    startTimeTicks,
  })}`;

  if (Platform.OS === 'web' || quality !== 'original') {
    return mp3;
  }

  return `${session.serverUrl}/Audio/${itemId}/stream?${toQuery({
    static: true,
    userId: session.userId,
    deviceId: session.deviceId,
    api_key: session.accessToken,
    playSessionId: options.playSessionId,
    startTimeTicks,
  })}`;
}

export function streamHeaders(session: Session): Record<string, string> {
  return {
    Authorization: authorizationHeader(session),
  };
}

export { DEFAULT_FIELDS as MUSIC_ITEM_FIELDS, BITRATES as STREAM_BITRATES };
