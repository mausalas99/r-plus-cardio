# Metrics & technical debt

Debt accounting is defined in `.cursor/rules/technical-debt-accounting.mdc`.

| File | Role |
|------|------|
| `baseline.json` | Committed snapshot; PRs must not increase `totalScore`. |
| `report.json` | Generated locally/CI (gitignored). |

## Commands

| Script | Role |
|--------|------|
| `npm run metrics` | ESLint full tree + boot graph hash → `report.json` |
| `npm run lint:tier1` | ESLint on Tier 1 paths changed vs `main` |
| `npm run lint:tier1:full` | ESLint on entire `public/js`, `lib`, `lan-squad` (exit 0 gate) |
| `npm run metrics:check` | Fail if `report.totalScore > baseline.totalScore` or Tier 1 violations in changed files |
| `npm run metrics:baseline` | Refresh `baseline.json` after approved debt paydown (human-initiated) |
| `node scripts/metrics/fix-mechanical-eslint.mjs --full` | Mechanical ESLint pass on full Tier 1 tree |

**Baseline (2026-06-21):** `totalScore=50` (boot graph structural delta only; complexity/length/unused at 0).
