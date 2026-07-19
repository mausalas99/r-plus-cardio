# Plan 009: DX hygiene — CLAUDE.md entry point, .env.example, close the .cjs lint gap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- eslint.config.mjs CONTRIBUTING.md .cursor/rules/project-context.mdc`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

This repo is developed primarily through AI agents (CONTRIBUTING.md has an "Agentes AI" section routing DeepSeek/Cursor agents to `.cursor/rules/`), but there is **no `CLAUDE.md`** — Claude Code sessions start blind and must rediscover the project map, test policy, and debt rules every time. Twelve `R_PLUS_*` environment variables are used by dev scripts with no `.env.example` documenting them. And `eslint.config.mjs` covers `lib/**/*.{mjs,js}` but **not `lib/**/*.cjs`** — three production files escape the Tier-1 debt ratchet entirely, including `lib/db/clinical-ops-bundle-merge.cjs`, which contains the multi-entity LWW merge (`mergeClinicalOpsSnapshotsData`, ~104 lines) that the ratchet would flag.

## Current state

- No `CLAUDE.md` or `AGENTS.md` at repo root. The canonical agent context already exists and is good — `.cursor/rules/project-context.mdc` (project map, test policy, conventions, changelog) and `docs/core/00-system-index.md` (docs hub). CLAUDE.md should **point, not duplicate** (the documentation-sync rule `.cursor/rules/documentation-sync.mdc` and blueprint `docs/core/17-docs-blueprint.md` govern doc structure — read both before writing).
- `eslint.config.mjs:6` — Tier-1 `files` glob:

```js
files: ['public/js/**/*.mjs', 'public/js/**/*.js', 'lib/**/*.mjs', 'lib/**/*.js', 'lan-squad/**/*.js'],
```

  `.cjs` files at `9db031d`: `lib/window-open-policy.cjs`, `lib/db/lan-db-bridge.cjs`, `lib/db/clinical-ops-bundle-merge.cjs` (verify with `find lib lan-squad public/js -name "*.cjs" ! -name "*test*"`).
- Env vars in use (grep `process.env.R_PLUS` across `scripts/`, `lan-squad/`, `lib/`, `main.js`, `server.js` for the authoritative list): includes `R_PLUS_LAN_PERSIST_MODE` (host persistence rollback — documented in `lan-squad/host-store.js:220`), `R_PLUS_LAN_TEAM_CODE` (documented in `server.js` header comment), `R_PLUS_LAN_DEV_PEER_CODE`, `R_PLUS_LAN_HOST`, `R_PLUS_LAN_PATIENT`, and others — enumerate them all in Step 2.
- `npm run metrics:check` is the CI debt gate; adding `.cjs` to eslint coverage may surface NEW violations in those three files (the audit estimated `mergeClinicalOpsSnapshotsData` well over the complexity budget). **The ratchet rule** (`.cursor/rules/technical-debt-accounting.mdc`): Tier 1 applies to *touched* files; merely adding lint coverage must not be blocked by pre-existing violations — handle via the documented warn-only Tier-2 mechanism (Step 3).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint all | `npx eslint .` | see Step 3 (must not get worse) |
| Debt gate | `npm run metrics:check` | exit 0 |
| Targeted metrics tests | `node --test scripts/metrics/score.test.mjs scripts/metrics/check.test.mjs` | `# fail 0` |

## Scope

**In scope** (the only files you should modify/create):
- `CLAUDE.md` (create)
- `.env.example` (create)
- `eslint.config.mjs`
- `CONTRIBUTING.md` (add Claude Code row pointing at CLAUDE.md — the Agentes AI table already has a Claude Code row pointing at `.claude/`; update it)

**Out of scope** (do NOT touch):
- The three `.cjs` files themselves — fixing their violations is separate work (note `clinical-ops-bundle-merge.cjs` decomposition as a follow-up in your report).
- `scripts/metrics/baseline.json` — never edit (hard rule in `technical-debt-accounting.mdc`).
- `.cursor/rules/*` — canonical for Cursor/DeepSeek; CLAUDE.md references them.

## Git workflow

- Branch: `advisor/009-dx-hygiene`
- Commit style: `docs(dx): CLAUDE.md + .env.example; lint coverage for lib .cjs`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write `CLAUDE.md`

~60–90 lines, pointer-first. Required content:

