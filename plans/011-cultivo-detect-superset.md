# Plan 011: Unify cultivo block detection on the superset — all contexts recognize all-caps site headers and extended lab sections

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- public/js/cultivo-block-core.mjs public/js/lab-history-set.mjs public/js/censo-cultivo-format.mjs public/js/lab-bulk-paste.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (clinical-data correctness)
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

Plan 007 consolidated three drifted copies of the cultivo block parser into
`public/js/cultivo-block-core.mjs`, deliberately preserving each call site's
historical behavior behind two option flags. Its maintenance note recorded the
open question: *"a future cleanup could decide whether bulk-paste should
recognize BACILOSCOPIA (likely yes; that drift looks accidental) — that's a
product call with a clinician."* **That call has now been made by the
maintainer (2026-06-12): the superset behavior is correct everywhere.**

Concretely: today the censo cultivo table, censo labs formatting, pase-board,
expediente, and bulk paste all use the *base* detection patterns, so they miss
cultivo blocks introduced by all-caps site headers (e.g. a specimen-site line
like `LIQUIDO PERITONEAL 07/05: PSEUDOMONAS`) and lab sections tagged
`SEROL`/`HECES` — variants that `lab-history-set.mjs` already detects. The
result is missing or misclassified culture rows in clinical views. After this
plan, there is exactly one detection behavior, the flags are gone, and tests
pin the unified behavior.

## Current state

Files and their roles:

- `public/js/cultivo-block-core.mjs` — the unified parser core (plan 007).
  Defines the two flags. Header comment (lines ~8–14) documents the per-context
  differences; lines 71–94:

  ```js
  /**
   * @param {{ allCapsSiteHeaders?: boolean }} [options]
   */
  export function isCultivoBlockStartLine(s, options) {
    var t = String(s).trim();
    if (!t) return false;
    var opts = options || {};
    if (matchesAnyPattern(t, CULTIVO_BASE_START_PATTERNS)) return true;
    if (opts.allCapsSiteHeaders && matchesAllCapsSiteHeader(t)) return true;
    return false;
  }

  /**
   * @param {{ extendedLabHeaders?: boolean }} [options]
   */
  export function isLabSectionHeaderLine(s, options) {
    var opts = options || {};
    var re = opts.extendedLabHeaders ? LAB_SECTION_EXTENDED : LAB_SECTION_BASE;
    return re.test(String(s).trim());
  }
  ```

  `splitResLabsByTipo(rows, options)` (line ~96) forwards `options` to both
  functions. `findCultivoChunkInSet(set, organismoQuery, splitOptions)`
  (line ~290) forwards `splitOptions` too. The all-caps heuristic
  (`matchesAllCapsSiteHeader`) has built-in exclusion guards (lines ~60–66):
  lines starting `INTERCONSULTA|SALA|SERVICIO|UNIDAD|PACIENTE|HOSPITAL|AREA|
  CONTROL|DEPARTAMENTO` and second words like `CARDIOLOGIA|CIRUGIA|…` are
  rejected. Keep those guards — they are what makes always-on safe.

- `public/js/lab-history-set.mjs` (lines 109–115) — the only superset caller
  today; defines the wrapper lambdas that this plan deletes:

  ```js
  var LAB_HISTORY_CULTIVO_OPTS = { extendedLabHeaders: true, allCapsSiteHeaders: true };

  export const isLabSectionHeaderLine = (s) => isLabSectionHeaderLineCore(s, LAB_HISTORY_CULTIVO_OPTS);

  export const isCultivoBlockStartLine = (s) => isCultivoBlockStartLineCore(s, LAB_HISTORY_CULTIVO_OPTS);

  export const splitResLabsByTipo = (rows) => splitResLabsByTipoCore(rows, LAB_HISTORY_CULTIVO_OPTS);
  ```

- Bare-options (base-behavior) consumers that will gain the superset behavior
  *without code changes* once defaults flip — list them so you test them, not
  so you edit them:
  - `public/js/censo-cultivo-format.mjs:34` — `splitResLabsByTipoCore(set.resLabs).cultivo`
  - `public/js/censo-cultivo-format.mjs:17` — `export { splitResLabsByTipo } from './cultivo-block-core.mjs';` → consumed by `public/js/censo-labs-format.mjs:142`
  - `public/js/lab-bulk-paste.mjs:14` — `splitResLabsByTipo(resLabs || [])`
  - `public/js/app-runtimes.mjs:8` — imports `splitResLabsByTipo` and registers
    it on the feature runtime → used by `public/js/features/pase-board.mjs:440`
    and `public/js/features/expediente.mjs:219,304,586`

