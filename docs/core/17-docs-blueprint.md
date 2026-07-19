---
type: "core"
name: "Documentation Blueprint"
status: "stable"
description: "In-repo pointer to the Documentation Architecture Bootstrap standard."
---

# Documentation Blueprint

R+ follows the **vibe-app-wiki Documentation Architecture Bootstrap** standard.

## Folder taxonomy

| Directory | Role |
|-----------|------|
| `docs/core/` | Strategy, architecture, hub (`00-system-index.md`) |
| `docs/features/` | Feature workflows → code paths |
| `docs/logic/` | Parsers, sync engines, generators |
| `docs/database/` | SQLCipher schema |
| `docs/api/` | HTTP + IPC API reference |
| `docs/logs/` | `agent-changelog.md` |
| `docs/superpowers/` | **User-managed** specs & plans (do not auto-index) |

## Root-level docs

| File | Role |
|------|------|
| `CHANGELOG.md` | Consolidated release history (auto-generated) |
| `CONTRIBUTING.md` | Contribution guide |
| `design.md` | Hallmark design system |

## Naming

- Core: `0x-name.md` (e.g. `01-vision-north-star.md`)
- Features: `feat-<name>.md`
- Logic: `util-<name>.md`

## Agent config directories

| Tool | Config location |
|------|----------------|
| **DeepSeek GUI (Kun)** | `.deepseek/rules.md` → `.cursor/rules/` (canonical) |
| Cursor | `.cursor/rules/` (canonical) |
| Claude Code | `.claude/` |
| OpenCode | `.opencode/` |
| Repowise | `.repowise/` |

`.cursor/rules/` is the **canonical home** for always-on agent rules.

## Agent maintenance rules

1. **Product trade-offs** → read `01-vision-north-star.md` before proposing features
2. **Code locations** → `.cursor/rules/project-context.mdc` on every session
3. **New feature domain** → update `features-index.md` + `project-context` changelog on commit
4. **Large features** → spec in `docs/superpowers/specs/` before implementation
5. **Wrap-up** → append `docs/logs/agent-changelog.md`

Full standard: Cursor skill `documentation-architecture-bootstrap`.
