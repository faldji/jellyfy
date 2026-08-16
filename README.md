# Jellyfy

A music client for a self-hosted Jellyfin library.

- **Stack:** Expo SDK 57 + React Native + TypeScript + Expo Router
- **Platforms:** Android and iOS (web works for browse/login; background audio is native)
- **Distribution:** personal / sideload. No Play Store or App Store signing in this repo.
- **Server API:** Jellyfin 10.12

## What it does

- Sign in to your Jellyfin server (`POST /Users/AuthenticateByName`, `MediaBrowser` token)
- Home, Search, Your Library, and Liked Songs, plus album / artist / playlist / genre pages
- Queue, shuffle, repeat, like, playlists, radio
- Stream via `/Audio/{id}/universal` (or original `/stream?static=true`)
- Report play state to Jellyfin (`/Sessions/Playing*`)
- Optional Smart Recommendations sidecar (off by default). When enabled: Home "Recommended for you", radio, and next-track can use SR. If SR is down, Jellyfin behavior is unchanged.
- Mini player + full player + lyrics when the server has them
- Lock screen / notification controls and background audio (`expo-audio`)
- Offline downloads on iOS and Android (`GET /Items/{id}/Download`)

## Day-0 loop

```bash
npm install
npm run typecheck
npx expo start
```

Scan the QR code with Expo Go to browse UI. **Background playback and lock-screen controls need a development build**, not Expo Go:

```bash
npx expo run:android
npx expo run:ios      # macOS + Xcode
```

Web (browse + login; CORS must be allowed on the server):

```bash
npx expo start --web
```

## Personal install

| Target | Command | Signing |
|---|---|---|
| Android phone/emulator | `npx expo run:android` | Debug keystore, generated locally |
| iOS simulator | `npx expo run:ios` | Automatic Xcode development signing |
| iOS device | `npx expo run:ios --device` | Free Apple ID personal team is enough |

Do not run `eas submit` unless you later want store tracks.

## Jellyfin setup

1. Music library enabled on the server.
2. A normal user (not only an API key) so `/Items` can take `userId`.
3. For web, allow the Expo origin in Jellyfin networking / reverse-proxy CORS.
4. Server URL examples: `http://192.168.1.10:8096` or `https://jellyfin.example.com`.

Auth header:

```
Authorization: MediaBrowser Client="Jellyfy", Device="<phone or browser name>", DeviceId="…", Version="1.0.0", Token="…"
```

Streaming quality lives in Settings (`original` / `high` 320 / `normal` 192 / `low` 96).

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Metro + Expo dev server |
| `npm run android` / `ios` / `web` | Platform-specific start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run lint` | Expo lint |

## Agents

Contributor / coding-agent rules live in `AGENTS.md` and `docs/agents/`. Domain language is `CONTEXT.md`. Decisions are `docs/adr/`.