- Existing tests that pin the *flagged* behavior and must be updated:
  `public/js/cultivo-block-core.test.mjs` — e.g. line 37
  `assert.equal(isCultivoBlockStartLine('SALA MEDICINA INTERNA', { allCapsSiteHeaders: false }), false);`
  and line 50 `assert.equal(isLabSectionHeaderLine('SEROL VIH', {}), false);`

Repo conventions that apply: ESM `.mjs` with `var`-style legacy idiom in these
files — match it. Spanish UI copy (no UI copy changes in this plan). Renderer
sources are bundled — run `npm run build:ui` only if you want to verify in the
app; tests import sources directly.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test public/js/cultivo-block-core.test.mjs public/js/censo-cultivo-format.test.mjs public/js/lab-bulk-paste.test.mjs public/js/lab-history-set.test.mjs public/js/labs-cultivo.test.mjs public/js/censo-labs-format.test.mjs` | exit 0, `# fail 0` |
| Lint touched file | `npx eslint public/js/cultivo-block-core.mjs public/js/censo-cultivo-format.mjs` | 0 problems (both are clean today) |
| Lint baseline (dirty files) | `npx eslint public/js/lab-history-set.mjs public/js/lab-bulk-paste.mjs \| tail -1` | see Step 1 |
| Debt gate | `npm run metrics:check` | see "Done criteria" note |

Note: none of these tests touch SQLCipher natives — no `pretest` needed.

## Scope

**In scope** (the only files you should modify):
- `public/js/cultivo-block-core.mjs`
- `public/js/lab-history-set.mjs`
- `public/js/cultivo-block-core.test.mjs`
- `public/js/censo-cultivo-format.test.mjs`
- `public/js/lab-bulk-paste.test.mjs`
- `public/js/lab-history-set.test.mjs` (only if assertions reference the wrappers/options)
- `public/js/labs-cultivo.test.mjs`, `public/js/censo-labs-format.test.mjs` (only if they pin base-only behavior)

**Out of scope** (do NOT touch, even though they look related):
- `public/js/censo-cultivo-format.mjs`, `public/js/lab-bulk-paste.mjs`,
  `public/js/app-runtimes.mjs`, `public/js/features/pase-board.mjs`,
  `public/js/features/expediente.mjs` — they inherit the new default; no edits.
- `public/js/labs.js` — Tier-2 legacy; `formatCultivoCondensedForCopy` lives
  there and is not part of detection.
- `public/js/chunks/`, `public/js/app.bundle.mjs` — generated output; never edit.

## Git workflow

- Branch: `advisor/011-cultivo-detect-superset`
- Commit style (conventional, match `git log`): `fix(labs): unify cultivo block detection on superset patterns`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record lint baselines for the dirty in-scope files

`public/js/lab-history-set.mjs` has ~27 pre-existing eslint problems and
`lab-bulk-paste.mjs` ~3 (its test file may also be flagged). `metrics:check`
lints changed Tier-1 files with `--max-warnings 0`, so it will report these
pre-existing problems on your branch. Record the baseline now:

**Verify**: `npx eslint public/js/lab-history-set.mjs public/js/lab-bulk-paste.mjs | tail -1`
→ note the problem count (expected around 30). Your obligation is **no new
problems**, not zero.

### Step 2: Fold the extended patterns into the base in `cultivo-block-core.mjs`

1. Merge `LAB_SECTION_EXTENDED` into `LAB_SECTION_BASE` (one regex covering
   SEROL and HECES too); delete the now-unused `LAB_SECTION_EXTENDED` constant
   and the ternary in `isLabSectionHeaderLine`.
2. Make the all-caps site-header check unconditional in
   `isCultivoBlockStartLine` (`if (matchesAllCapsSiteHeader(t)) return true;`).
   Do not weaken the exclusion guards inside `matchesAllCapsSiteHeader`.
3. Remove the `options` parameter from `isCultivoBlockStartLine`,
   `isLabSectionHeaderLine`, and `splitResLabsByTipo`, and the `splitOptions`
   parameter from `findCultivoChunkInSet`. Update their JSDoc.
4. Update the file-header comment block: the per-context differences are
   resolved as of this plan — record "superset everywhere; decided by
   maintainer 2026-06-12 (plan 011); was deferred from plan 007".

**Verify**: `node --test public/js/cultivo-block-core.test.mjs` → fails only
on the flag-mode assertions you will update in Step 4 (e.g. `{ allCapsSiteHeaders: false }`
cases). Any *other* failure is a STOP condition.

### Step 3: Delete the wrapper indirection in `lab-history-set.mjs`

Replace lines 109–115 with direct re-exports:

```js
export {
  isLabSectionHeaderLine,
  isCultivoBlockStartLine,
  splitResLabsByTipo,
} from './cultivo-block-core.mjs';
```

