# API

Jellyfin data layer plus the optional SR sidecar. Read when adding or changing fetches, mutations, normalize, stream/image URLs, or query keys.

## Layers

| Layer | Path | Job |
|-------|------|-----|
| HTTP | `src/api/client.ts` | `jellyfinFetch`, `camelize`, MediaBrowser auth, 401 callback |
| Session client | `src/api/jellyfin.ts` `createApi(session)` | Paths, query defaults, `imageUrl` / `streamUrl` / `downloadUrl` |
| Types | `src/api/types.ts` | Jellyfin 10.12 / API 12.0 camelCase shapes. Canonical item: `BaseItem` |
| Query keys | `src/api/query-keys.ts` | Factories + `invalidateLibraryQueries` |
| Hooks | `src/api/hooks.ts` | React Query. UI uses these. |
| SR | `src/api/sr.ts` | Optional plugin. Hydrate ids through Jellyfin. |
| Shared fetches | `src/api/library.ts` | Album / artist / playlist tracks, mixed search, library artist list. Used by hooks **and** the engine. |
| Query client | `src/api/query.ts` | `staleTime: 2m`, `gcTime: 30m`, `retry: 1`, no focus/reconnect refetch |

## Auth

```
Authorization: MediaBrowser Client="Jellyfy", Device="<sanitized>", DeviceId="…", Version="1.0.0", Token="…"
```

Anonymous login / public info omit `Token`. Device names go through `sanitizeDeviceName`.

`Accept: application/json; profile="CamelCase"`. Responses still pass `camelize()` (first letter only). Keys under `imageTags` / `imageBlurHashes` are not remapped.

Query params stay camelCase (`userId`, `includeItemTypes`). Some **bodies** are PascalCase because Jellyfin requires it: auth `{ Username, Pw }`, playlists `{ Name, Ids, UserId, MediaType }`. Playback reports stay camelCase.

Do not log tokens or the full Authorization header.

## Add a query

1. Add or extend a hook in `src/api/hooks.ts`.
2. Call `createApi(session)` via `useApi()` - no one-off `fetch` in screens.
3. Keys from `queryKeys` in `src/api/query-keys.ts`. Keep `userId` after the resource prefix.
4. Mutations that change library data call `invalidateLibraryQueries(client)`. Favorites use `invalidateAfterFavorite`, which matches only `FAVORITE_LIST_LABELS` or an `ItemQuery.filters` that includes `IsFavorite`. Names like `fans-also-like` do not match.
5. In-flight GETs are keyed by `userId + server + path + query` (`getShareKey`). One waiter leaving does not abort the others. When the last waiter leaves, the wire request stays up for 50ms so play can join, then it is cancelled.
6. Collection play must go through `fetchAlbumTracks` / `fetchArtistTracks` / `fetchPlaylistTracks` (or the matching hook) so the engine can reuse the React Query cache. Library Artists uses `fetchLibraryArtists` (do not send `includeItemTypes=MusicArtist` to `/Artists/AlbumArtists`).
7. Pass React Query's `signal` into `createApi` reads. Search and screen changes cancel the previous request.

```ts
import { queryKeys, invalidateLibraryQueries } from '@/api/query-keys';
```

## Stream and images

| Helper | Use |
|--------|-----|
| `streamUrl` | Playback. Web and non-original: `/Audio/{id}/universal` MP3. Native `original`: `/Audio/{id}/stream?static=true`. Token on the query string for `<audio>`. |
| `streamHeaders` | Native (not web, not local download). |
| `imageUrl` | Cover art. `CoverArt` / artist hero pass `{ tokenInQuery: false }` + `Authorization`. |
| `downloadUrl` | `GET /Items/{id}/Download?api_key=`. Native only. |

Do not invent a third stream path. `/Audio/{id}/stream.mp3` ignores `startTimeTicks` and breaks seek. See comments on `streamUrl`.

## Smart Recommendations

Off unless `srEnabled` and `normalizeServerUrl(srBaseUrl)` (`selectSrEnabled` / `isSrEnabled`). Separate base URL from Jellyfin. Same MediaBrowser header.

| Function | Path |
|----------|------|
| `fetchSrHome` | `GET /api/v1/recommendations` |
| `fetchSrRadio` | `GET /api/v1/radio/{artists\|albums\|tracks}/{id}` |
| `fetchSrNext` | `POST /api/v1/recommendations/next` |
| `postSrEvent` / `postSrEventSafe` | `POST /api/v1/events` |

`hydrateSrTracks` loads Jellyfin items by id and matches with `normId`. Empty or failed SR → Instant Mix / existing Jellyfin path. Events must never throw into the engine (`postSrEventSafe`).

Radio play (`playMix` / `tracksForMix`) uses the same SR-then-InstantMix rule as `useRadioMix`.

This repo does **not** host the SR model. Do not add training, embeddings, or Postgres from old dump specs.

## Upstream OpenAPI (last resort)

Do not fetch this for ordinary work. Prefer `createApi`, `src/api/types.ts`, and existing call sites.

Fetch **only** when an endpoint or field is missing or contradictory in-repo:

https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json

Pull the one path you need. Encode the result in `types.ts` / `createApi`. Features must not depend on the remote spec.

## Don't

- Bypass `createApi` / hooks from a screen for JSON.
- Put PascalCase Jellyfin payloads in components.
- Hand-roll query key arrays when `query-keys.ts` has a factory.
- Treat SR as required. Jellyfin must work with SR off.
- Compare item ids with `===` across SR / other-user / handoff paths. Use `sameId` / `normId` from `src/lib/ids.ts`.
