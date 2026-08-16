# Frontend

Conventions for Expo Router UI: imports, composition, StyleSheet, theme tokens, toasts, Zustand chrome.

## Imports

| Use | Path |
|-----|------|
| Routes | `src/app/**` default export |
| Shared UI | `@/components/...` (no barrels) |
| Server data | `@/api/hooks` |
| Colors | `useColors()` from `@/theme/useColors` |
| Spacing / radii / chrome | `@/constants/theme` (`spacing`, `radii`, `CARD_SIZE`, `MINI_PLAYER_HEIGHT`, `TAB_BAR_HEIGHT`) |
| Player | `usePlayer` from `@/store/player` |
| Navigation helpers | `hrefForItem`, `closeOverlay` from `@/lib/navigation` |

`@/` only. No `from '../…'` inside `src`.

Typical order: external (`react-native`, `expo-*`) → blank line → `@/api` → `@/components` → `@/constants` → `@/hooks` → `@/lib` → `@/store` → `@/theme`.

## Composition

1. **Shared primitive** - `CoverArt`, `IconButton`, `Skeleton`, `EmptyState`, `SearchField`, `GlassSurface`.
2. **Shared domain chrome** - `TrackRow`, `MediaCard`, `Section`, `ActionSheet`, `CollectionActions`, `useTrackActions`.
3. **Screen-local** - stay in the route file until a second screen needs it.

Do not add NativeWind, Tailwind, or `className`. This app is `StyleSheet.create` + inline `useColors()` overlays.

```tsx
const c = useColors();
<Text style={[styles.title, { color: c.text }]} />
```

Layout and type live in `StyleSheet`. Colors and one-off flex/padding may be inline.

`src/global.css` is web-only: horizontal rails (`[data-rail='1']`). Do not put feature styles there.

## Theme tokens

Live palette: `src/theme/palettes.ts` → `resolveColors(themeId, accentId, systemScheme)` → `useColors()`.

| Token | Role |
|-------|------|
| `bg`, `bgDeep` | Page |
| `surface`, `surfaceHover` | Sheets, cards, pressed rows |
| `elevate`, `elevateHover` | Chips, inputs, toast |
| `text`, `textSub`, `textMuted` | Type |
| `accent`, `accentPress`, `accentDim`, `onAccent` | Play / selected |
| `danger` | Destructive |
| `overlay`, `tabBar`, `hairline` | Chrome |
| `isDark` | Status bar / shadows |

Prefer `c.*` over raw hex. Search browse tiles may keep category colors. Overlays on cover art may stay white-on-dark.

Spacing scale: `xs 4 / sm 8 / md 12 / lg 16 / xl 24 / xxl 32`. Radii: `sm 4 / md 8 / lg 12 / pill`. Prefer the scale over magic numbers when it already matches.

## Routing

| Path | Screen |
|------|--------|
| `/(app)/(tabs)` | Home, Search, Library. Queue is a tab-bar button that opens the queue modal |
| `/likes` | Liked Songs (not a tab) |
| `/album/[id]`, `/artist/[id]`, `/playlist/[id]`, `/genre/[name]`, `/radio/[id]` | Details |
| `/player`, `/queue`, `/add-to-playlist`, `/create-playlist` | Native stack modal (`slide_from_bottom`) |
| `/downloads`, `/settings` | Stack |

Auth gate: `(app)/_layout` → `/login`. Persistent chrome: `NowPlayingBar` + `AppTabBar` (hidden on player / playlist editors via `hideAppChrome`).

`/player`, `/queue`, and `/add-to-playlist` are native stack modals. Create playlist and in-tree sheets (`ActionSheet`, `CreateSheet`, `LyricsCard`) use RN `Modal` from the app shell.

New collection pages should use `useCollectionPlayback` and `useNowPlayingPadding()`.

`hrefForItem` maps album / artist / playlist / genre. Audio and unknown types default to `/album/[id]` - callers that handle a tap on Audio must special-case play instead of navigating.

## State

| Scope | Where |
|-------|-------|
| Server lists | React Query (`@/api/hooks`) |
| Playback | `usePlayer` (mirror of the engine) |
| Auth / settings / downloads / recents / home layout / library chrome | matching `src/store/*` |
| Toasts | `useToast().show(message)` |
| Create sheet / last tab | `useUi` |

Do not duplicate player/auth/settings into a new global store.

## A11y

Interactive primitives take `accessibilityRole="button"` (or `tab`) and a label. `IconButton` requires `accessibilityLabel`. Match nearby rows when adding a new pressable.

## Don't

- Import leftover Expo template helpers (`useTheme`, `Colors`, `Fonts`). They were removed.
- Add a second likes screen. `/likes` is an alias to the tab.
- Fetch with `createApi` from a route when a hook already exists.
- Style with CSS modules or NativeWind.
