# ADR-0001: Expo native player, not a desktop shell

- Status: accepted
- Date: 2026-08-16

## Context

Jellyfy is a personal music client for one Jellyfin server. It ships as a mobile app, not a desktop shell.

## Decision

Ship as Expo SDK 57 + React Native + Expo Router. Android and iOS are first-class. Web plays in the page. It has no background audio, lock screen, or downloads.

Background audio, lock-screen controls, and downloads require a development build (`expo run:android` / `ios`), not Expo Go.

No Play Store / App Store signing in this repo.

## Consequences

- Agents must read Expo v57 docs, not generic React Native patterns.
- Import rules are layer-based (`app` / `api` / `playback` / `store`).
- Web stream and download behavior will always be a subset of native.
- Lock-screen next, previous, shuffle, repeat, and the timed seek bar are `patches/expo-audio+57.0.5.patch`, compiled from source. Do not add a second player.
