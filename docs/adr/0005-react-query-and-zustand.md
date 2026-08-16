# ADR-0005: React Query for server data, Zustand for client state

- Status: accepted
- Date: 2026-08-16

## Context

Library lists are cacheable and shared across screens. Auth, settings, queue, and chrome are client-owned.

## Decision

- TanStack Query (`src/api/hooks.ts` + `query-keys.ts`) for Jellyfin/SR reads and mutations.
- Zustand for auth, settings, library chrome, home layout, recents, downloads, toast, UI, and the player **mirror**.
- Query keys are factories. Mutations that change library data call `invalidateLibraryQueries` so `items` and `items-infinite` both refresh.
- Optimistic favorite patches the whole query cache with `sameId`, then invalidates.

## Consequences

- Do not `useState` a server list that a hook already fetches.
- Do not put the queue in a persisted Zustand store.
- Do not hand-roll query key arrays.
