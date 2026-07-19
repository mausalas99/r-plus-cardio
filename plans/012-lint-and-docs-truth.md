# Plan 012: Make lint runnable repo-wide and fix the two actively-wrong docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- eslint.config.mjs package.json .github/workflows/ci.yml README.md docs/core/07-testing-strategy.md scripts/patch-tour-state-refs.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx + docs
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

Three small, verified problems mislead both humans and agents:

1. **Lint is only enforceable on changed Tier-1 files.** `npm run metrics:check`
   already lints *changed* Tier-1 files vs `main` (see `scripts/metrics/check.mjs:30-40`),
   but there is **no `lint` script**, the root-process files (`main.js`,
   `server.js`, `preload.js`, `generate-*.js`) and `scripts/` have **no eslint
   language config at all** (so they drown in `no-undef` for `require`/`process`),
   and `npx eslint .` explodes with ~98,000 problems because the flat config has
   no ignores for the gitignored vendored dirs (`hallmark/`, `micode/`,
   `superpowers/`, `ui-ux-pro-max-skill/`, `plugins/`, `python-runtime/`).
   Measured 2026-06-12: root+scripts have ~60 real problems once `no-undef`
   noise is excluded — 47 unused-vars (mostly `_`-prefixed catch params that an
   ignore pattern absorbs), 11 `no-empty`, 1 `no-dupe-keys`
   (`scripts/patch-tour-state-refs.mjs:26`), 1 `no-control-regex`.
2. **README's "Architecture" section (lines ~248–280) describes the app as it
   was many majors ago** — a flat `app.js`/`storage.js`/`labs.js` trio. It does
   not mention `public/js/features/` (~250 modules, the primary place for new
   UI work), `app-runtimes.mjs`, `lan-squad/`, or the SQLCipher store in
   `lib/db/`. Agents reading README get a false mental model.
3. **`docs/core/07-testing-strategy.md` says integration tests live in
   `tests/` and to run `npm test`** — `tests/` contains only `__pycache__/`,
   and the repo policy is targeted `node --test` runs in dev with the manifest
   gate in CI.

Deliberately **not** in this plan: a repo-wide lint gate over Tier-1
(`public/js`, `lib`, `lan-squad`). That tree has 2,242 pre-existing problems
(measured); the existing changed-files ratchet in `metrics:check` is the
enforcement mechanism for it. Do not attempt to fix those.

## Current state

- `eslint.config.mjs` — flat config; blocks: `tier1` (public/js, lib,
  lan-squad with complexity/size rules), `tier1Commonjs`, `tier2LegacyCjs`,
  `bootHubs`, and `generatedIgnores` (only `public/js/chunks/**` and bundles).
  Final export:

  ```js
  export default [generatedIgnores, js.configs.recommended, tier1, tier1Commonjs, tier2LegacyCjs, bootHubs];
  ```

  Note `js.configs.recommended` applies to **all** files, with no globals — that
  is why un-configured files report `no-undef` for `process`/`require`.

- `package.json` — scripts: no `lint` entry. CI (`.github/workflows/ci.yml`)
  steps: checkout → setup-node 22 → `npm ci` → `npm run build:ui` →
  `npm run metrics:check` → `npm test`. No lint step.

- `README.md:248-280` — the stale Architecture section, starting:

  ```
  ## Architecture

  R+ is organized into modular components for maintainability and performance:

  ### Module Structure
  ...
  │   ├── app.js (main application: state, UI handlers, Chart.js tendencias, tours, medicamentos)
  ```

- `docs/core/07-testing-strategy.md` — full current body (it is short):

  ```
  # Slot reservado: Testing Strategy

  Este archivo es un **placeholder** para una estrategia de testing formal.

  Mientras tanto:

  - Los tests unitarios están junto al código fuente (`*.test.js`)
  - Los tests de integración están en `tests/`
  - Ejecutar: `npm test`
  - Ver también: `docs/logic/logic-index.md` para cobertura de parsers y engines
  ```

- Authoritative facts to write into the docs (verified):
  - Tests are colocated `*.test.mjs` / `*.test.js` throughout the tree.
  - `npm test` runs an **explicit manifest** of ~332 files listed in
    `package.json` `scripts.test`; drift guard: `scripts/lib/test-manifest.mjs`
    (+ its test) with a `QUARANTINED` list; CI/release only — dev uses targeted
    `node --test <file>`.
  - SQLCipher-native suites need `node scripts/ensure-native-db-for-node.mjs`
    first (the `pretest` hook does this for `npm test`); afterwards
    `node scripts/rebuild-native-db.mjs` restores the Electron ABI.
  - Real architecture map lives in `.cursor/rules/project-context.mdc` and
    `docs/core/04-directory-structure.md` — README should point there, not
    duplicate.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| New lint script | `npm run lint` | exit 0 after Step 3 |
