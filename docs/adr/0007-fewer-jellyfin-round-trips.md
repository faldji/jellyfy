# ADR-0007: Fewer Jellyfin round trips without a second protocol

- Status: accepted
- Date: 2026-08-16

## Context

Browse and play were chatty. Home fired 8-11 JSON requests (plus a waterfall of `/Items?ids=`). Opening an album always hit parent **and** albumIds. Play then fetched the same tracks again. Artist pages ran a second song query plus `/Users/Public` and up to ten other users' likes. Search-all issued five parallel `/Items` searches. Favorites invalidated every active query and refetched them. Progress POSTed the full queue every 10s and SR received a matching PLAY_PROGRESS.

Jellyfin 10.12 has a WebSocket at `/socket` for session and library events. This client does not poll the library. The only periodic HTTP is playback progress, which the server expects.

## Decision

- Keep REST + React Query as the data layer. Do not add a WebSocket or a second repository API.
- Share collection fetches (`fetchAlbumTracks` / `fetchArtistTracks` / `fetchPlaylistTracks`) between screens and the engine via query keys.
- Deduplicate in-flight GETs in `jellyfinFetch`.
- Pass `AbortSignal` from React Query so obsolete search/navigation requests die.
- Derive home album/artist rails from liked tracks already in memory.
- Collapse search-all to one mixed `/Items` query.
- Slim "fans also like" to similar + own likes + recents (no other-user fan-out).
- After a favorite, refetch only favorite lists (`invalidateAfterFavorite`). Collection track caches stay warm. Recents keep `userData.isFavorite`.
- Send `nowPlayingQueue` on play start/stop only. Drop periodic SR PLAY_PROGRESS.
- Snap artwork sizes to buckets and use expo-image `memory-disk` cache.

## Consequences

- Opening an album and pressing play should not double-fetch tracks.
- Home and search JSON counts drop without losing rails or typed search.
- Remote-control sync still uses `/Sessions` once on idle attach, not a socket.
- If we later need live UserDataChanged from another client, reopen this ADR for `/socket`.
