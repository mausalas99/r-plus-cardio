---
name: vibedrift-init
description: Use when setting up VibeDrift in a repository for the first time, or when scan noise from fixtures, bundles, or generated artifacts is skewing the score. Runs guided init — writes .vibedrift/config.json and .vibedriftignore, then refreshes the baseline. Works with or without the VibeDrift MCP server.
---

# VibeDrift init

One-time project setup: exclude non-product paths, set default report format and CI score floor, refresh the drift baseline.

Same engine as `vibedrift init` CLI and the MCP `init` tool.

## When to use

- First time VibeDrift is added to a repo (before relying on MCP drift tools).
- MCP tools return `no_baseline` and a full scan has not run yet.
- Scan scores are polluted by bundles, fixtures, tooling artifacts, or generated output.
- Team wants a committable `.vibedriftignore` + `.vibedrift/config.json` shared across machines.

## Workflow

1. **Preview** (optional) — see auto-detected fixture/generated candidates without writing files.
2. **Apply** — write config + exclusions, add repo-specific globs, rescan to rebuild baseline.
3. **Commit** — `.vibedrift/config.json` and `.vibedriftignore` are safe to commit.

## How to run it

Prefer the VibeDrift MCP `init` tool when connected:
- `detectOnly: true` — preview candidates, touch nothing.
- `applyDetectedExcludes: true` + optional `exclude[]`, `failOnScore`, `format` — write files.

Otherwise use the bundled runner:

```bash
# Preview auto-detected exclusions (MCP only — no writes)
# MCP init tool with detectOnly: true

# Apply detected exclusions + defaults (non-interactive, like `vibedrift init --yes`)
node .agents/skills/vibedrift-init/scripts/vibedrift-init.mjs apply --root . --yes

# Apply with CI floor and extra globs (comma-separated)
node .agents/skills/vibedrift-init/scripts/vibedrift-init.mjs apply --root . --yes \
  --fail-on-score 70 \
  --extra "**/fixtures/**,public/js/chunks/**"

# Add one-off ignore patterns after init
node .agents/skills/vibedrift-init/scripts/vibedrift-init.mjs ignore --root . "**/snapshots/**"

# Rebuild baseline after exclusions change
node .agents/skills/vibedrift-init/scripts/vibedrift-init.mjs rescan --root .
```

Or invoke the CLI directly:

```bash
arch -arm64 npx -y @vibedrift/cli init . --yes
arch -arm64 npx -y @vibedrift/cli ignore "public/js/chunks/**"
arch -arm64 npx -y @vibedrift/cli . --local-only
```

## R+ defaults

When initializing this repo, also exclude generated renderer output and tooling artifacts:

```
public/js/app.bundle.mjs
public/js/app.bundle.meta.json
public/js/chunks/**
**/*.map
.understand-anything/**
```

These mirror `.cursorignore` — bundles and analysis artifacts are not product code.

## Reading the result

- `detect` prints JSON with `detected.globs[]` and `detected.count`.
- `apply` prints JSON with `config`, `excludesAdded[]`, `excludesSkipped[]`.
- After apply/rescan, run a scan or use MCP tools — they should not return `no_baseline`.

## Notes

- Detection is automatic; exclusions are only written when you opt in (`--yes` or `applyDetectedExcludes`).
- Changing `.vibedriftignore` invalidates the cached baseline — always rescan after.
- Do not exclude real test files (`*.test.mjs`, `tests/`) — tests are code that drifts too.
- `--fail-on-score` in config is for CI; local scans still report the score either way.
