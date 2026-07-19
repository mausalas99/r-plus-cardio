# Plan 019: Decompose `features/lan/orchestrator.mjs` (2,207 lines) along its natural seams

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- public/js/features/lan/orchestrator.mjs`
> Plan 015 intentionally edits this file first (removes ~5 lines around
> line 1981) — that drift is expected; fold it in. Any OTHER drift: compare the
> "Current state" outline against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED–HIGH (LAN sync kernel; mitigated by the plan-008 characterization suite and mechanical move-only steps)
- **Depends on**: plan 015 (same file; tiny; land it first)
- **Category**: tech-debt
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`orchestrator.mjs` is the LAN sync kernel: boot wiring, entity-version
tracking, conflict resolution, patient delete/purge, and historia-clínica push
all live in one 2,207-line file. Every LAN change pays a full-file context tax,
and the debt ratchet (≤600 lines Tier-1) means any substantive touch is already
out of policy. The blocker that made decomposition unsafe — no tests — was
removed this cycle: plan 008 landed a 15-test characterization suite
(`orchestrator.test.mjs`, merged `07754ac`) precisely to enable this refactor.
The move is mechanical (functions relocate, orchestrator re-exports), so
existing importers keep working.

## Current state

- `public/js/features/lan/orchestrator.mjs` — 2,207 lines, 54 top-level
  functions. Verified outline with the extraction clusters marked:

  ```
  177–301   boot/warm/render wiring (scheduleTierALanServerWarm, renderPatientListLanSilent,
            profiledMergeLiveSyncFullBundles, profiledRefreshTodoUIsAfterReconcile,
            wireLanNetworkRefresh, registerLanRuntime)                      [stays]
  319–463   entity-version tracking + mutation building (readLiveSyncEntityMap,
            liveSyncEntityStoreKey, getLiveSyncEntityBase, rememberLiveSyncEntity,
            rememberPatientDeleteTombstone, syncHostBundleEntityFromApplied,
            stampTodosWithEntityVersions, rememberTodosFromMap,
            buildLiveSyncMutationFromDesired, sendLiveSyncMutation)        → CLUSTER A: entity-versions.mjs
  464–788   conflict machinery (isRoomBundleConflictDraft, clearConflictDraft,
            discardDraftsForConflictEntity, acceptServerBundleConflict,
            acceptServerClinicalOpsConflict, applyConflictUseServer,
            clearHistoriaPendingAfterConflict, mergeConflictSnapshotData,
            conflictDataForViewer, shouldAutoResolveTodoConflict,
            tryAutoResolveTodoConflict, appendLanConflictDraftsSection,
            applyLwwConflictLocally, handleSyncConflict, wsConflictDetailToPayload)
                                                                            → CLUSTER B: conflicts.mjs
  789–838   interno/monitoreo bridges                                       [stays]
  839–918   host patient row fetch/push/restore                             [stays or → C]
  919–1047  patient delete/purge (buildPatientDeleteMutation,
            lanDeleteHostPatientCensus, pushPatientDeleteToHost,
            purgeLanPatientFromHost)                                        → CLUSTER C: patient-delete.mjs
  1048–1142 historia clínica push/fetch (lanPushHistoriaClinica,
            lanPushHistoriaClinicaDelta, lanSyncPatientArchivedFlag,
            lanFetchHistoriaClinica)                                        → CLUSTER C or D (judgment)
  1143–~1980 live-sync collection/merge/apply + reconcile                   [stays this plan]
  ~1981–2207 wireLanSyncBridges + remaining wiring                          [stays]
  ```

- Test gate: `public/js/features/lan/orchestrator.test.mjs` (15
  characterization tests; purge guards, demo-id blocking, config checks).
  Sibling suites: `transport.test.mjs`, `push.test.mjs`, `room.test.mjs`.
  Wiring suites that pin import shapes: `public/js/lan-sync-wiring.test.mjs`,
  `public/js/features/lan-delta-wiring.test.mjs`, `public/js/app-boot-imports.test.mjs`.

- Import conventions: `features/lan/` siblings (`push.mjs`, `room.mjs`) import
  from `./orchestrator.mjs` and vice versa — check for cycles before each move
  (`node --test public/js/app-boot-imports.test.mjs` catches boot-graph breaks).
  The thin barrel `public/js/features/lan-sync.mjs` re-exports from
  orchestrator — leave the barrel untouched; orchestrator re-exports moved
  symbols so all external import paths stay valid.

- **eslint trap (important)**: orchestrator has ~76 pre-existing problems and
  NO per-file override — but new files get full Tier-1 rules enforced on a
  *changed-file* basis by `metrics:check` (`--max-warnings 0`). A moved
  function that carries a pre-existing violation (e.g. >80 lines, complexity
  >15, `_e` unused) makes the NEW file fail. Rules for this plan:
  - Mechanical hygiene fixes while moving are sanctioned: `_`-prefix unused
    params, fill empty catches with a comment, split a >80-line function at an
    obvious seam.
  - Anything beyond that (real restructuring to satisfy complexity ≤15) → that
    function STAYS in orchestrator this round; note it in the report.

- Lint baselines to record before starting: `npx eslint public/js/features/lan/orchestrator.mjs | tail -1` (~76).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Characterization gate (after EVERY move) | `node --test public/js/features/lan/orchestrator.test.mjs public/js/features/lan/push.test.mjs public/js/features/lan/room.test.mjs public/js/features/lan/transport.test.mjs` | `# fail 0` |
| Boot/wiring gate | `node --test public/js/app-boot-imports.test.mjs public/js/lan-sync-wiring.test.mjs public/js/features/lan-delta-wiring.test.mjs` | `# fail 0` |
| Bundle | `npm run build:ui` | exit 0 |
| New-file lint | `npx eslint public/js/features/lan/entity-versions.mjs public/js/features/lan/conflicts.mjs public/js/features/lan/patient-delete.mjs` | 0 problems |
| Debt gate | `npm run metrics:check` | no `DEBT REGRESSION`; expect totalScore to improve |

