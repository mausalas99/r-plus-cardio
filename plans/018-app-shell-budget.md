# Plan 018: Bring `app-shell.mjs` back under its 800-line budget and re-enable its quarantined test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- public/js/app-shell.mjs public/js/app-shell-exports.test.mjs scripts/lib/test-manifest.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (shell wiring touches many modals; mitigated by mechanical extraction + the re-enabled test)
- **Depends on**: plan 013 recommended first (it drains the other 5 quarantined
  suites; this plan removes the 6th and last). Not a hard dependency.
- **Category**: tech-debt
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`public/js/app-shell.mjs` is 841 lines against the 800-line budget its own
test enforces, so the test (`app-shell-exports.test.mjs`) sits quarantined —
which also disables its *other* job: guarding the backward-compat re-exports
(`guardMobileDocExport`, `launchConfetti`, `applyDefaultsToNewPatient`) that
older import sites rely on. The quarantine reason also records a "DOM
side-effect on import; file-level timeout". One function dominates the file:
`initModalDismiss` spans lines ~309–714 (~405 lines of modal-close wiring).
Extracting it restores the budget with margin, un-quarantines the test, and
removes the last entry from the quarantine list.

## Current state

- `public/js/app-shell.mjs` — 841 lines. Structure (top-level functions and
  their start lines, verified):

  ```
  130 registerAppShellContext   136 wireShellExportRuntimes
  158 syncActivePatientContextBar  162 syncMedPatientGate  171 setMedTabAttention
  176 syncWorkContextChrome  192 chooseOutputDir  204 setMobileBootBanner
  283 onDefaultServicioBlur  295 onMedicoTemplateBlur
  309 initModalDismiss        ← ~405 lines, the extraction target
  715 updatePatient  751 rpcPrefersReducedMotion
  763–786 deprecated re-exports (guardMobileDocExport, launchConfetti, applyDefaultsToNewPatient)
  786 appShellWindowHandlers  795 installClinicalAppShell
  801 _rpcDeferInit  824 scheduleDeferredShellInits  837 scheduleDeferredUiInits
  ```

- `public/js/app-shell-exports.test.mjs` — what it asserts (verified):
  - line-count gate: `app-shell.mjs stays at or under 800 lines`;
  - presence of the three deprecated re-exports (regex over source +
    `collectExportedNames`);
  - it stubs DOM before importing (`stubDomForShellImport()` defines
    `globalThis.document` with `addEventListener`/`getElementById`,
    `globalThis.window`, `globalThis.localStorage`) — yet the quarantine
    reason says import still times out. Diagnosing what the stub misses is
    Step 3.

- Quarantine entry (`scripts/lib/test-manifest.mjs`):
  `// public/js/app-shell-exports.test.mjs — fails: app-shell 842>800 line budget + DOM side-effect on import; file-level timeout`

- eslint context: `app-shell.mjs` is in the `bootHubs` override
  (`max-lines-per-function: 120`) — but a **new** extracted module gets plain
  Tier-1 rules (**80 lines/function, complexity ≤15**). A 405-line function
  cannot move as one piece: the extraction must restructure it as a data table
  + small wiring functions (Step 2). `app-shell.mjs` currently has ~15 eslint
  problems — record the baseline; no new problems.

- Exemplar for the pattern: `public/js/modal-dismiss.mjs` (an existing,
  separate modal-dismiss registry module — read it first; the extracted code
  must follow its idiom and may be able to reuse it).

- Convention: feature modules export `windowHandlers` and get registered in
  `app-runtimes.mjs`; but shell-level extractions are imported directly by
  `app-shell.mjs` (see how `document-export-client.mjs` and `features/chrome.mjs`
  were split out of the shell in the `cold-start-shell` refactor — git log
  `2026-06-03`, same playbook).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| The gating test | `timeout 60 node --test public/js/app-shell-exports.test.mjs; echo "exit=$?"` | `exit=0` after Step 4 |
| Shell-adjacent suites | `node --test public/js/modal-dismiss.test.mjs public/js/app-boot-imports.test.mjs public/js/app-state.test.mjs` | `# fail 0` |
| Bundle check | `npm run build:ui` | exits 0 (renderer must bundle after shell edits) |
| Lint baseline | `npx eslint public/js/app-shell.mjs \| tail -1` | record (~15) |
| Manifest | `node scripts/lib/test-manifest.mjs` | 0 quarantined at the end |
| Debt gate | `npm run metrics:check` | no `DEBT REGRESSION` |

## Scope

