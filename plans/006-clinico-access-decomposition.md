# Plan 006: Decompose evaluateClinicalScope (complexity 80) into per-mode evaluators under the Tier-1 budget

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- public/js/clinico-access.mjs public/js/clinico-access.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (access-control semantics must not change)
- **Depends on**: plans/001-ci-test-list-integrity.md
- **Category**: tech-debt
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

`evaluateClinicalScope` in `public/js/clinico-access.mjs` decides whether a resident can read/write a patient. It is the single scariest function in the repo: cyclomatic complexity **80**, cognitive complexity **99**, **226 lines** — against the repo's own Tier-1 ratchet of 15/20/80 (`.cursor/rules/technical-debt-accounting.mdc`). Every guardia/teams feature has to thread through it, and at this complexity each edit is a coin-flip on an access-control regression. The same file has four more functions over budget. This plan is a **pure behavior-preserving decomposition** in the style the repo already used successfully for `procesarLabs` (phase 6: characterization goldens first, then extraction to an orchestrator + helpers, zero output diffs).

## Current state

- `public/js/clinico-access.mjs:872` — `export function evaluateClinicalScope(currentUser, targetPatient, activeGuardia = null, context = null)`. eslint output at commit `9db031d`:

```
872:8  Function 'evaluateClinicalScope' has too many lines (226). Maximum allowed is 80
872:8  Function 'evaluateClinicalScope' has a complexity of 80. Maximum allowed is 15
872:17 Refactor this function to reduce its Cognitive Complexity from 99 to the 20 allowed
283:8  'resolveR4GuardiaSectorLabel' complexity 20
326:8  'patientMatchesTeam' complexity 17
505:8  'salaOnCallR1' complexity 19
622:8  'resolvePatientSala' complexity 22
```

- Internal structure (read lines 872–1110 fully before starting): local `deny(reasoning, extra)` / `allow(reasoning, readable, writable, extra)` constructors returning `{ readable, writable, reasoning, audit: {...}, ...extra }`; then a sequence of early-return blocks — identity guard, admin short-circuit, active-guardia coverage, incoming-preview window, interconsultas, then a large `if (guardiaMode)` tree branching per rank (`R1` / `R2` / `R4` …), then (after the excerpted region) non-guardia team-scope logic.
- The natural seams are the rank branches inside `guardiaMode` and the trailing non-guardia logic. Every branch returns via `allow(...)`/`deny(...)`, which makes extraction mechanical: each extracted evaluator receives a context object plus the `allow`/`deny` constructors and returns a result **or `null`** ("no decision, fall through").
- `public/js/clinico-access.test.mjs` exists and **is in the CI list** — it is the primary safety net. Read it to learn the fixture vocabulary (users, teams, guardias).
- The repo's exemplar for this exact exercise: `docs/superpowers/plans/2026-06-11-phase6-procesarlabs-decomposition.md` and commits `f23d198…b8764fc` ("goldens first, orchestrator ≤15 complexity, zero diffs").
- The `reasoning` strings are Spanish and **load-bearing** (they surface in audit/UX). They must not change, not even whitespace.
- Debt accounting: `npm run metrics:check` gates CI; this change must *reduce* `totalScore` (it removes a complexity-80 overage). Do not edit `scripts/metrics/baseline.json`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `node --test public/js/clinico-access.test.mjs public/js/clinical-access-runtime.test.mjs` | `# fail 0` |
| Lint (the point of the plan) | `npx eslint public/js/clinico-access.mjs public/js/clinico-access-scope/` | exit 0, no complexity errors on the new code |
| Debt gate | `npm run metrics:check` | exit 0 |
| Bundle | `npm run build:ui` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `public/js/clinico-access.mjs`
- `public/js/clinico-access-scope/` (create — one module per extracted evaluator, e.g. `guardia-r1.mjs`, `guardia-r2.mjs`, `guardia-r4.mjs`, `team-scope.mjs`, `shared.mjs` for `allow`/`deny` factories)
- `public/js/clinico-access.test.mjs` (extend with characterization goldens — Step 1)
- `package.json` (`scripts.test`: add any new test file)

**Out of scope** (do NOT touch):
- The four other over-budget functions in this file (`resolveR4GuardiaSectorLabel`, `patientMatchesTeam`, `salaOnCallR1`, `resolvePatientSala`) — they are Tier-2-tolerated at 17–22; bundling them in multiplies regression risk. Note them as follow-ups.
- Any caller (`clinical-access-runtime.mjs`, `clinico-access` consumers) — the export signature and result shape are frozen.
- Behavior. This is a refactor with **zero output diffs**.

## Git workflow

- Branch: `advisor/006-clinico-access-decomposition`
- Commit style: mirror phase 6 — `test(access): characterization goldens for evaluateClinicalScope` then `refactor(access): evaluateClinicalScope decomposed to complexity<=15 orchestrator`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Characterization goldens BEFORE any refactor

