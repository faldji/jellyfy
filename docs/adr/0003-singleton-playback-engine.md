# ADR-0003: Singleton playback engine, Zustand as a mirror

- Status: accepted
- Date: 2026-08-16

## Context

expo-audio wants one `AudioPlayer`. React Strict Mode remounts layouts. Queue, persist, and Jellyfin session reporting must outlive a screen.

## Decision

- `PlaybackEngine` (`playback`) owns the player, queue, persist (`jellyfy.playback`), and reporting.
- `usePlayer` subscribes once at module load and exposes the same methods. Screens do not write snapshot fields.
- `PlaybackHost` attaches on session, detaches on logout. Persist restore is always paused.

## Consequences

- Do not call `createAudioPlayer` outside the engine.
- Do not persist the Zustand player store. The engine already persists.
- UI tests / new screens go through `usePlayer` (or `useCollectionPlayback`), not `playback`.