**In scope** (the only files you should modify):
- `public/js/app-shell.mjs`
- `public/js/app-shell-modals.mjs` (new — or fold into `modal-dismiss.mjs` if
  Step 2's reading shows it is the same registry; decide there and record why)
- `public/js/app-shell-exports.test.mjs`
- `public/js/app-shell-modals.test.mjs` (new)
- `scripts/lib/test-manifest.mjs`, `package.json` (de-quarantine + register tests)

**Out of scope** (do NOT touch):
- The three deprecated re-exports and `appShellWindowHandlers` — external
  import sites depend on them; they stay in `app-shell.mjs`.
- `public/js/app-runtimes.mjs` — no registration changes needed for a direct
  import.
- Any feature module whose modal is being wired (e.g. `features/...-panel.mjs`)
  — the extraction moves wiring, not modal behavior.
- `public/js/chunks/`, `app.bundle.mjs` — generated.

## Git workflow

- Branch: `advisor/018-app-shell-budget`
- Commits: `refactor(shell): extract modal dismiss wiring to app-shell-modals`,
  `test(shell): re-enable app-shell-exports suite`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read before cutting

Read `initModalDismiss` in full (`app-shell.mjs:309-714`) and
`public/js/modal-dismiss.mjs` (+ its test). Inventory what the 405 lines
actually are — expect: many per-modal registrations (id, close-fn, options)
plus a few special cases. Record the inventory in the commit message.

**Verify**: you can name (a) the repeated registration shape, (b) every
special case that does NOT fit it.

### Step 2: Extract as data + small functions

Create `public/js/app-shell-modals.mjs`:
- A `MODAL_DISMISS_ENTRIES` table (array of objects) for the repeated shape.
- One small `wireModalDismiss(entries)` loop (≤80 lines, complexity ≤15).
- Special cases as named small functions.
- Export a single `initModalDismiss()` that `app-shell.mjs` imports and calls
  at the same point it defined it before (line ~309). Re-export
  `initModalDismiss` from `app-shell.mjs` if anything imported it from there
  (`grep -rn "initModalDismiss" public/js --include='*.mjs' | grep -v chunks`
  — check first).
- **Import-time purity**: the new module must do NOTHING at import time (no
  DOM reads at top level) — this is half of the test-timeout fix.

**Verify**: `npm run build:ui` → exit 0; `wc -l public/js/app-shell.mjs` →
≤ 780; `npx eslint public/js/app-shell-modals.mjs` → 0 problems.

### Step 3: Diagnose and fix the test's import timeout

Run `timeout 60 node --test public/js/app-shell-exports.test.mjs; echo "exit=$?"`.
If it still hangs/times out, find the import-time side effect that outlives the
stub: comment-bisect the imports at the top of `app-shell.mjs` (temporarily,
restore after) or use `node --input-type=module -e "globalThis.document={addEventListener(){},getElementById(){return null}}; globalThis.window={}; await import('./public/js/app-shell.mjs'); console.log('imported'); setTimeout(()=>console.error(process.getActiveResourcesInfo()),300).unref()"`
to see what resource keeps the loop alive. Fix direction: move the side effect
behind an init function (matching Step 2's purity rule), or extend
`stubDomForShellImport()` in the **test** if the missing piece is just another
DOM stub (e.g. `matchMedia`, `requestAnimationFrame`).

**Verify**: the test command exits 0 in < 60s.

### Step 4: Re-enable the suite

Remove the `app-shell-exports` entry from `QUARANTINED` in
`scripts/lib/test-manifest.mjs`; add `public/js/app-shell-exports.test.mjs`
and your new `public/js/app-shell-modals.test.mjs` to `package.json`
`scripts.test`.

**Verify**: `node scripts/lib/test-manifest.mjs` → missing/extra empty,
quarantined: 0 (if plan 013 already ran) — and
`node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`.

## Test plan

- New `public/js/app-shell-modals.test.mjs`: import purity (importing the
  module touches no DOM — import under a bare `node --test` with no stubs and
  assert it doesn't throw), table integrity (every entry has id + close fn),
  and one wiring case with a stubbed `document`. Model after
  `public/js/modal-dismiss.test.mjs`.
- Re-enabled `app-shell-exports.test.mjs` keeps asserting: ≤800 lines + the
  three deprecated re-exports.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `wc -l public/js/app-shell.mjs` → ≤ 780.
- [ ] `timeout 60 node --test public/js/app-shell-exports.test.mjs public/js/app-shell-modals.test.mjs public/js/modal-dismiss.test.mjs; echo "exit=$?"` → `exit=0`, `# fail 0`.
- [ ] `npm run build:ui` → exit 0.
- [ ] `npx eslint public/js/app-shell-modals.mjs` → 0 problems; `npx eslint public/js/app-shell.mjs | tail -1` → ≤ baseline count.
- [ ] `grep -c "app-shell-exports" scripts/lib/test-manifest.mjs` → 0.
- [ ] `npm run metrics:check` → no `DEBT REGRESSION`.
- [ ] Manual smoke after `npm start`: open and Escape-close at least 3
  different modals (Ajustes, a patient modal, doc-export) — closing behavior
  identical. Report which you checked.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `initModalDismiss` turns out NOT to be dominated by a repeatable
  registration shape (i.e., >150 lines of irreducible special cases) — the
  extraction needs a different seam; report the inventory.
- The import-time side effect (Step 3) originates in a module `app-shell.mjs`
  imports (not in app-shell itself) — fixing other modules is out of scope;
  report which one.
- Escape/close behavior changes for any modal in the smoke test.
- You need to touch `app-runtimes.mjs` or any feature module.

## Maintenance notes

- New modals: register in `MODAL_DISMISS_ENTRIES` (one line) instead of adding
  wiring code to the shell. If the entry shape doesn't fit, that is a design
  smell to raise in review, not a reason to add a bespoke block to app-shell.
- Reviewer should scrutinize: import purity of the new module, and that the
  three deprecated re-exports still resolve (`node -e` import probe or the
  re-enabled test).
- This closes the quarantine list entirely (with plan 013). Keep it at zero.
