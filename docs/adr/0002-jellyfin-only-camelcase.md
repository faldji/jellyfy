# ADR-0002: Jellyfin-only client, camelCase domain types

- Status: accepted
- Date: 2026-08-16

## Context

This app talks to one Jellyfin 10.12 server.

## Decision

- One HTTP client: `jellyfinFetch` + `createApi(session)`.
- Domain type is `BaseItem` (OpenAPI camelCase + `camelize()`).
- Optional SR is a sidecar with its own base URL, not a second library backend.

## Consequences

- Do not add a second library HTTP client or a server-kind switch unless the product scope changes (new ADR).
- Query param names stay camelCase. A few request **bodies** stay PascalCase because Jellyfin requires it (auth, playlist create).
- Upstream OpenAPI is last resort; encode discoveries in `src/api/types.ts` and `createApi`.
