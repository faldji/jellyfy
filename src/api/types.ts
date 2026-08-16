/**
 * Jellyfin 10.12 / API 12.0 music-client types.
 * Field names are camelCase (OpenAPI CamelCase profile + client normalizer).
 * Source: https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json
 */

export type BaseItemKind =
  | 'AggregateFolder'
  | 'Audio'
  | 'AudioBook'
  | 'BasePluginFolder'
  | 'Book'
  | 'BoxSet'
  | 'Channel'
  | 'ChannelFolderItem'
  | 'CollectionFolder'
  | 'Episode'
  | 'Folder'
  | 'Genre'
  | 'ManualPlaylistsFolder'
  | 'Movie'
  | 'LiveTvChannel'
  | 'LiveTvProgram'
  | 'MusicAlbum'
  | 'MusicArtist'
  | 'MusicGenre'
  | 'MusicVideo'
  | 'Person'
  | 'Photo'
  | 'PhotoAlbum'
  | 'Playlist'
  | 'PlaylistsFolder'
  | 'Program'
  | 'Recording'
  | 'Season'
  | 'Series'
  | 'Studio'
  | 'Trailer'
  | 'TvChannel'
  | 'TvProgram'
  | 'UserRootFolder'
  | 'UserView'
  | 'Video'
  | 'Year';

export type MediaType = 'Unknown' | 'Video' | 'Audio' | 'Photo' | 'Book';

export type CollectionType =
  | 'unknown'
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'musicvideos'
  | 'trailers'
  | 'homevideos'
  | 'boxsets'
  | 'books'
  | 'photos'
  | 'livetv'
  | 'playlists'
  | 'folders';

export type ImageType =
  | 'Primary'
  | 'Art'
  | 'Backdrop'
  | 'Banner'
  | 'Logo'
  | 'Thumb'
  | 'Disc'
  | 'Box'
  | 'Screenshot'
  | 'Menu'
  | 'Chapter'
  | 'BoxRear'
  | 'Profile';

export type ItemSortBy =
  | 'Default'
  | 'Album'
  | 'AlbumArtist'
  | 'Artist'
  | 'DateCreated'
  | 'DatePlayed'
  | 'PremiereDate'
  | 'SortName'
  | 'Name'
  | 'Random'
  | 'Runtime'
  | 'PlayCount'
  | 'ProductionYear'
  | 'ParentIndexNumber'
  | 'IndexNumber'
  | 'IsFavoriteOrLiked'
  | 'DateLastContentAdded';

export type ItemFilter =
  | 'IsFolder'
  | 'IsNotFolder'
  | 'IsUnplayed'
  | 'IsPlayed'
  | 'IsFavorite'
  | 'IsResumable'
  | 'Likes'
  | 'Dislikes'
  | 'IsFavoriteOrLikes';

export type ItemFields =
  | 'CanDelete'
  | 'CanDownload'
  | 'ChildCount'
  | 'CumulativeRunTimeTicks'
  | 'DateCreated'
  | 'Genres'
  | 'MediaSources'
  | 'Overview'
  | 'ParentId'
  | 'PrimaryImageAspectRatio'
  | 'RecursiveItemCount'
  | 'SortName'
  | 'MediaStreams'
  | 'DateLastSaved';

export type SortOrder = 'Ascending' | 'Descending';
export type PlayMethod = 'Transcode' | 'DirectStream' | 'DirectPlay';
export type RepeatMode = 'RepeatNone' | 'RepeatAll' | 'RepeatOne';
export type PlaybackOrder = 'Default' | 'Shuffle';

export type NameGuidPair = {
  name?: string;
  id?: string;
};

export type UserItemData = {
  rating?: number | null;
  playedPercentage?: number | null;
  unplayedItemCount?: number;
  playbackPositionTicks?: number;
  playCount?: number;
  isFavorite?: boolean;
  likes?: boolean | null;
  lastPlayedDate?: string | null;
  played?: boolean;
  key: string;
  itemId?: string;
};

export type BaseItem = {
  name?: string;
  originalTitle?: string;
  serverId?: string;
  id: string;
  etag?: string;
  playlistItemId?: string;
  dateCreated?: string;
  canDelete?: boolean;
  canDownload?: boolean;
  hasLyrics?: boolean;
  container?: string;
  sortName?: string;
  premiereDate?: string;
  overview?: string;
  genres?: string[];
  communityRating?: number;
  cumulativeRunTimeTicks?: number;
  runTimeTicks?: number;
  productionYear?: number;
  indexNumber?: number;
  parentIndexNumber?: number;
  isFolder?: boolean;
  parentId?: string;
  type?: BaseItemKind;
  genreItems?: NameGuidPair[];
  userData?: UserItemData;
  recursiveItemCount?: number;
  childCount?: number;
  artists?: string[];
  artistItems?: NameGuidPair[];
  album?: string;
  collectionType?: CollectionType;
  albumId?: string;
  albumPrimaryImageTag?: string;
  albumArtist?: string;
  albumArtists?: NameGuidPair[];
  imageTags?: Partial<Record<ImageType, string>>;
  backdropImageTags?: string[];
  imageBlurHashes?: Partial<Record<ImageType, Record<string, string>>>;
  mediaType?: MediaType;
  songCount?: number;
  albumCount?: number;
  artistCount?: number;
  normalizationGain?: number;
  albumNormalizationGain?: number;
};