In `public/js/clinico-access.test.mjs`, add a characterization suite that calls the **current** `evaluateClinicalScope` across a grid of scenarios and asserts the full result object (readable, writable, reasoning, extras — excluding `audit.timestamp`). Cover at minimum: admin; admin with `enforceTeamPatientScope`; active-guardia covering user; incoming-preview window (readable-not-writable); interconsultas on/off-call; guardiaMode × rank ∈ {R1 (with/without `onCallGuardiaReceiver`, with/without `enforceTeamPatientScope`, sala match/mismatch), R2 (entrega received/not), R4 (sala/torre service, other service)}; non-guardia team member/non-member; missing user/patient → deny. Use the fixture vocabulary already in the test file. Target ≥ 25 scenarios — derive them by reading every `return allow(...)`/`return deny(...)` in the function and ensuring each distinct `reasoning` string appears in at least one golden.

**Verify**: `node --test public/js/clinico-access.test.mjs` → `# fail 0`, and `grep -c "reasoning" public/js/clinico-access.test.mjs` increased accordingly. Commit this before touching the implementation.

### Step 2: Extract `shared.mjs` and the guardia rank evaluators

Create `public/js/clinico-access-scope/shared.mjs` with `makeAllowDeny(currentUser, targetPatient, now)` returning the `{ allow, deny }` pair (verbatim bodies from lines ~890–905). Then extract each `guardiaMode` rank branch into `guardia-r1.mjs`, `guardia-r2.mjs`, `guardia-r4.mjs` (and any further ranks present below the excerpt — read the whole function). Each evaluator: `evaluateGuardiaR1(ctx) → result | null`, where `ctx` carries exactly the locals that branch uses (`rank`, `userId`, `userSala`, `joinedTeams`, `joinedTeamIds`, `assignments`, `guardias`, `targetPatient`, `enforceTeamPatientScope`, `onCallGuardiaReceiver`, `allow`, `deny`, plus the helper functions it calls — pass helpers in `ctx` or import them from `../clinico-access.mjs` if they're exported; prefer importing exported helpers, passing only non-exported ones).

`evaluateClinicalScope` becomes the orchestrator: unchanged preamble + early returns, then `for` the rank evaluators / team-scope evaluator, returning the first non-null result. Move **code, not logic**: copy each branch body verbatim; resist any "improvement".

**Verify after each extraction**: `node --test public/js/clinico-access.test.mjs` → `# fail 0` (goldens prove zero drift). Commit per extraction.

### Step 3: Extract the non-guardia team-scope tail into `team-scope.mjs`

Same recipe for the remaining post-`guardiaMode` logic.

**Verify**: `node --test public/js/clinico-access.test.mjs public/js/clinical-access-runtime.test.mjs` → `# fail 0`.

### Step 4: Confirm the budgets

**Verify**: `npx eslint public/js/clinico-access.mjs public/js/clinico-access-scope/` → **no** `complexity`/`max-lines-per-function`/`cognitive-complexity` errors for `evaluateClinicalScope` or any new module (the four out-of-scope functions may still report — that is expected; confirm no NEW violations).
**Verify**: `npm run metrics:check` → exit 0. `npm run build:ui` → exit 0.

## Test plan

- Step 1's characterization goldens are the test plan (≥25 scenarios, every `reasoning` string covered). Pattern: existing tests in `public/js/clinico-access.test.mjs`; spirit: `public/js/labs-procesar-characterization.test.mjs`.
- Existing suites `clinico-access.test.mjs` + `clinical-access-runtime.test.mjs` must pass unmodified (except additions).

## Done criteria

- [ ] Goldens committed before the refactor (git history shows test commit first)
- [ ] `evaluateClinicalScope` ≤ 80 lines, complexity ≤ 15, cognitive ≤ 20 (eslint clean on it)
- [ ] All new modules eslint-clean under Tier-1
- [ ] `node --test public/js/clinico-access.test.mjs public/js/clinical-access-runtime.test.mjs` → `# fail 0`
- [ ] `npm run metrics:check` exit 0 (score decreased; baseline untouched)
- [ ] Every distinct `reasoning` string from the original function still present verbatim (`git diff` shows no reasoning-string changes)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any golden's result changes at any point — that is an access-control regression, never "close enough".
- The function body below line 1000 (not excerpted in this plan) contains structure that doesn't fit the evaluator-returning-null pattern (e.g. branches that mutate shared state before falling through). Report the structure instead of forcing it.
- Helpers the branches call are non-exported **and** too entangled to pass via ctx cleanly.
- `metrics:check` fails after the refactor (would mean the extraction added more debt than it removed).

## Maintenance notes

- New access rules should now land as a new evaluator module + goldens, not as another branch in the orchestrator.
- Follow-ups deferred: the four remaining over-budget functions in this file; consider the same recipe one at a time.
- Reviewer should scrutinize: the goldens-first commit ordering, and that `ctx` passing didn't accidentally rebind `now` (timestamp differences are excluded from goldens — make sure that exclusion doesn't hide a real `now`-handling change).
