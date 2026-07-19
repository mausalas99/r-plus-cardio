# Plan 007: Consolidate the three drifted copies of the cultivo block parser

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- public/js/censo-cultivo-format.mjs public/js/lab-bulk-paste.mjs public/js/lab-history-set.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (the copies have already diverged — unification must be deliberate, not blind)
- **Depends on**: plans/001-ci-test-list-integrity.md
- **Category**: tech-debt
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

Culture-report (cultivo) block detection/parsing is implemented **three times**: in `public/js/censo-cultivo-format.mjs`, `public/js/lab-bulk-paste.mjs`, and `public/js/lab-history-set.mjs` (functions `isCultivoBlockStartLine`, `parseCultureBlockFromLineArray`, `findCultivoChunkInSet`, …). The copies have **already drifted**: `lab-bulk-paste.mjs` recognizes `ATB` and `Cuenta:` start lines but not `BACILOSCOPIA` / `CULTIVO DE MICOBACTERIAS`; the other two recognize the latter but not the former. That means the same pasted SOME report can be segmented differently depending on which feature ingests it — a clinical-data inconsistency, not just a style smell. Every new culture format (the SOME lab system evolves) currently needs three synchronized edits and gets fewer.

## Current state

Verified divergence at commit `9db031d` — `isCultivoBlockStartLine` per file:

- `public/js/censo-cultivo-format.mjs:28-40`: matches `CULTIVO`, parsed-header, `BACTERIOLOGIA`, `UROCULTIVO`, `HEMOCULTIVO`, `FUNGICULTIVO`, `TINCION DE GRAM`, **`BACILOSCOPIA`**, **`CULTIVO DE MICOBACTERIAS`**, `CATETER`.
- `public/js/lab-history-set.mjs:109-121` (this one is `export`ed): same set as censo-cultivo-format.
- `public/js/lab-bulk-paste.mjs:15-27`: matches `CULTIVO`, parsed-header, `BACTERIOLOGIA`, `UROCULTIVO`, `HEMOCULTIVO`, `FUNGICULTIVO`, `TINCION DE GRAM`, `CATETER`, **`ATB`**, **`Cuenta:`** — and is **missing** `BACILOSCOPIA` / `CULTIVO DE MICOBACTERIAS`.

Before writing any code, diff the *other* duplicated functions across the three files the same way (`grep -n "function parseCultureBlockFromLineArray" -A 60 <file>` etc.) and record every behavioral difference in a scratch list. Differences are either (a) accidental drift — unify to the superset/correct behavior, or (b) intentional per-context behavior — keep as an option flag. The `ATB`/`Cuenta:` lines in lab-bulk-paste look intentional for its context (bulk-paste segmentation needs to break on antibiogram continuation lines); treat them as a flag, not a global addition, unless tests prove otherwise.

- Tests that pin current behavior: `public/js/labs-cultivo.test.mjs` (in CI list), `public/js/censo-cultivo-format.test.mjs` (orphan — added to CI by plan 001), `public/js/lab-bulk-paste.test.mjs` (in CI list), `public/js/lab-history-set.test.mjs` (in CI list).
- Conventions: renderer `.mjs`, legacy `var` style in these files, pure functions, colocated tests with `node:test`. Tier-1 budgets apply (complexity ≤ 15 — the audit measured the existing copies at 16–23, so extraction must also *simplify* slightly or split predicate tables from logic).
- Domain vocabulary (use in names/comments): "cultivo" block = a culture section inside a pasted SOME lab report; "set" = one dated lab set in historial.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test public/js/labs-cultivo.test.mjs public/js/censo-cultivo-format.test.mjs public/js/lab-bulk-paste.test.mjs public/js/lab-history-set.test.mjs` | `# fail 0` |
| Lint | `npx eslint public/js/cultivo-block-core.mjs` | exit 0 |
| Debt gate (duplication should DROP) | `npm run metrics:check` | exit 0 |
| Bundle | `npm run build:ui` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `public/js/cultivo-block-core.mjs` (create — the single implementation)
- `public/js/cultivo-block-core.test.mjs` (create)
- `public/js/censo-cultivo-format.mjs`, `public/js/lab-bulk-paste.mjs`, `public/js/lab-history-set.mjs` (switch to importing from core; delete local copies)
- `package.json` (`scripts.test`: add the new test file)

