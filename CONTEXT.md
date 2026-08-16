# Jellyfy

A music client for one self-hosted Jellyfin library. Android and iOS are first-class. Web can browse and log in; background audio and lock-screen controls need a native development build.

Jellyfin is the library of record. This repo is the player. Smart Recommendations (SR) is an optional sidecar: when it is off or down, Jellyfin behavior is unchanged.

## Bounded context

| In | Out |
|----|-----|
| Sign-in, browse, search, likes, playlists | A second library server |
| Queue, shuffle, repeat, radio / Instant Mix | Store signing, EAS submit |
| Stream + offline download (native) | Hosting the SR model / training stack |
| Report play state to Jellyfin | Video, TV, photos |

## Glossary

Use these words. Do not invent synonyms in issues, ADRs, or new types.

| Term | Meaning |
|------|---------|
| **Item** | Canonical entity. TypeScript type is `BaseItem`. There is no `Track` or `Song` type. |
| **Audio** | Playable item. Test with `isAudio()` from `src/lib/media.ts`. Albums, artists, and playlists are not Audio even when Jellyfin sets `mediaType: Audio`. |
| **Track / song** | UI copy for an Audio item ("Liked Songs", `TrackRow`). Same object as Audio. |
| **Album** | `type === 'MusicAlbum'`. |
| **Artist** | `type === 'MusicArtist'`. Favorite on an artist is follow/unfollow. |
| **Playlist** | `type === 'Playlist'`. Row id for remove is `playlistItemId`, not `id`. |
| **Genre** | `MusicGenre` or `Genre`. Route `/genre/[name]` param `name` is the Jellyfin item id. |
| **Liked** | Jellyfin `userData.isFavorite` / `filters: ['IsFavorite']`. |
| **Collection** | Anything started as a list (album, playlist, artist, likes, radio). Identified by `contextId`. |
| **Queue** | Engine `source` + `order`. Snapshot field `queue` is the playable permutation. |
| **Mix / radio** | Jellyfin Instant Mix, or SR radio when SR is on. Context ids `radio:{id}` and `mix:{id}`. |
| **Similar / fans also like / more like** | Jellyfin `/Similar` plus local ranking. Not SR. |
| **Recommended / SR** | Optional plugin. Returns `trackId`s; hydrate through Jellyfin `/Items?ids=`. |
| **Session (auth)** | `src/api/client.ts` `Session`: server URL, token, user, device. |
| **Session (Jellyfin)** | `SessionInfo` from `GET /Sessions`. Used for handoff. |
| **playSessionId** | Per-track playback id sent to `/Sessions/Playing*`. |
| **SR session** | Process-lifetime `srClientSessionId()`. Not persisted. |
| **Music parent** | `UserViews` item with `collectionType === 'music'`. Stored as `musicViewId` (RAM only). |
| **Quality** | `StreamQuality`: `low` / `normal` / `high` / `original`. |
| **Play all** | Cap on how many Audio items a collection start will queue (`playAllLimit`, hard 2000). |

## Ubiquitous language to avoid

- Do not introduce `Song`, `Track`, or `Media` as TypeScript types. Use `BaseItem` + `isAudio`.
- Do not call the Zustand player store "the engine". The engine is `playback` in `src/playback/engine.ts`. `usePlayer` is a mirror.
- Do not call Instant Mix "SR" or SR "Instant Mix".
- Do not call `Session` (auth) a Jellyfin `SessionInfo`.
