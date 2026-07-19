# Plan 008: Characterization tests for the LAN sync core (orchestrator, transport, push, room)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- public/js/features/lan/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (large, but directly serves the product's NOW horizon)
- **Effort**: L
- **Risk**: MED (tests only — risk is wasted effort if seams are wrong, not breakage)
- **Depends on**: plans/001-ci-test-list-integrity.md; do this AFTER 002/003 land (they change LAN behavior you'd otherwise pin wrongly)
- **Category**: tests
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

The renderer's LiveSync core — `public/js/features/lan/orchestrator.mjs` (2,185 lines), `transport.mjs` (1,466), `push.mjs` (1,136), `room.mjs` (1,130) — has **no direct tests**; only the small `host-patients-*` helpers in the same directory do. These four modules are simultaneously the highest-churn area of the repo (LAN entries dominate the changelog) and the heart of the product's stated NOW-horizon goal: "LiveSync stability — … sync reliability so the turn census is trustworthy without manual refresh" (`docs/core/01-vision-north-star.md`). Today every LAN fix is verified by hand on devices. Characterization tests around the seams that exist won't prove correctness, but they make the next ten LAN changes reviewable and are the prerequisite for any future decomposition of these god-modules (Tier-2 → Tier-1).

This is **not** a refactor plan. Do not restructure the modules to make them testable beyond the minimal dependency-injection seams described below.

## Current state

- `public/js/features/lan/` — `orchestrator.mjs` (discovery, host registry eviction, census reconcile, purge flows — e.g. `purgeLanPatientFromHost` at line ~995), `transport.mjs` (fetch wrappers, bearer handling, host-URL candidates, `registerLanSyncTransportDeps` global-deps pattern at lines 75–118), `push.mjs` (bundle push, outbox flush), `room.mjs` (join/leave, PIN connect, reconnection).
- Existing sibling tests to model after:
  - `public/js/lan-connection-manager.test.mjs` — the house style for LAN state machines: factory + injected fakes (`createLanConnectionManager({ lanClient: _fakeLanClient(), sseClientFactory: ... })`), `describe/it` from `node:test`, `assert/strict`, `_simulateFailure()` helpers. **This is the pattern to copy.**
  - `public/js/features/lan/lan-patient-delete.test.mjs`, `host-patients-enrich.test.mjs` — how tests already import from inside `features/lan/`.
  - `public/js/lan-sync-wiring.test.mjs`, `lan-sync-bundle-push.test.mjs`, `live-sync-outbox.test.mjs` — adjacent behaviors already pinned; do not duplicate their coverage.
- These modules run in the renderer but are plain ESM — `node --test` can import them **if** module-level side effects (DOM access, `window`/`localStorage` reads at import time) are absent or guarded. Determining this per module is Step 1.
- Conventions: tests colocated, `*.test.mjs`, `node:test`; no test framework beyond that. CI list maintained via `scripts.test` + the plan-001 manifest guard.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Run one new suite | `node --test public/js/features/lan/<file>.test.mjs` | `# fail 0` |
| All LAN-adjacent suites | `node --test public/js/features/lan/*.test.mjs public/js/lan-sync-wiring.test.mjs public/js/lan-sync-bundle-push.test.mjs` | `# fail 0` |
| Bundle | `npm run build:ui` | exit 0 |
| Manifest guard | `node --test scripts/lib/test-manifest.test.mjs` | `# fail 0` |

## Scope

**In scope**:
- `public/js/features/lan/orchestrator.test.mjs`, `transport.test.mjs`, `push.test.mjs`, `room.test.mjs` (create)
- Minimal injection seams inside the four modules **only where a function is untestable because it directly references a global** (e.g. accept an optional `fetchImpl`/`now`/`storage` param defaulting to the global). Each seam: smallest possible diff, no behavior change.
- `package.json` (`scripts.test`)

**Out of scope** (do NOT touch):
- Any decomposition/refactor of the four modules — that is future work this plan enables.
- `lan-squad/` (host side — already tested), `lan-connection-manager.mjs`, `lan-delta-client.mjs` (already tested).
- jsdom or any new devDependency. If a function cannot be tested without a DOM, skip it and record it.

## Git workflow

- Branch: `advisor/008-lan-core-tests`
- Commit style: `test(lan): characterization tests for <module>` — one commit per module.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Importability survey (timebox: this decides everything)

For each of the four modules, attempt a bare import in a scratch test: `node --test` with just `import('./orchestrator.mjs')`. Record per module: imports cleanly / needs globals stubbed (which ones — `window`, `localStorage`, `document`, `fetch`) / has import-time side effects. Globals can be stubbed at test top (`globalThis.localStorage = …`) **before** dynamic `import()` — prefer that over editing modules.

**Verify**: a scratch note (in your report, not committed) listing importability per module. If **all four** fail to import even with stubbed globals (deep import-time DOM work), STOP — the testing approach must change (likely jsdom or extraction), which is a human decision.

### Step 2: `transport.mjs` tests first (purest module)

Target the exported pure-ish functions: host-URL candidate building, bearer header construction, the `registerLanSyncTransportDeps` / global-deps fallback behavior (lines 75–118 — test that re-registration syncs the global, and that the documented esbuild dual-instance fallback path re-reads the global). Inject `fetch` via stub where requests are made; assert request URL/headers/body shapes, not network behavior.

Aim for 10–15 tests pinning: URL candidate ordering, auth header formation, deps registration/fallback, error mapping (HTTP error → returned `{ ok: false, error }` shapes — grep the module for `ok: false` returns and pin each distinct `error` string reachable without DOM).

**Verify**: `node --test public/js/features/lan/transport.test.mjs` → `# fail 0`.

### Step 3: `room.mjs` and `push.mjs`

- `room.mjs`: join-flow state transitions with stubbed transport (model the fake-injection on `lan-connection-manager.test.mjs`); PIN-connect input validation; reconnect/backoff decisions if they're pure functions of injected clock.
- `push.mjs`: given a fake outbox + stubbed transport, assert push payload composition (which entities, revision fields), coalescing/early-exit conditions, and the error path (push fails → outbox retains entries).

10–15 tests each, pinning current behavior including oddities (a characterization test documents what IS, with a comment when behavior looks suspicious — do not "fix" while pinning).

**Verify**: `node --test public/js/features/lan/room.test.mjs public/js/features/lan/push.test.mjs` → `# fail 0`.

### Step 4: `orchestrator.mjs` — targeted, not exhaustive

2,185 lines; pin only the highest-value seams: `purgeLanPatientFromHost` decision ladder (invalid/demo id → `invalid_id`; not configured → `not_configured`; owned-by-other without force → `owned_by_other_client` + `skipped: true`; force bypass; bundle-only path) — stub `lanFetchHostPatientRow`/`pushPatientDeleteToHost` via whatever seam Step 1 found (if these are module-internal with no seam, add the minimal injection parameter). Plus host-registry eviction rules and census reconcile entry conditions **if** importable without DOM.

≥ 10 tests. If after honest effort fewer than 5 orchestrator behaviors are testable without DOM, write those 5 and record the blockers in the report — partial is fine here.

**Verify**: `node --test public/js/features/lan/orchestrator.test.mjs` → `# fail 0`.

### Step 5: Register and gate

Add all four test files to `scripts.test`. Run the LAN-adjacent battery.

**Verify**: `node --test public/js/features/lan/*.test.mjs public/js/lan-sync-wiring.test.mjs scripts/lib/test-manifest.test.mjs` → `# fail 0`; `npm run build:ui` → exit 0 (proves the injection seams didn't break the bundle); `npm run metrics:check` → exit 0.

## Test plan

This plan IS a test plan; coverage targets per module are in the steps. Structural pattern: `public/js/lan-connection-manager.test.mjs`.

## Done criteria

- [ ] Four new test files exist; combined ≥ 40 tests; `# fail 0`
- [ ] Every injection seam added is default-parameter-only (`git diff` on the four modules shows no behavior change — only optional params with global defaults)
- [ ] `npm run build:ui` exit 0; `npm run metrics:check` exit 0
- [ ] New files registered in `scripts.test` (manifest guard passes)
- [ ] Report lists what was NOT testable and why (the honest residual)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds all four modules un-importable even with stubbed globals.
- A needed seam requires restructuring a module (moving code between files, changing exports used elsewhere) — that's the refactor this plan explicitly defers.
- Pinning a behavior requires understanding a sync invariant you cannot determine from code + existing tests (e.g. "is it intended that push retries N times?") — record the question, skip the test.

## Maintenance notes

- These are characterization tests: when a future change intentionally alters LAN behavior, updating them is expected — the value is that the change becomes *visible* in review.
- The Step 1 importability notes are the map for the eventual decomposition of these modules (the debt ratchet will force it when they're next touched).
- Reviewer should scrutinize: that no test asserts on incidental details (exact log strings, property order) that would make the suite brittle.