## Scope

**In scope** (the only files you should modify):
- `public/js/features/lan/orchestrator.mjs`
- New: `public/js/features/lan/entity-versions.mjs`, `…/conflicts.mjs`,
  `…/patient-delete.mjs` (and optionally `…/historia-sync.mjs` for the
  1048–1142 cluster — executor judgment, record the call)
- `public/js/features/lan/orchestrator.test.mjs` — import-path updates only if
  it imports moved symbols directly; assertions unchanged
- `scripts/lib/test-manifest.mjs` + `package.json` — only if you add new test
  files

**Out of scope** (do NOT touch):
- `public/js/features/lan/{push,room,transport,panel,runtime}.mjs` — if a move
  seems to require editing them beyond updating an import specifier, STOP.
- `public/js/features/lan-sync.mjs` barrel and `app-runtimes.mjs`.
- Behavior of any function — this is a MOVE refactor; the characterization
  suite is the arbiter.
- `lan-squad/**` (host side).

## Git workflow

- Branch: `advisor/019-orchestrator-decomposition`
- One commit per cluster (conventional): `refactor(lan): extract conflict machinery to features/lan/conflicts.mjs` etc.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baselines

Record: `wc -l public/js/features/lan/orchestrator.mjs` (expect ~2,202 after
plan 015) and the eslint problem count. Run both test gates once green before
any change.

**Verify**: both gates `# fail 0` pre-change.

### Step 1: Extract CLUSTER B (conflicts) — biggest, cleanest seam

1. Move the 15 conflict functions (lines ~464–788) to
   `public/js/features/lan/conflicts.mjs`.
2. They will need imports for the orchestrator-module state they close over
   (e.g. `activeLiveSyncRoomId`, runtime accessors). Pattern to follow: how
   `push.mjs` imports shared state from `./runtime.mjs` (read its import block
   first). State that lives in orchestrator module scope and cannot move
   cleanly → pass via an explicit `configureConflicts({ getActiveRoomId, … })`
   init called from `registerLanRuntime` (match the `configure(deps)` idiom of
   `lan-mutation-registry.mjs`).
3. Orchestrator re-exports the public ones:
   `export { acceptServerBundleConflict, acceptServerClinicalOpsConflict, … } from './conflicts.mjs';`

