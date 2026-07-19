# Plan 015: Remove the no-op `patient-fields` mutation handler that silently suppresses the safety-bundle fallback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- public/js/features/lan/orchestrator.mjs public/js/lan-mutation-registry.mjs public/js/features/patients.mjs public/js/features/lan/push.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. **Must land before plan 019** (which decomposes
  `orchestrator.mjs`; both touch the same region).
- **Category**: tech-debt (latent correctness hazard)
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

The LAN mutation registry dispatches typed mutations to a registered handler;
only **unhandled** domains fall back to "mark untyped dirty + schedule the 30s
safety bundle". The `patient-fields` domain registers a handler that does
**nothing**:

- nothing is pushed live,
- the error-path outbox fallback never triggers (the handler cannot throw),
- and because a typed handler *exists*, the untyped safety-bundle fallback is
  **suppressed**.

Today this causes no data loss — the only dispatch site is the patient-delete
path, which separately propagates via tombstone + full bundle push. But it is a
live-looking sync path that silently drops anything routed to it: the next
developer who dispatches `patient-fields` from a new call site gets no push, no
outbox, no safety bundle, and no error. The matching server endpoint
(`PUT /patients/:id/fields`) and outbox kind make it look fully wired.

The resolution decided at audit: **remove the stub** so the domain falls back
to the honest untyped path; keep the server endpoint and the outbox drain case
for compatibility with anything already queued.

## Current state

- `public/js/lan-mutation-registry.mjs:45-62` — dispatch semantics (the crux):

  ```js
  async function dispatchLanMutation(domain, patientId, payload) {
    if (!isActiveRef()) return;
    const handler = handlers.get(String(domain));
    if (handler) {
      try {
        await handler(patientId, payload);
      } catch (_err) {
        const kind = domainKinds.get(String(domain));
        if (kind) {
          const roomId = getActiveRoomIdRef();
          if (roomId) enqueueOutboxRef(roomId, { kind, payload: { patientId, data: payload } });
        }
      }
    } else {
      markUntypedDirtyRef(domain, patientId);
      scheduleUntypedSafety();
    }
  }
  ```

- `public/js/features/lan/orchestrator.mjs:1981-1985` (inside
  `wireLanSyncBridges`) — the stub to remove:

  ```js
  lanMutationRegistry.registerMutationHandler('patient-fields', async (pid, payload) => {
    void pid;
    void payload;
  });
  lanMutationRegistry.setDomainOutboxKind('patient-fields', 'patient_fields');
  ```

- `public/js/features/patients.mjs:1578-1582` — the only dispatch site
  (verified by `grep -rn "dispatchLanMutation('patient-fields'" public/js`),
  inside the delete flow that already does tombstone + `scheduleLiveSyncPush()`:

  ```js
  stagePatientDelete(id, snap, function () {
    import('../lan-mutation-registry.mjs').then(function (m) {
      m.lanMutationRegistry.dispatchLanMutation('patient-fields', id);
    });
  });
  ```

- `public/js/features/lan/push.mjs:577-579` — outbox drain case (KEEP — drains
  any `patient_fields` items already queued in a user's localStorage outbox
  from earlier sessions):

  ```js
  if (item.kind === 'patient_fields') {
    return pushTypedMutationToHost('/patients/' + encodeURIComponent(item.payload.patientId) + '/fields', item.payload);
  }
  ```

- Server: `PUT /patients/:id/fields` exists in `lan-squad/host-router.js`
  (KEEP — older clients may still call it).

- After removal, the dispatch at delete-time falls into the `else` branch:
  `markUntypedDirty('patient-fields', id)` + `scheduleUntypedSafety()`. That
  schedules the 30s safety bundle after a delete — harmless belt-and-braces
  (the bundle push already carries the delete; the safety bundle is built from
  current state which no longer contains the patient).

- Lint baseline: `orchestrator.mjs` has ~76 pre-existing eslint problems —
  record the count first; obligation is **no new problems**.
  `lan-mutation-registry.mjs` has 1; `patients.mjs` ~56; `push.mjs` ~34 — you
  should not need to touch the latter two at all.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test public/js/features/lan/orchestrator.test.mjs public/js/lan-mutation-registry.test.mjs public/js/features/lan/push.test.mjs` | `# fail 0` (check the registry test filename: `ls public/js/lan-mutation-registry.test.mjs`) |
| Dispatch-site grep | `grep -rn "dispatchLanMutation('patient-fields'" public/js --include='*.mjs' \| grep -v chunks` | exactly 1 hit (patients.mjs) before and after |
| Lint baseline | `npx eslint public/js/features/lan/orchestrator.mjs \| tail -1` | record count (~76) |
| Debt gate | `npm run metrics:check` | no `DEBT REGRESSION`; see done-criteria note |

## Scope