Delete `LAB_HISTORY_CULTIVO_OPTS` and the `…Core` import aliases if no longer
referenced. Internal uses at lines ~222 and ~300 keep working via the same
names.

**Verify**: `node --test public/js/lab-history-set.test.mjs` → exit 0,
`# fail 0` (lab-history-set behavior is unchanged — it already had the superset).

### Step 4: Update the core tests to pin the single behavior

In `public/js/cultivo-block-core.test.mjs`:
- Remove option objects from all calls.
- `'SALA MEDICINA INTERNA'` must still assert `false` (exclusion guard, not flag).
- `'SEROL VIH'` / `'HECES copro'` now assert `true` unconditionally; delete the
  `{}`-options negative case (line ~50).
- `'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS'` asserts `true` unconditionally.

**Verify**: `node --test public/js/cultivo-block-core.test.mjs` → `# fail 0`.

### Step 5: Add superset regression cases to the consumer tests

- `public/js/censo-cultivo-format.test.mjs`: a lab set whose `resLabs` contain
  a cultivo introduced only by an all-caps site header must now produce a row
  in `extractCultivoTableRowsFromLabHistory` (lift a fixture line from
  `cultivo-block-core.test.mjs:23`).
- `public/js/lab-bulk-paste.test.mjs`: the same fixture classified through
  `primaryTipoForResLabs` must come back `'cultivo'` (or `'mixed'` when labs
  are present).

**Verify**: `node --test public/js/censo-cultivo-format.test.mjs public/js/lab-bulk-paste.test.mjs` → `# fail 0`, including your new cases.

### Step 6: Full targeted suite + consumer suites that may pin old behavior

**Verify**: `node --test public/js/cultivo-block-core.test.mjs public/js/censo-cultivo-format.test.mjs public/js/lab-bulk-paste.test.mjs public/js/lab-history-set.test.mjs public/js/labs-cultivo.test.mjs public/js/censo-labs-format.test.mjs public/js/features/estado-actual-io.test.mjs` → `# fail 0`.
If `labs-cultivo.test.mjs` or `censo-labs-format.test.mjs` fail because a
fixture is *newly detected* as cultivo, update the expectation and note it in
the commit body — that is the intended behavior change. If they fail any other
way, STOP.

## Test plan

- New cases (Step 5): all-caps site-header cultivo detected in censo rows and
  bulk-paste classification; extended `SEROL`/`HECES` section treated as labs
  boundary in both.
- Updated cases (Step 4): single-behavior pins in the core test.
- Pattern to follow: existing table-driven cases in
  `public/js/cultivo-block-core.test.mjs` (array of `[line, expected]`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 6 test command exits 0 with `# fail 0`.
- [ ] `grep -rn "allCapsSiteHeaders\|extendedLabHeaders\|LAB_HISTORY_CULTIVO_OPTS" public/js --include='*.mjs' | grep -v chunks | grep -v app.bundle` returns no matches.
- [ ] `npx eslint public/js/cultivo-block-core.mjs` → 0 problems.
- [ ] `npx eslint public/js/lab-history-set.mjs public/js/lab-bulk-paste.mjs | tail -1` → problem count ≤ the Step 1 baseline.
- [ ] `npm run metrics:check` → no `DEBT REGRESSION` line. (Its eslint pass may
  still fail on the ~30 pre-existing problems in lab-history-set/lab-bulk-paste;
  that is acceptable **only** if the Step 1 baseline comparison shows no new
  problems — say so explicitly in your report.)
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The Current-state excerpts don't match the live code (drift since `83049b1`).
- A test failure in Step 2/6 is **not** explained by a newly-detected cultivo
  block or section header (i.e., the unification changed something other than
  detection coverage).
- Removing the `options` parameters breaks a caller you cannot find in the
  "Current state" consumer list (search first: `grep -rn "splitResLabsByTipo\|isCultivoBlockStartLine\|isLabSectionHeaderLine\|findCultivoChunkInSet" public/js --include='*.mjs' | grep -v chunks`).
- You find yourself wanting to edit `labs.js` or any file in the out-of-scope list.

## Maintenance notes

- This closes the decision plan 007 deferred. If a future SOME format variant
  needs context-specific detection again, resist re-adding flags — add the
  pattern to the core with a test, or split a genuinely different parser.
- Reviewer should scrutinize: the exclusion guards in
  `matchesAllCapsSiteHeader` are untouched, and the two new consumer-test cases
  use realistic SOME fixture lines, not synthetic strings.
- Censo/pase-board/expediente surfaces change visibly (more culture rows can
  appear). Release notes should mention it: «Los cultivos con encabezado de
  sitio en mayúsculas ahora aparecen en el censo y pegado masivo».