export type QueryResult<T = BaseItem> = {
  items?: T[];
  totalRecordCount?: number;
  startIndex?: number;
};

export type PublicSystemInfo = {
  localAddress?: string;
  serverName?: string;
  version?: string;
  productName?: string;
  operatingSystem?: string;
  id?: string;
  startupWizardCompleted?: boolean;
};

export type UserDto = {
  name?: string;
  serverId?: string;
  serverName?: string;
  id: string;
  primaryImageTag?: string;
  hasPassword?: boolean;
};

export type QueueItem = {
  id?: string;
  playlistItemId?: string;
};

export type PlayerStateInfo = {
  positionTicks?: number | null;
  canSeek?: boolean;
  isPaused?: boolean;
  isMuted?: boolean;
  volumeLevel?: number | null;
  playMethod?: PlayMethod | null;
  repeatMode?: RepeatMode;
  playbackOrder?: PlaybackOrder;
};

/** GET /Sessions item (OpenAPI SessionInfoDto). */
export type SessionInfo = {
  id?: string;
  userId?: string;
  userName?: string;
  client?: string;
  deviceName?: string;
  deviceId?: string;
  applicationVersion?: string;
  serverId?: string;
  playState?: PlayerStateInfo | null;
  nowPlayingItem?: BaseItem | null;
  lastActivityDate?: string;
  lastPlaybackCheckIn?: string;
  lastPausedDate?: string | null;
  isActive?: boolean;
  supportsMediaControl?: boolean;
  supportsRemoteControl?: boolean;
  nowPlayingQueue?: QueueItem[] | null;
  playlistItemId?: string | null;
};

export type PlaystateCommand =
  | 'Stop'
  | 'Pause'
  | 'Unpause'
  | 'NextTrack'
  | 'PreviousTrack'
  | 'Seek'
  | 'Rewind'
  | 'FastForward'
  | 'PlayPause';

export type AuthenticationResult = {
  user?: UserDto;
  sessionInfo?: SessionInfo;
  accessToken?: string;
  serverId?: string;
};

export type LyricLine = {
  text?: string;
  start?: number;
};

export type LyricMetadata = {
  artist?: string;
  album?: string;
  title?: string;
  isSynced?: boolean;
};

export type LyricDto = {
  metadata?: LyricMetadata;
  lyrics?: LyricLine[];
};

export type PlaybackStartInfo = {
  canSeek?: boolean;
  itemId?: string;
  sessionId?: string;
  isPaused?: boolean;
  isMuted?: boolean;
  positionTicks?: number;
  volumeLevel?: number;
  playMethod?: PlayMethod;
  playSessionId?: string;
  repeatMode?: RepeatMode;
  playbackOrder?: PlaybackOrder;
  nowPlayingQueue?: QueueItem[];
};

export type PlaybackProgressInfo = PlaybackStartInfo;

export type PlaybackStopInfo = {
  itemId?: string;
  sessionId?: string;
  positionTicks?: number;
  playSessionId?: string;
  failed?: boolean;
  nowPlayingQueue?: QueueItem[];
};

export type PlaylistCreationResult = {
  id?: string;
};

export const MUSIC_ITEM_FIELDS: ItemFields[] = [
  'CanDelete',
  'CanDownload',
  'ChildCount',
  'CumulativeRunTimeTicks',
  'DateCreated',
  'Genres',
  'Overview',
  'ParentId',
  'PrimaryImageAspectRatio',
  'RecursiveItemCount',
  'SortName',
];

export type ItemQuery = {
  userId?: string;
  startIndex?: number;
  limit?: number;
  recursive?: boolean;
  searchTerm?: string;
  sortOrder?: SortOrder | SortOrder[];
  parentId?: string;
  fields?: ItemFields[];
  excludeItemTypes?: BaseItemKind[];
  includeItemTypes?: BaseItemKind[];
  filters?: ItemFilter[];
  isFavorite?: boolean;
  mediaTypes?: MediaType[];
  sortBy?: ItemSortBy[];
  genres?: string[];
  enableUserData?: boolean;
  imageTypeLimit?: number;
  enableImageTypes?: ImageType[];
  artistIds?: string[];
  albumArtistIds?: string[];
  albumIds?: string[];
  ids?: string[];
  genreIds?: string[];
  enableTotalRecordCount?: boolean;
  enableImages?: boolean;
  nameStartsWith?: string;
};

export type StreamQuality = 'low' | 'normal' | 'high' | 'original';

export const STREAM_BITRATES: Record<Exclude<StreamQuality, 'original'>, number> = {
  low: 96_000,
  normal: 192_000,
  high: 320_000,
};
