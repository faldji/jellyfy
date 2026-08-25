# Playback

Singleton engine and how UI starts music. Read when changing play, seek, queue, lock screen, radio, downloads, or session reporting.

## Owner

`src/playback/engine.ts` exports `playback` (`PlaybackEngine`). One `expo-audio` `AudioPlayer` for the process.

`src/store/player.ts` is a Zustand **mirror**. Screens call `usePlayer` (`playItems`, `togglePlay`, …). They do not write snapshot fields. They do not import `playback`. `SpectrumBars` is the exception (`subscribeSamples`).

`PlaybackHost` attaches / detaches on session, hydrates persist, runs `adoptRemoteIfIdle`, sets `musicViewId`.

## Start paths

| Method | Meaning |
|--------|---------|
| `playItems(items, startIndex, options?)` | Replace the queue with Audio items already in memory. |
| `playCollection(items, options?)` | Cap with `resolvePlayAllLimit`. Empty + mix/radio `contextId` + `seed` → `playMix`. Else empty + `seed` → `playItem`. |
| `playItem(item)` | One Audio, or expand album / playlist / artist via `tracksForItem`. Collection types are never treated as a single stream. **Never** Instant Mix. A new play stops the previous stream first. |
| `playMix(item)` | Radio / "This Is". SR radio when enabled, else Instant Mix. Default `contextId` `mix:{id}`, `continueWithSr: true`. |
| `playItemInContext` | Jump to an item inside a list. |
| `playNext` / `enqueue` | Insert after current / append. |

`PlayItemsOptions`: `shuffle`, `contextId`, `seed`, `startPosition`, `paused`, `keepOrder`, `repeat`, `continueWithSr`.

`contextId` conventions: `'likes' | 'downloads' | 'library' | 'search' | radio:{id} | mix:{id} | collection item id`.

Mix contexts (`radio:` / `mix:` prefix) default `continueWithSr` on. Home recommended should pass `continueWithSr: true` and a `contextId` if the now-playing label should stick.

Collection chrome uses `useCollectionPlayback(contextId, items, seed?)`. Cover tiles use `CoverActions`. `isItemActive` lives in `src/lib/media.ts` (artists match `contextId` only; albums also match `current.albumId`).

## Queue model

Internal: `source` (canonical list) + `order` (permutation) + `index` into `order`.

Snapshot `queue` is `order.map(i => source[i])`. Shuffle rebuilds `order` around the current source index. Repeat is `off | all | one`. `player.loop` stays false; repeat-one is seek-to-0 in the engine.

On-screen `playItems(list, index)` uses the **loaded** list (album hook limit 500, infinite likes pages, …). The play-all cap applies to `playCollection`, `tracksForItem`, `tracksForMix`, and handoff - not every row tap.

## Cache

`playItem` / `tracksForItem` read React Query first (`album-tracks`, `artist-tracks`, `playlist-items`). Opening a collection and pressing play should not fetch tracks twice.

Progress POSTs omit `nowPlayingQueue`. Start and stop still send the queue. SR does not get periodic PLAY_PROGRESS.

## Load / seek

1. New `playSessionId`.
2. Local download URI if `useDownloads.isDownloaded`.
3. Else `streamUrl` (see `docs/agents/api.md`).
4. Native original or download: seek with `seekTo`. Transcode mid-track: `startTimeTicks` + `startOffset`.
5. Web: MSE pump (`web-source.ts`) so pause still fills the buffer; fallback `player.replace`.
6. Recents `touch`. Lock screen metadata.

Seek: native `seekTo` when the player duration matches the item (or the playhead is inside the HTML buffered range); otherwise reopen `loadCurrent`.

## End of track

`src/playback/advance.ts` owns completion + next-index. The engine does **not** treat a stalled playhead as the end of a track.

Native `playbackStatusUpdate` with `didJustFinish` (or `playbackState === 'ended'`) is the completion signal. expo-audio 57 only emits periodic ticks while `playing` is true, so a JS position timer cannot see the end after ExoPlayer has already stopped â€” that path fails on an Android lock screen.

A `CompletionGate` (`loadGen` + item id) makes advancement idempotent: duplicate `didJustFinish`, a stale complete from the previous source, and manual next racing auto-complete cannot skip a track. `resetPlayhead` is only for `replace()` keeping the old `currentTime` at the start of a track; it must not veto a native complete.

`player.loop` stays false. Repeat-one is seek-to-0. Lock-screen/headset next uses `userNext()` (skips even on repeat-one). expo-audio 57.0.4 `AudioPlayer` lock-screen buttons are play/pause (optional Â±10s seek); they are not a native playlist skip.

## Reporting

Serialized on `reportChain`.

| When | Jellyfin | SR (if on) |
|------|----------|------------|
| First playing status | `reportPlaying` | `PLAY_START` |
| ~10s while playing | `reportProgress` | `PLAY_PROGRESS` |
| Pause / resume / seek / shuffle | `reportProgress` | `PAUSE` / `RESUME` |
| Leave track | `reportStopped` | `PLAY_COMPLETE` or `SKIP` (`leaveEventType`) |
| Repeat-one restart | progress | `REPLAY` |

Queue tail + `continueWithSr`: `fetchSrNext` + hydrate, append unseen ids.

## Platform

| Concern | Native | Web |
|---------|--------|-----|
| Stream | original = static stream + `Authorization` | always universal MP3, token in query |
| Downloads | yes | throw / hide in the sheet |
| Lock screen | `setActiveForLockScreen` | `media-session.ts` next/prev only |
| Extra `<audio>` | n/a | `silenceHtmlAudio` |

## Handoff

`adoptRemoteIfIdle`: another device, same user, audio now playing, last check-in ≤ 120s. No-op if local persist already has a queue. Then `playItems(..., { keepOrder, paused, startPosition })` and `Stop` the remote if it was playing.

## Don't

- Construct a second `AudioPlayer` or call `createAudioPlayer` outside the engine.
- Start Instant Mix from `playItem` (album/artist/playlist covers).
- Import `playback` from a screen to call `playItems`.
- Swallow SR failures by breaking local play. SR is best-effort.
