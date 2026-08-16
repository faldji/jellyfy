# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`. That directory is gitignored except this convention.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is a `Status:` line near the top (see `triage-labels.md`)
- Comments append under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number.

## Wayfinding

- **Map**: `.scratch/<effort>/map.md`
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md` with `Type:` (`research` / `prototype` / `grilling` / `task`) and `Status:` (`claimed` / `resolved`)
- **Blocking**: `Blocked by: NN, NN`
- **Claim**: set `Status: claimed` before work
- **Resolve**: append `## Answer`, set `Status: resolved`