**Verify**: both test gates `# fail 0`; `npm run build:ui` exit 0;
`npx eslint public/js/features/lan/conflicts.mjs` → 0 problems.

### Step 2: Extract CLUSTER C (patient delete/purge)

Same procedure for `buildPatientDeleteMutation`, `lanDeleteHostPatientCensus`,
`pushPatientDeleteToHost`, `purgeLanPatientFromHost` → `patient-delete.mjs`.
Note: the orchestrator characterization tests pin purge-guard behavior — they
are your proof the move was faithful. If plan 010 has landed,
`lanDeleteHostPatientCensus` will contain the client-token header logic — move
it as-is.

**Verify**: gates green; new file lint-clean.

### Step 3: Extract CLUSTER A (entity versions)

The 10 tracking/mutation-builder functions (lines ~319–463) →
`entity-versions.mjs`. These are the most state-entangled (localStorage maps +
in-module caches); if more than ~30 lines of orchestrator state must be
threaded through config, STOP per the conditions below and ship Steps 1–2 only.

**Verify**: gates green; new file lint-clean.

### Step 4 (optional, judgment): historia clínica cluster

If after Steps 1–3 `wc -l` is still > 1,200, extract lines ~1048–1142 to
`historia-sync.mjs` the same way. Otherwise skip and say so.

### Step 5: Final sweep

**Verify**:
- `wc -l public/js/features/lan/orchestrator.mjs` → ≤ 1,200 (hard target; ~1,000 expected).
- `npx eslint public/js/features/lan/orchestrator.mjs | tail -1` → ≤ Step 0 baseline (expect materially lower — the moved code was hygiened).
- `npm run metrics:check` → no `DEBT REGRESSION` (totalScore should drop; report the delta).
- Full gates + `node --test public/js/features/patients-tab-preserve.test.mjs public/js/lan-sync-bundle-push.test.mjs` → `# fail 0`.

## Test plan

- No new behavior ⇒ no new behavior tests. The characterization suite + wiring
  suites ARE the test plan; they must pass unmodified (import-path edits aside).
- Add one import-shape test per new module ONLY if trivial: assert the module
  exports its expected names (model after `public/js/features/settings-help-imports.test.mjs`).
  Register any new test file in the manifest.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `wc -l public/js/features/lan/orchestrator.mjs` ≤ 1,200.
- [ ] All Step 5 test commands `# fail 0`; characterization assertions unmodified
  (`git diff public/js/features/lan/orchestrator.test.mjs` shows import-path
  changes at most).
- [ ] New modules eslint-clean (0 problems each).
- [ ] Orchestrator eslint count ≤ baseline.
- [ ] `npm run build:ui` exit 0.
- [ ] `npm run metrics:check` → no `DEBT REGRESSION`.
- [ ] `grep -rn "from './orchestrator.mjs'" public/js/features/lan | wc -l` —
  no *increase* vs Step 0 (no new cycles into the kernel).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Any characterization test fails and the cause is not a missing
  import/re-export (i.e., behavior actually changed).
- A cluster needs more than mechanical hygiene to pass Tier-1 lint in its new
  file (complexity restructuring) — leave that function in orchestrator,
  finish the rest, and report which functions resisted.
- Moving CLUSTER A requires threading > ~30 lines of orchestrator state.
- An import cycle appears (`app-boot-imports.test.mjs` failure or esbuild
  warning) that re-export placement cannot break.
- Plan 015's edit is not present in the file (run order violated — land 015 first).

## Maintenance notes

- Future LAN mutation types: handler wiring stays in orchestrator's
  `wireLanSyncBridges`; conflict semantics go in `conflicts.mjs`; version
  bookkeeping in `entity-versions.mjs`. Don't let the kernel re-accrete.
- Reviewer should scrutinize: the `configure*` dependency injection (no hidden
  globals), and that every moved export is re-exported from orchestrator
  (external importers must not need changes — verify with
  `grep -rn "from '.*orchestrator" public/js | grep -v features/lan/`).
- `panel.mjs` (3,160 lines) was deliberately NOT planned this cycle: it has no
  characterization suite. If it gets one, replay this plan's playbook there.
