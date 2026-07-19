---
type: "core"
name: "Design System"
status: "stable"
description: "Pointer to Hallmark UI tokens and conventions for R+."
---

# Design System

**Source of truth:** [`design.md`](../../design.md) and [`public/tokens.css`](../../public/tokens.css).

## Principles (summary)

- High information density without visual noise; borders and typography over color.
- Single accent (`--color-accent`); semantic success/error only.
- IBM Plex Sans (UI), IBM Plex Mono (labs, values).
- No gradients on chrome or CTAs; motion 150–220ms.

## Key tokens

| Token | Role |
|-------|------|
| `--color-paper` | App / Pase background |
| `--color-surface` | Cards, header, sidebar |
| `--color-ink` / `--color-ink-muted` | Text |
| `--color-accent` | Primary actions, active tab |
| `--color-livesync-*` | LiveSync Wi‑Fi header states |

## Layout modes

- **Normal:** sidebar + main tabs (Laboratorio, Expediente, …)
- **Pase:** `appcontent-pase` round board
- **Guardia:** compact metrics + phase bar (`guardia-board.mjs`)

## Related

- Styles: `public/styles/`
- Shell: `public/js/app-shell.mjs`
