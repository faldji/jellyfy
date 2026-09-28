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

Album, playlist, and artist track lists, genre albums, the library, and add-to-playlist load 40 items at a time (`COLLECTION_PAGE`). Likes pages at 50. Home rails keep their configured limits. A row plays the list already loaded. Play and shuffle on a collection header queue up to `playAllLimit` (hard 2000). Shuffle draws that cap from the loaded list, not from its prefix. If the list is still incomplete, the header asks the server for the cap instead of playing only the visible page. Pressing play on the collection that is already active resumes. Artist popular rows are the top of the first track page.

## Cache

`playItem` / `tracksForItem` read the paged React Query cache first (`pages`), then a previous play of the same cap (`play`). Opening a collection and pressing play should not fetch tracks twice when those pages already cover the cap or the collection has ended.

Periodic progress omits `nowPlayingQueue`. Start, stop, and a shuffle that changes the order send the queue. SR does not get periodic PLAY_PROGRESS.

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

Native `playbackStatusUpdate` with `didJustFinish` (or `playbackState === 'ended'`) is the completion signal. expo-audio 57 only emits periodic ticks while `playing` is true, so a JS position timer cannot see the end after ExoPlayer has already stopped. That path fails on an Android lock screen.

A `CompletionGate` (`loadGen` + item id) makes advancement idempotent: duplicate `didJustFinish`, a stale complete from the previous source, and manual next racing auto-complete cannot skip a track. Accept a completion only after this load has been heard playing, so a stale `ended` from `replace()` cannot skip again. `resetPlayhead` hides a `replace()` status that still carries the previous item's `currentTime`. Do not `seekTo(0)` on that reading. The seek rebuffers and restarts the new item. It must not veto a native complete.

`player.loop` stays false. Repeat-one is seek-to-0. Lock-screen and headset next call `userNext()` (skips even on repeat-one). Previous calls `previous()` (restart when the playhead is past 3 seconds, otherwise the previous item).

## Lock screen

Stock expo-audio 57.0.5 is play/pause and optional ±10s. `patches/expo-audio+57.0.5.patch` is applied on `postinstall` and adds next, previous, shuffle, repeat, and a timed seek bar. `package.json` `expo.autolinking.buildFromSource` includes `expo-audio`. Without that, Android links the precompiled package and ignores the patch. Rebuild with `npx expo run:android` or `npx expo run:ios` after pulling it. Expo Go cannot show the controls.

The patch emits `onRemoteNextTrack`, `onRemotePreviousTrack`, `onRemoteShuffle`, `onRemoteRepeat`, and `onRemoteSeek`. The engine owns the queue. On Android 13 and newer the shade and lock screen only draw standard player commands (`SEEK_TO_NEXT`, `SEEK_TO_PREVIOUS`, `SET_SHUFFLE_MODE`, `SET_REPEAT_MODE`, `SEEK_IN_CURRENT_MEDIA_ITEM`). Custom session commands are not drawn.

Jellyfin transcodes often leave the player duration unset, which grays out the system seek bar. Publish `displayDuration()` (`runTimeTicks`) and `positionOffsetMs` (`startOffset`) once per item. The in-app bar uses that same duration. A transcoded clock starts at 0; wall time is the offset plus the clock.

Notification icons are monochrome drawables. The system tints every transport button one color, so shuffle and repeat state is the shape, not `accent`. Do not colorize the notification.

`classifyRemoteSeek` ignores a system seek to 0, or back to the position just left, in the first seconds after open. Those seeks must not call `loadCurrent`. A real scrub seeks natively when the player duration matches the item. A transcode reopens that item once. Repeat one still replays in the engine. Lock-screen next still skips. Shuffle rebuilds `order` and posts `nowPlayingQueue` once. Repeat posts `repeatMode` on the next progress. SR has no shuffle or repeat event.

Web `media-session.ts` binds play, pause, seek, next, and previous, and clears the ±10s actions. Shuffle and repeat stay in the page.

## Reporting

Serialized on `reportChain`.

| When | Jellyfin | SR (if on) |
|------|----------|------------|
| First playing status | `reportPlaying` | `PLAY_START` (not gated on the Jellyfin response) |
| About every 10s while playing | `reportProgress`. A progress post closer than 8s is dropped unless pause changed or the queue is included | none. Periodic `PLAY_PROGRESS` stays off |
| Pause / resume, including the lock screen | `reportProgress` | `PAUSE` / `RESUME` |
| Seek / lock-screen scrub | `reportProgress` | none |
| Shuffle, including the lock screen | `reportProgress` with the new queue | none |
| Repeat off / all / one, including the lock screen | `reportProgress` (`repeatMode`) | none |
| Leave track, including lock-screen next and previous | `reportStopped` | `PLAY_COMPLETE` or `SKIP` (`leaveEventType`) |
| Repeat-one restart | progress | `REPLAY`, then a later skip of that visit can still emit |

Queue tail + `continueWithSr`: `fetchSrNext` + hydrate, append unseen ids.

## Platform

| Concern | Native | Web |
|---------|--------|-----|
| Stream | original = static stream + `Authorization` | always universal MP3, token in query |
| Downloads | yes | throw / hide in the sheet |
| Lock screen | next, previous, seek, shuffle, repeat one/all/off | `media-session.ts` play, pause, seek, next, previous |
| Extra `<audio>` | n/a | `silenceHtmlAudio` |

## Handoff

`adoptRemoteIfIdle`: another device, same user, audio now playing, last check-in ≤ 120s. No-op if local persist already has a queue. Then `playItems(..., { keepOrder, paused, startPosition })` and `Stop` the remote if it was playing.

## Don't

- Construct a second `AudioPlayer` or call `createAudioPlayer` outside the engine.
- Start Instant Mix from `playItem` (album/artist/playlist covers).
- Import `playback` from a screen to call `playItems`.
- Swallow SR failures by breaking local play. SR is best-effort.