1. One-paragraph project description (Electron 41 medical workbench; Spanish UI; LAN LiveSync; SQLCipher).
2. **Read next**: `.cursor/rules/project-context.mdc` (project map + changelog — the primary map), `docs/core/00-system-index.md` (docs hub), `docs/core/01-vision-north-star.md` (product trade-offs).
3. **Build/test commands** (copy exactly): `npm run build:ui`; `npm start`; targeted tests `node --test <files>` — with the policy verbatim: never run full `npm test` during dev (CI/release only); SQLCipher-native tests need `node scripts/ensure-native-db-for-node.mjs` first and `node scripts/rebuild-native-db.mjs` after.
4. **Hard rules** (one line each, sourced from `.cursor/rules/`): debt ratchet (complexity ≤ 15, function ≤ 80 lines, file ≤ 600; `npm run metrics:check` must pass; never edit `baseline.json`); never hand-edit `public/js/app.bundle.mjs`/chunks; Spanish UI copy; update `.cursor/rules/project-context.mdc` changelog on architectural changes; specs in `docs/superpowers/specs/` before large features.
5. Pointer to `plans/README.md` for the advisor plan backlog.

**Verify**: every file path mentioned in CLAUDE.md exists: `for f in $(grep -oE '[a-zA-Z0-9_./-]+\.(md|mdc|mjs|json)' CLAUDE.md | sort -u); do [ -e "$f" ] || echo "MISSING: $f"; done` → no output.

### Step 2: Write `.env.example`

Enumerate every `process.env.R_PLUS*` (and any other app-specific env var) usage: `grep -rhoE "process\.env\.[A-Z_]+" main.js server.js scripts lib lan-squad public --include="*.js" --include="*.mjs" --include="*.cjs" | sort -u` (filter to project-specific vars; skip NODE_ENV/CI/PATH-type platform vars). For each: a comment line saying what it does and which file consumes it, then `VAR_NAME=` with **no value** (these are dev knobs, not secrets — but set none anyway). `R_PLUS_LAN_PERSIST_MODE` gets its allowed values from `host-store.js:221-233` (`legacy|monolith|json|sharded|sql|sql-v3|sql-monolith`).

**Verify**: every var in `.env.example` appears in the grep output, and vice versa for project-prefixed vars.

### Step 3: Close the `.cjs` lint gap without breaking CI

1. Add `'lib/**/*.cjs'`, `'lan-squad/**/*.cjs'`, `'public/js/**/*.cjs'` to the Tier-1 `files` array in `eslint.config.mjs:6`.
2. Run `npx eslint lib/window-open-policy.cjs lib/db/lan-db-bridge.cjs lib/db/clinical-ops-bundle-merge.cjs`. Two possible outcomes:
   - Clean or warnings only → done.
   - New **errors** (expected at least in `clinical-ops-bundle-merge.cjs`): add a scoped config block downgrading only the violated budget rules to `'warn'` for **exactly the violating files** (not the glob), with a comment `// Tier-2 legacy: TODO decompose — see plans/README.md follow-ups`. This mirrors the documented Tier-2 warn-only policy.
3. Confirm CommonJS parsing works for `.cjs` under the flat config (`sourceType` — the tier1 block sets `sourceType: 'module'`; `.cjs` files need `sourceType: 'commonjs'`; add a `.cjs`-specific block rather than changing tier1).

**Verify**: `npx eslint .` → exit code unchanged-or-better vs before your change (run it on a clean checkout first to record the baseline exit code/count); `npm run metrics:check` → exit 0.

### Step 4: Update CONTRIBUTING.md

In the "Agentes AI" table, point the Claude Code row at `CLAUDE.md` (which then points into `.claude/` and `.cursor/rules/`).

**Verify**: `grep -n "CLAUDE.md" CONTRIBUTING.md` → 1+ match.

## Test plan

No new test files. The verifications above are the gates. (`.env.example` and `CLAUDE.md` are docs; the eslint change is config verified by running eslint.)

## Done criteria

- [ ] `CLAUDE.md` exists; all referenced paths resolve
- [ ] `.env.example` exists and matches the env-var grep
- [ ] `npx eslint lib/db/clinical-ops-bundle-merge.cjs` → parses and reports (file no longer invisible to lint)
- [ ] `npx eslint .` no worse than baseline; `npm run metrics:check` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Adding `.cjs` coverage makes `npm run metrics:check` fail (the metrics scripts may independently glob files — read `scripts/metrics/run.mjs` to check whether eslint config feeds it; if scores shift, a human must approve since baselines are involved).
- An env var's purpose cannot be determined from its usage site — list it as `# TODO: undocumented` rather than guessing.

## Maintenance notes

- CLAUDE.md is a pointer document: when `.cursor/rules/project-context.mdc` changes, CLAUDE.md usually shouldn't need edits — that's the design. Reviewers should reject additions to CLAUDE.md that duplicate the rules files.
- Follow-up (deferred): decompose `mergeClinicalOpsSnapshotsData` in `lib/db/clinical-ops-bundle-merge.cjs` using the plan-006 recipe (goldens first); the lint warnings added here are its tracking signal.
