# Domain Docs

How to consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** - ADRs that touch the area you are about to work in

If a listed file is missing, proceed. Do not invent a parallel glossary.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-expo-native-player.md
│   └── …
└── src/
```

This is a single-context repo. Do not add `CONTEXT-MAP.md` or per-folder `CONTEXT.md` unless the product actually splits (for example a separate SR service repo).

## Use the glossary's vocabulary

When output names a domain concept (issue title, refactor, test name), use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary avoids.

If the concept is missing, that is a signal: either you are inventing language, or there is a real gap. Add a glossary line when a term is resolved, not speculatively.

## Flag ADR conflicts

If output contradicts an existing ADR, say so instead of silently overriding:

> Contradicts ADR-0003 (singleton playback engine) - but worth reopening because…
