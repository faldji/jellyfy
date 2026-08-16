# Architecture

Layers and import rules. Read when adding a module, crossing a layer, or changing auth / session lifecycle.

## Layout

| Tree | Role |
|------|------|
| `src/app` | Expo Router routes only. Default-export screens. No `createApi`, no `playback` singleton. |
| `src/api` | Jellyfin HTTP, types, query keys, React Query hooks, optional SR client |
| `src/playback` | Process-wide `PlaybackEngine`, web MSE, session handoff, media session |
| `src/store` | Zustand: auth, settings, library chrome, home layout, recents, downloads, player mirror, toast, UI |
| `src/components` | Shared UI. Named exports. No route files. `SpectrumBars` may call `playback.subscribeSamples`. |
| `src/hooks` | Screen-level hooks (`use-collection-playback`, progress, swipe). Kebab-case files. |
| `src/lib` | Pure or platform helpers. No React components. |
| `src/theme` | Palettes + `useColors()`. The live color system. |
| `src/constants` | `app.ts` identity, `theme.ts` spacing / radii / chrome heights |

One JS runtime. Native modules (`expo-audio`, SecureStore, file system) are called directly.

## Builds

| Target | Command | Notes |
|--------|---------|-------|
| Metro | `npm start` | Expo Go: browse UI only |
| Android | `npx expo run:android` | Background audio + lock screen |
| iOS | `npx expo run:ios` | macOS + Xcode |
| Web | `npx expo start --web` | Browse + login. CORS on the server. No downloads. |

Background playback needs a development build, not Expo Go. See ADR-0001.

## Alias

`@/*` → `src/*`. All in-repo imports use `@/`. No relative `../` imports inside `src`.

## Import boundaries (culture - not ESLint)

- **`src/lib`** → no `@/app`, `@/components`, `@/store` (except types if unavoidable). `storage` / `device` may use RN + Expo.
- **`src/api/client.ts`**, **`types.ts`**, **`query-keys.ts`** → no React, no Zustand. The HTTP layer registers an unauthorized callback; auth wires it.
- **`src/api/hooks.ts`** → React Query. May read stores. Must call `createApi` / `queryKeys`, not raw `fetch`.
- **`src/api/sr.ts`** → settings + session only. Must not break playback if SR is down.
- **`src/playback`** → `createApi`, settings, downloads, recents, toast. UI talks through `usePlayer`, not `playback` (exception: `subscribeSamples`).
- **`src/components`** → hooks, stores, `imageUrl`. Do not call `jellyfinFetch` or `createApi` except image/auth headers already used by `CoverArt`.
- **`src/app`** → components + hooks + stores. Do not import `playback`.

Screens fetch through `@/api/hooks`. The engine reuses the same query keys via `queryClient.fetchQuery` for album / artist / playlist tracks. Downloads may call `createApi` for file URLs.

Do not add a second HTTP client or a WebSocket for browse. See ADR-0007.

## Session lifecycle

1. `RootLayout` hydrates `useAuth` from SecureStore (AsyncStorage on web), then hides splash.
2. `/` redirects to `/login` or `/(app)/(tabs)`.
3. `(app)/_layout` redirects to `/login` if there is no session.
4. `PlaybackHost` (always mounted after hydrate) attaches the engine, adopts a remote session if idle, resolves `musicViewId` from `userViews()`.
5. Logout or a hard 401 (`setUnauthorizedHandler`) clears the local session. `PlaybackHost` then `detach` + `reset` + `queryClient.clear()`.

Device id is kept across logout.

## Persistence

| Key | Owner | What |
|-----|-------|------|
| `jellyfy.session` / `jellyfy.deviceId` | `useAuth` via `src/lib/storage.ts` | Secrets |
| `jellyfy.settings` | `useSettings` | Quality, theme, play-all, last login, SR flags |
| `jellyfy.library-ui` | `useLibrary` | Tab/sort/layout/liked-only. **Not** `musicViewId`. |
| `jellyfy.home-layout` | `useHomeLayout` | Home rail order |
| `jellyfy.recents` | `useRecents` | Per-owner recents + search queries |
| `jellyfy.downloads` | `useDownloads` | File metadata (native files under `Paths.document/jellyfy-downloads`) |
| `jellyfy.playback` | engine | Queue + position. Restore is always paused. |

## Related

- Server library API: `docs/agents/api.md`
- Engine: `docs/agents/playback.md`
- UI: `docs/agents/frontend.md`
- Logging: `docs/agents/logging.md`