**Out of scope** (do NOT touch):
- `public/js/labs.js` and the `procesarLabs` pipeline — freshly decomposed (phase 6) with golden tests; cultivo handling there is separate.
- `public/js/features/expediente.mjs` — references the same names but defines nothing (import-only); it should keep working untouched. If it imports from one of the three files, only the import path may change if unavoidable — prefer keeping re-exports so it doesn't change at all.
- Any change to what any call site *parses* beyond resolving the documented drift via flags.

## Git workflow

- Branch: `advisor/007-cultivo-core`
- Commit style: `refactor(labs): single cultivo block parser core with per-context flags`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory the drift

Produce the full behavioral diff of the duplicated functions across the three files (names, regex sets, loop bounds). Write it as a comment block at the top of the new `cultivo-block-core.mjs` ("Consolidates three copies; differences found and their resolution: …").

**Verify**: the four existing test files pass before any change: `node --test public/js/labs-cultivo.test.mjs public/js/censo-cultivo-format.test.mjs public/js/lab-bulk-paste.test.mjs public/js/lab-history-set.test.mjs` → `# fail 0`.

### Step 2: Create `cultivo-block-core.mjs`

Implement the unified functions with an options object where behavior legitimately differs, e.g. `isCultivoBlockStartLine(line, { bulkPasteBreaks = false } = {})` where `bulkPasteBreaks` adds the `ATB`/`Cuenta:` patterns. Keep the regex list as a data table (array of RegExp) so complexity stays ≤ 15. Export everything `lab-history-set.mjs` currently exports for this domain (it is the only one that `export`s — other modules may already import from it; check with `grep -rn "from './lab-history-set.mjs'" public/js | grep -i cultivo`).

Write `cultivo-block-core.test.mjs`: every start-line pattern (one positive + one negative case each), both flag modes, and the parse/find functions against 2–3 realistic multi-line cultivo fixtures (lift fixtures from the existing four test files).

**Verify**: `node --test public/js/cultivo-block-core.test.mjs` → `# fail 0`.

### Step 3: Switch the three call sites

One file per commit. Replace each local copy with imports from `cultivo-block-core.mjs` (passing the appropriate flags). Where a file `export`ed the function (`lab-history-set.mjs`), keep a re-export so external importers are untouched.

**Verify after each file**: that file's test suite passes, e.g. `node --test public/js/lab-bulk-paste.test.mjs` → `# fail 0`. If a test fails because the unified superset changed segmentation (e.g. `BACILOSCOPIA` now recognized in bulk-paste), that is a **behavior decision**: default to preserving each file's old behavior via flags and record the divergence in the core's header comment — do not silently change what a feature parses.

### Step 4: Full gate

**Verify**: all four existing suites + the new one → `# fail 0`; `npm run metrics:check` → exit 0 (duplication debt should drop); `npm run build:ui` → exit 0; `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0` after adding the new test to `package.json`.

## Test plan

- `cultivo-block-core.test.mjs` per Step 2.
- The four pre-existing suites are the regression net; they must pass without modification (except import-path edits if a test imported a now-removed local symbol).

## Done criteria

- [ ] `grep -rn "function isCultivoBlockStartLine" public/js` → exactly 1 definition (in `cultivo-block-core.mjs`)
- [ ] All five test suites pass
- [ ] Drift inventory documented in the core module header
- [ ] `npm run metrics:check` exit 0; `npm run build:ui` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The non-start-line functions (`parseCultureBlockFromLineArray`, `findCultivoChunkInSet`) differ across files in ways that are not expressible as a small options flag (structurally different algorithms) — consolidation may not be worth it there; report the diff.
- Unifying forces a behavior change in any feature that the existing tests don't pin down (you'd be guessing at clinical semantics).
- `expediente.mjs` or another importer breaks and the fix requires editing it beyond an import path.

## Maintenance notes

- New culture formats now land in one regex table. When SOME adds a format, update `cultivo-block-core.mjs` + its test only.
- The per-context flags document real behavioral differences — a future cleanup could decide whether bulk-paste *should* recognize `BACILOSCOPIA` (likely yes; that drift looks accidental) — that's a product call with a clinician, deliberately not made here.
- Reviewer should scrutinize: the flag defaults exactly reproduce each call site's old regex set (compare against the Step 1 inventory).
