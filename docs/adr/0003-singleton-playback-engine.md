# ADR-0003: Singleton playback engine, Zustand as a mirror

- Status: accepted
- Date: 2026-08-16

## Context

The engine must own one transport. React Strict Mode remounts layouts. Queue, persist, and Jellyfin session reporting must outlive a screen.

SDK 58 lock-screen next and previous exist on `AudioPlaylist`, not on `AudioPlayer`. A second player would fight the lock screen.

## Amendment

- Date: 2026-09-25
- Native transport is one `AudioPlaylist`. Web stays one `AudioPlayer`.

## Decision

- `PlaybackEngine` (`playback`) owns the transport, queue, persist (`jellyfy.playback`), and reporting.
- Web transport is one `AudioPlayer`. Android and iOS use one `AudioPlaylist` so lock-screen next and previous are the SDK 58 API, not a second player.
- Do not call `createAudioPlayer` or `createAudioPlaylist` outside the engine.
- `usePlayer` subscribes once at module load and exposes the same methods. Screens do not write snapshot fields.
- `PlaybackHost` attaches on session, detaches on logout. Persist restore is always paused.

## Consequences

- Do not call `createAudioPlayer` or `createAudioPlaylist` outside the engine.
- Do not persist the Zustand player store. The engine already persists.
- UI tests / new screens go through `usePlayer` (or `useCollectionPlayback`), not `playback`.