| Lint count probe | `npx eslint main.js server.js preload.js generate-censo.js generate-receta-hu.js 'scripts/**/*.{mjs,js,cjs}' 2>&1 \| tail -1` | shrinking problem count |
| Tests for touched scripts | `node --test scripts/lib/test-manifest.test.mjs scripts/build-ui.test.mjs scripts/bundle-renderer.test.mjs` | `# fail 0` |
| Debt gate | `npm run metrics:check` | `metrics:check OK` (no Tier-1 files touched by this plan) |

## Scope

**In scope** (the only files you should modify):
- `eslint.config.mjs`
- `package.json` (scripts only — add `lint`)
- `.github/workflows/ci.yml`
- `README.md` (Architecture section only)
- `docs/core/07-testing-strategy.md`
- `main.js`, `server.js`, `preload.js`, `generate-censo.js`,
  `generate-receta-hu.js`, `scripts/**/*.mjs|js|cjs` — **only** the minimal
  mechanical fixes needed to make `npm run lint` pass (unused vars, empty
  blocks, the dupe key). No behavior changes.

**Out of scope** (do NOT touch):
- Anything under `public/js/`, `lib/`, `lan-squad/` — Tier-1 lint debt is
  handled by the existing changed-files ratchet, not this plan.
- `scripts/metrics/baseline.json` — never edit (hard repo rule).
- `scripts/ensure-native-db-for-node.mjs`, `scripts/fetch-sqlite-node.mjs`,
  `stable-versions.json` — the maintainer has uncommitted in-flight work here.
  If `npm run lint` flags `ensure-native-db-for-node.mjs`, exclude it from the
  lint glob with a comment instead of editing it.

## Git workflow

- Branch: `advisor/012-lint-and-docs-truth`
- Commits (conventional): `chore(lint): scoped eslint config + npm run lint + CI step`,
  `docs: correct README architecture section and testing-strategy doc`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add ignores and language configs to `eslint.config.mjs`

1. Add a first-position global ignores object:

   ```js
   const vendoredIgnores = {
     ignores: [
       'hallmark/**', 'micode/**', 'superpowers/**', 'ui-ux-pro-max-skill/**',
       'plugins/**', 'python-runtime/**', 'dist/**', 'build/**',
       '.worktrees/**', '.claude/**', '.agents/**',
     ],
   };
   ```

2. Add a `rootProcess` block for `['main.js', 'server.js', 'preload.js', 'generate-censo.js', 'generate-receta-hu.js']`:
   `sourceType: 'commonjs'`, `globals: { ...globals.node }`, rules =
   `js.configs.recommended` plus
   `'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]`.
   Do **not** add the Tier-1 complexity/size rules here.
3. Add a `scriptsBlock` for `['scripts/**/*.mjs', 'scripts/**/*.js', 'scripts/**/*.cjs']`
   with `globals: { ...globals.node }` (`.mjs` → `sourceType: 'module'`) and the
   same unused-vars pattern.
4. Export order: `[vendoredIgnores, generatedIgnores, js.configs.recommended, tier1, tier1Commonjs, tier2LegacyCjs, bootHubs, rootProcess, scriptsBlock]`.

**Verify**: `npx eslint main.js server.js preload.js generate-censo.js generate-receta-hu.js 'scripts/**/*.{mjs,js,cjs}' 2>&1 | tail -1`
→ no `no-undef` for `process`/`require`/`console`; remaining count ≈ 15–60.

### Step 2: Mechanical fixes for the remaining root/scripts violations

Fix only what the Step 1 probe still reports, file by file. Known specifics:
- `scripts/patch-tour-state-refs.mjs:26` — duplicate key
  `TEND_HIDDEN_SERIES_LS`. Look at both values; keep the correct one (compare
  with the real localStorage key in `public/js/tend-prefs.mjs`). This is a
  one-off codemod script — if the two values differ and you cannot determine
  the right one, delete the dead duplicate line and note it.
- ~11 `no-empty` — add `/* ignore */` comment inside the block or convert to
  `catch { /* ignored: <reason from context> */ }`.
- Remaining unused vars not covered by the `^_` pattern — prefix with `_` or
  remove if obviously dead.
- 1 `no-control-regex` — if the control char is intentional (terminal output),
  add an eslint-disable-next-line with a reason.

**Verify**: `npx eslint main.js server.js preload.js generate-censo.js generate-receta-hu.js 'scripts/**/*.{mjs,js,cjs}'` → exit 0.

### Step 3: Add `npm run lint` and the CI step

1. `package.json` scripts:

   ```json
   "lint": "eslint main.js server.js preload.js generate-censo.js generate-receta-hu.js \"scripts/**/*.{mjs,js,cjs}\""
   ```

2. `.github/workflows/ci.yml` — insert after the "UI build" step:

   ```yaml
       - name: Lint (root + scripts)
         run: npm run lint
   ```

