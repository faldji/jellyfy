# ADR-0004: Optional Smart Recommendations sidecar

- Status: accepted
- Date: 2026-08-16

## Context

Home "Recommended", radio, and next-track can be smarter than Jellyfin Instant Mix. The model lives in a separate service. This repo is the player.

## Decision

- SR is off by default (`srEnabled` + `srBaseUrl` in settings).
- Same MediaBrowser token as Jellyfin. Different base URL.
- SR returns `trackId`s. Hydrate through Jellyfin `/Items?ids=` using `normId`.
- On empty or error, fall back to Instant Mix / existing Jellyfin behavior.
- Events (`postSrEventSafe`) never throw into playback.
- Radio (`useRadioMix` and engine `tracksForMix`) share that fallback.

The training pipeline, feature store, and model spec do **not** live in this repo.

## Consequences

- Agents must not require SR for a feature to work.
- Do not paste ML service architecture into player PRs.
- If SR becomes its own repo, give it its own `CONTEXT.md` / ADRs there.
