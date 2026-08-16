# ADR-0006: StyleSheet + useColors, not NativeWind

- Status: accepted
- Date: 2026-08-16

## Context

The Expo template shipped CSS / theme shims. The app is a dark-first music client with multiple palettes and an accent picker.

## Decision

- React Native `StyleSheet` for layout and type.
- Runtime colors from `src/theme/palettes.ts` via `useColors()`.
- Spacing / radii / chrome heights in `src/constants/theme.ts`.
- No NativeWind, no Tailwind, no `className` in `src`.
- `src/global.css` is web-only (horizontal rails).
- Floating chrome (tab bar, mini player, sheets) uses `GlassSurface` - iOS liquid glass when available, `BlurView` otherwise.

## Consequences

- New UI copies nearby StyleSheet files, not CSS modules.
- Do not reintroduce Expo template `Colors` / `useTheme` aliases.