**Verify**: `npm run lint` → exit 0. `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0` (you did not touch the manifest).

### Step 4: Rewrite README's Architecture section

Replace lines ~248–280 (the `## Architecture` section through the
"Performance Notes" block, ending before the next `---`) with a short,
truthful section. Required content (keep README's existing mixed ES/EN tone):

- Entry points table: `main.js` (Electron main, CJS) / `preload.js`
  (contextBridge) / `server.js` (Express 5 + WS LAN server, port 3738) /
  `public/js/app.js` → `app-runtimes.mjs` → `public/js/features/*` (renderer
  ESM, bundled by esbuild — never edit `public/js/chunks/` or
  `app.bundle.mjs`) / `lib/` (Node-side shared logic, SQLCipher store in
  `lib/db/`) / `lan-squad/` (LAN host: auth, host-store, persistence).
- One line: new UI work goes in `public/js/features/*.mjs`, then `npm run build:ui`.
- Pointer: "Mapa completo: `.cursor/rules/project-context.mdc` y
  `docs/core/04-directory-structure.md`." Do not duplicate those docs.

**Verify**: `grep -n "app.js (main application" README.md` → no matches;
`grep -n "project-context.mdc" README.md` → at least one match in the new section.

### Step 5: Rewrite `docs/core/07-testing-strategy.md`

Replace the placeholder body (keep the YAML frontmatter, change
`status: "reserved"` → `status: "stable"`). Required content (Spanish, matching
sibling docs):

- Tests colocados (`*.test.mjs`/`*.test.js`) junto al código; **no hay** carpeta
  `tests/` de integración.
- Dev/agentes: ejecutar **targeted** `node --test <archivo>`; nunca la suite
  completa en desarrollo.
- CI/release: `npm test` = manifiesto explícito en `package.json` (~332
  archivos) + guard de drift `scripts/lib/test-manifest.mjs` con lista
  `QUARANTINED` comentada.
- Suites con nativos SQLCipher: `node scripts/ensure-native-db-for-node.mjs`
  antes; `node scripts/rebuild-native-db.mjs` después (los hooks
  `pretest`/`posttest` lo hacen para `npm test`).
- Gates de CI: `build:ui` → lint (root+scripts) → `metrics:check` (ratchet
  eslint sobre archivos Tier-1 cambiados) → `npm test`.

**Verify**: `grep -n "tests/" docs/core/07-testing-strategy.md` → no claim that
integration tests live there; `grep -n "QUARANTINED\|test-manifest" docs/core/07-testing-strategy.md` → ≥1 match.

## Test plan

No new test files. The verification is: `npm run lint` exits 0,
`node --test scripts/lib/test-manifest.test.mjs scripts/build-ui.test.mjs scripts/bundle-renderer.test.mjs` passes (proves script edits broke nothing),
and CI YAML parses (`python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"` → exit 0).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` → exit 0.
- [ ] `npx eslint . 2>&1 | grep -c "ui-ux-pro-max-skill\|hallmark/\|micode/"` → 0 (vendored dirs ignored).
- [ ] `grep -n "Lint" .github/workflows/ci.yml` → one step present.
- [ ] Step 4 and Step 5 grep verifications pass.
- [ ] `node --test scripts/lib/test-manifest.test.mjs scripts/build-ui.test.mjs scripts/bundle-renderer.test.mjs` → `# fail 0`.
- [ ] `npm run metrics:check` → `metrics:check OK`.
- [ ] `git status` shows no modified files outside the in-scope list (in
  particular: NOT `scripts/ensure-native-db-for-node.mjs`, NOT `stable-versions.json`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2 requires more than ~25 individual fixes (the measurement was ~60
  problems mostly absorbed by the ignore pattern; a much larger count means
  the config blocks are wrong).
- A "mechanical" fix in `main.js`/`server.js`/`preload.js` would change
  behavior (e.g. an unused variable that is actually a side-effect import).
- The duplicate-key resolution in `patch-tour-state-refs.mjs` is ambiguous and
  the script appears to still be needed (check git log: if it was a one-shot
  codemod already applied, say so and propose deleting the script instead —
  but do not delete it in this plan).
- The maintainer's in-flight working-tree changes conflict with your branch.

## Maintenance notes

- When the Tier-1 backlog (2,242 problems as of 2026-06-12) is paid down,
  extend the `lint` script to those dirs — until then `metrics:check`'s
  changed-file ratchet is the Tier-1 enforcement.
- Reviewer should scrutinize: no rule *weakening* in existing tier1 blocks;
  the new blocks must not apply complexity/size rules to `main.js`/`server.js`
  (that would instantly fail CI).
- Future doc edits: `documentation-sync.mdc` rule applies — README points at
  the canonical map instead of duplicating it, keep it that way.
