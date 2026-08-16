# Triage Labels

Skills speak in five canonical triage roles. This file maps those roles to the strings used in `.scratch/` issue files.

| Role | Label in our tracker | Meaning |
|------|----------------------|---------|
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an unattended agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill says "apply the AFK-ready triage label", write `Status: ready-for-agent`.
