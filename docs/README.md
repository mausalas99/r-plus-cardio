# R+ Documentation

## Start here

| Audience | Entry |
|----------|-------|
| **DeepSeek GUI (Kun)** | [core/00-system-index.md](./core/00-system-index.md) → [.deepseek/rules.md](../.deepseek/rules.md) → `.cursor/rules/` |
| **Other AI agents** | [core/00-system-index.md](./core/00-system-index.md) → [01-vision-north-star.md](./core/01-vision-north-star.md) → `.cursor/rules/project-context.mdc` |
| **Developers** | [../README.md](../README.md) (install & releases) |
| **Contributors** | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Product / strategy** | [core/01-vision-north-star.md](./core/01-vision-north-star.md) |
| **Large features** | [superpowers/specs/](./superpowers/specs/) then [superpowers/plans/](./superpowers/plans/) |
| **API reference** | [api/README.md](./api/README.md) |
| **Release history** | [../CHANGELOG.md](../CHANGELOG.md) |

## Structure

```
docs/
├── core/           # Strategy & architecture (numbered 00–18, slots 05/07/09-14 have placeholders)
├── features/       # Feature index → code paths
├── logic/          # Parsers & engines
├── database/       # SQLCipher map
├── api/            # HTTP + IPC API reference
├── logs/           # agent-changelog.md
└── superpowers/    # Design specs & implementation plans
```

Root-level docs:

- `CHANGELOG.md` — consolidated release history (auto-generated from `docs/RELEASE_NOTES_*.txt`)
- `CONTRIBUTING.md` — guide for human and AI contributors
- `design.md` — Hallmark design system
- `.deepseek/rules.md` — DeepSeek GUI (Kun) agent rules
- `.cursor/rules/` — always-on agent rules (canonical home)

Maintained per [core/17-docs-blueprint.md](./core/17-docs-blueprint.md).