**In scope** (the only files you should modify):
- `public/js/features/lan/orchestrator.mjs` (remove 2 statements, add 1 comment)
- `public/js/features/lan/orchestrator.test.mjs` / the mutation-registry test —
  only if they pin the stub's existence
- `public/js/lan-mutation-registry.mjs` — comment only (optional, Step 3)

**Out of scope** (do NOT touch):
- `public/js/features/patients.mjs` — the dispatch call stays (it now does
  something honest).
- `public/js/features/lan/push.mjs` — the outbox drain case stays.
- `lan-squad/host-router.js` — the server endpoint stays.
- Implementing a real field-level push — explicitly rejected: patient field
  sync rides the versioned `PUT /patients/:id` path (`lanPushPatientVersioned`)
  and bundle pushes; a second field-sync channel would duplicate it.

## Git workflow

- Branch: `advisor/015-patient-fields-stub`
- Commit (conventional): `fix(lan): drop no-op patient-fields handler; restore untyped fallback`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the orchestrator lint baseline

**Verify**: `npx eslint public/js/features/lan/orchestrator.mjs | tail -1` →
note the count.

### Step 2: Remove the stub registration

Delete the `registerMutationHandler('patient-fields', …)` call and the
`setDomainOutboxKind('patient-fields', 'patient_fields')` line from
`wireLanSyncBridges` (orchestrator.mjs ~1981–1985). In their place leave a
short comment so the next reader knows this is deliberate:

```js
// 'patient-fields' has no typed handler on purpose: deletes propagate via
// tombstone + bundle push; dispatch falls back to the untyped safety bundle.
// The host PUT /patients/:id/fields endpoint remains for legacy outbox items.
```

**Verify**:
`grep -n "patient-fields" public/js/features/lan/orchestrator.mjs` → only the new comment;
`grep -n "patient_fields" public/js/features/lan/push.mjs` → drain case untouched.

### Step 3: Pin the fallback behavior with a test

Add a test (in the mutation-registry test file, using
`createMutationRegistry(deps)` which exists for isolated testing per the
file's JSDoc): dispatching a domain with **no** handler calls
`markUntypedDirty(domain, patientId)` and `scheduleUntypedSafetyBundle` —
and specifically that `'patient-fields'` is no longer a typed domain after
orchestrator wiring. For the second half, if the orchestrator characterization
suite has a wiring test that builds the registry, assert
`lanMutationRegistry.isTypedDomain('patient-fields') === false`; if no such
seam exists, the registry-level test alone is acceptable — note it.

**Verify**: `node --test public/js/lan-mutation-registry.test.mjs` (or the
actual registry test file) → `# fail 0`, including the new case.

### Step 4: Full targeted run

**Verify**: `node --test public/js/features/lan/orchestrator.test.mjs public/js/features/lan/push.test.mjs public/js/features/patients-clinical-filter.test.mjs` → `# fail 0`.
If `orchestrator.test.mjs` fails because a characterization test asserts the
stub registration exists, update that assertion to the new wiring (registry
without the typed domain) — that is the only sanctioned test edit.

## Test plan

- New: registry fallback test (Step 3) — proves removing a typed handler
  reroutes to `markUntypedDirty` + safety bundle.
- Updated: any orchestrator characterization assertion that pinned the stub.
- Pattern: existing cases in the mutation-registry test (isolated
  `createMutationRegistry` instances with spy deps).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "registerMutationHandler('patient-fields'" public/js --include='*.mjs' | grep -v chunks` → 0 matches.
- [ ] `grep -rn "setDomainOutboxKind('patient-fields'" public/js --include='*.mjs' | grep -v chunks` → 0 matches.
- [ ] Step 4 test command → `# fail 0`.
- [ ] `npx eslint public/js/features/lan/orchestrator.mjs | tail -1` → count ≤ Step 1 baseline.
- [ ] `npm run metrics:check` → no `DEBT REGRESSION` (its eslint pass may flag orchestrator's pre-existing problems; acceptable only with the baseline comparison — state it in your report).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- You find a second `dispatchLanMutation('patient-fields', …)` call site the
  audit grep missed — its intent must be understood before removal.
- The orchestrator characterization suite fails in a way not explained by the
  stub's absence.
- You feel the need to edit `push.mjs`, `patients.mjs`, or `host-router.js` —
  all three are deliberately untouched.

## Maintenance notes

- If field-level patient sync is ever actually needed, implement it as a real
  typed handler with a test proving the push reaches
  `PUT /patients/:id/fields` — never re-register a no-op (this plan exists
  because a no-op typed handler silently disables the safety net).
- Reviewer should scrutinize: the comment left in `wireLanSyncBridges` matches
  reality, and the registry test actually exercises the `else` fallback branch.
- The server endpoint + push.mjs drain case become removable once telemetry
  shows no legacy `patient_fields` outbox items in the wild — a future cleanup,
  not now.
