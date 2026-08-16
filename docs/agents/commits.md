# Commits

Conventional Commits so history can feed release notes. Not enforced by commitlint in this repo. Follow the format anyway.

## Format

```
type(scope): subject

[optional body]
```

Examples:

- `feat(player): resume from last queue on attach`
- `fix(library): invalidate infinite likes after favorite`
- `docs(agents): add playback conventions`

## Types

`feat` · `fix` · `perf` · `refactor` · `docs` · `style` · `test` · `build` · `ci` · `chore` · `revert`

Prefer `feat` / `fix` / `perf` for user-facing notes.

## Scopes

Scope is optional. When present, use a product area:

| Scope | Use for |
|-------|---------|
| `player` | Queue, engine, mini player, now playing |
| `library` | Albums, artists, songs, likes, search, playlists |
| `auth` | Login, session, 401 |
| `downloads` | Offline files |
| `radio` | Instant Mix / SR radio |
| `sr` | Smart Recommendations client only |
| `theme` | Palettes, accents, `useColors` |
| `api` | `createApi` / query keys with no single feature owner |
| `deps` | Dependency bumps |

Add a new scope here when a product area appears.

## Subject

- Imperative, present tense ("add", not "added")
- No trailing period
- No agent attribution in the message
