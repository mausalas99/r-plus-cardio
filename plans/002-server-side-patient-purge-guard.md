# Plan 002: Enforce the patient-purge ownership guard on the host server, not just in the renderer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- lan-squad/host-router.js lan-squad/host-store.js lan-squad/host-router.test.js public/js/features/lan/orchestrator.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-ci-test-list-integrity.md
- **Category**: security
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

`DELETE /api/lan/v1/patients/:id` on the LAN host permanently purges a patient from the host census (tombstones the patient row and strips them from every room bundle; the tombstone then propagates to all clients via LWW sync). The "owned by another client" guard that is supposed to restrict purges to admins and orphaned rows exists **only in the renderer** (`public/js/features/lan/host-patients-annotate.mjs`), and the renderer caller even has a `force` flag that bypasses it. Server-side, any device that joined the LAN room with a PIN can delete any patient. For a medical census this is the worst class of bug: silent, propagating data destruction available to every guest. This plan replicates the same ownership rule on the host route.

**Architectural constraint (read carefully)**: LAN auth uses a single shared team-code bearer token — `lan-squad/bearer-auth.js` verifies the token against `teamCodeHash` and nothing else. The server has **no cryptographic per-client identity**; clients self-report a `clientId`. The guard you add therefore protects against accidental and buggy-client deletions (the realistic failure mode on a trusted hospital LAN), not against a malicious client lying about its `clientId`. That is the accepted posture: per-client credentials / RBAC are an explicit LATER-horizon item in `docs/core/01-vision-north-star.md` ("Institutional readiness — RBAC, TLS on LAN"). Do not attempt to build per-client auth in this plan.

## Current state

- `lan-squad/host-router.js:109-121` — the unguarded route:

```js
r.delete('/patients/:id', (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const registro = String(req.query.registro || '').trim();
    if (!id) return res.status(400).json({ error: 'patient_id_required' });
    const purged = store.purgePatientFromHostCensus(id, registro);
    if (!purged) return res.status(404).json({ error: 'patient_not_found' });
    broadcast('sync', { type: 'patients-updated' });
    res.json({ ok: true, patientId: id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
```

- `lan-squad/host-store.js:1249` — `purgePatientFromHostCensus(patientId, registro, opts)`: finds the live patient row by id; if found, writes a `_deleted: true` tombstone via `setEntity`; otherwise falls through to `purgePatientFromAllRoomBundles(state, pid, reg, opts)` which strips matching entries from every room bundle.
- `public/js/features/lan/host-patients-annotate.mjs:4-23` — the renderer-side rule to replicate. Ownership = the `clientId` of the first `audit_log` entry with `action === 'patient.create'` on the host row:

```js
export function resolveHostPatientOwnerClientId(row) {
  const audit = Array.isArray(row?.audit_log) ? row.audit_log : [];
  const createEntry = audit.find(function (e) { return e && e.action === 'patient.create'; }) || null;
  return String(createEntry?.clientId || '').trim();
}
export function isHostPatientOwnedByOtherClient(row, localClientId) {
  const local = String(localClientId || '').trim();
  const ownerClientId = resolveHostPatientOwnerClientId(row);
  if (!local || !ownerClientId || ownerClientId === 'host') return false;
  return ownerClientId !== local;
}
```

- `public/js/features/lan/orchestrator.mjs:995-1024` — renderer caller `purgeLanPatientFromHost(patientId, opts)`: checks `isHostPatientOwnedByOtherClient(censusRow, getLanClientId())` unless `opts.force`, then issues the DELETE via `pushPatientDeleteToHost(pid, hostRow, snap.registro)`. Find `pushPatientDeleteToHost` in the same file to see the exact request it sends (currently no client identity is sent on the DELETE).
- Patient rows on the host carry `audit_log` arrays (see `appendAudit` usage in `lan-squad/host-store.js`), so the server can evaluate the same rule.
- The recent changelog entry for this area (`.cursor/rules/project-context.mdc`, entry `lan-purge-hardening`, 2026-06-11) states the intended policy: "purga solo admin/huérfanos" — purge only for admins or orphaned rows.
- Conventions: `lan-squad/` is CommonJS, `'use strict'`, plain Express routers. Route tests build a real Express app + real `createHostStore` against a temp dir — see exemplar `lan-squad/host-router.test.js:1-40` (uses `node:test`, `assert`, `bearerHeaders(token)` helper, `mountLanRouter(store, ...)`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test lan-squad/host-router.test.js lan-squad/host-store.test.js` | `# fail 0` |
| Renderer tests | `node --test public/js/lan-patient-merge.test.mjs public/js/features/lan/lan-patient-delete.test.mjs` | `# fail 0` |
| Lint | `npx eslint lan-squad/host-router.js lan-squad/host-store.js` | exit 0 |
| Bundle check (renderer touched) | `npm run build:ui` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `lan-squad/host-router.js` — the DELETE route
- `lan-squad/host-store.js` — only if you add a small ownership helper there (preferred: new shared module below)
- `lan-squad/host-patient-ownership.js` (create) — server-side copy of the ownership rule
- `lan-squad/host-patient-ownership.test.js` (create)
- `lan-squad/host-router.test.js` — new route tests
- `public/js/features/lan/orchestrator.mjs` — only the `pushPatientDeleteToHost` request, to send `clientId` and handle the new 403
- `package.json` — add the new test file to `scripts.test` (required by the guard from plan 001)

**Out of scope** (do NOT touch):
- `lan-squad/bearer-auth.js`, `auth-router.js`, `ticket-store.js`, `shift-pin-store.js` — no auth-model changes; per-client identity is a LATER-horizon decision.
- `public/js/features/lan/host-patients-annotate.mjs` — the renderer rule stays as-is (it gives fast UX feedback before the network call).
- The other `/patients/:id/*` PUT routes — they merge rather than destroy; widening scope risks breaking sync.

## Git workflow

- Branch: `advisor/002-server-purge-guard`
- Commit style: conventional commits, e.g. `fix(lan): enforce purge ownership guard server-side`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the server-side ownership module

Create `lan-squad/host-patient-ownership.js` (CJS) exporting `resolveHostPatientOwnerClientId(row)` and `isHostPatientOwnedByOtherClient(row, requesterClientId)` with logic **identical** to the renderer excerpts above. Add a JSDoc note: "Mirror of public/js/features/lan/host-patients-annotate.mjs — keep both in sync; clientId is client-asserted (no per-client auth on LAN yet)."

Create `lan-squad/host-patient-ownership.test.js` covering: no audit log → not owned; owner `'host'` → not owned; same clientId → not owned; different clientId → owned; missing requester id → not owned.

**Verify**: `node --test lan-squad/host-patient-ownership.test.js` → `# fail 0`.

### Step 2: Enforce the guard in the DELETE route

In `lan-squad/host-router.js`, before calling `store.purgePatientFromHostCensus`:

1. Read the requester identity from `req.query.clientId` (string, trimmed) and an admin claim from `req.query.isProgramAdmin === '1'`.
2. Look up the live host row for the id (the store exposes state via `store.getState().patients`; match by `id`, skip `_deleted` rows — same shape as the existing `GET /patients` route at `host-router.js:103-106`).
3. If a live row exists, the requester is **not** admin, and `isHostPatientOwnedByOtherClient(row, clientId)` is true → respond `403 { error: 'owned_by_other_client' }` and do not purge.
4. If no live row exists (bundle-only orphan purge) or the guard passes → proceed exactly as today.
5. On a blocked attempt, append to the existing LAN security audit if available in this router's closure (`auditLanSecurity` is the convention in `auth-router.js`; if it is not already injected into `createLanRouter`, log with `console.warn('[lan] purge blocked', ...)` instead — do **not** rewire constructor signatures for logging).

Missing `clientId` on a request targeting a live row owned by a real client (`ownerClientId` set and ≠ `'host'`): treat as blocked (403). Old clients that never send `clientId` can still purge orphans/bundle-only rows, which is their main legitimate use.

**Verify**: `node --test lan-squad/host-router.test.js` → existing tests still pass (none currently exercise DELETE with ownership, but they cover surrounding routes).

### Step 3: Add route tests for the guard

In `lan-squad/host-router.test.js`, following the existing `mountLanRouter` + `bearerHeaders` pattern, add:

1. Patient created with an `audit_log` containing `{ action: 'patient.create', clientId: 'client-A' }`; DELETE with `?clientId=client-B` → 403, patient still in `GET /patients`.
2. Same setup; DELETE with `?clientId=client-A` → 200, patient gone.
3. Same setup; DELETE with `?clientId=client-B&isProgramAdmin=1` → 200.
4. Row with no `patient.create` audit entry (orphan); DELETE with any/no clientId → 200.
5. No live row, registro-only bundle purge → unchanged behavior (200/404 as today).

**Verify**: `node --test lan-squad/host-router.test.js lan-squad/host-patient-ownership.test.js` → `# fail 0`.

### Step 4: Send identity from the renderer and handle 403

In `public/js/features/lan/orchestrator.mjs`, find `pushPatientDeleteToHost` and append `clientId=<getLanClientId()>` (URL-encoded) to the DELETE URL's query string; if the local user is program admin (the renderer already knows this — see how `purgeLanPatientFromHost`/host-patients-dashboard determine admin; reuse that source), also send `isProgramAdmin=1`. Map a 403 `owned_by_other_client` response to the same `{ ok: false, error: 'owned_by_other_client', skipped: true }` shape the client guard already returns at `orchestrator.mjs:1007-1009`, so existing callers need no changes.

**Verify**: `node --test public/js/features/lan/lan-patient-delete.test.mjs public/js/lan-patient-merge.test.mjs` → `# fail 0`; `npm run build:ui` → exit 0.

### Step 5: Register new test file

Add `lan-squad/host-patient-ownership.test.js` to `scripts.test` in `package.json`.

**Verify**: `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0` (guard from plan 001).

## Test plan

- New unit tests: `lan-squad/host-patient-ownership.test.js` (5 cases, Step 1).
- New route tests: 5 cases in `lan-squad/host-router.test.js` (Step 3) — model after the existing tests in that file (real store in temp dir, real Express app).
- Verification: `node --test lan-squad/host-router.test.js lan-squad/host-patient-ownership.test.js lan-squad/host-store.test.js` → all pass.

## Done criteria

- [ ] DELETE on a live row owned by another client without admin claim → 403 (proven by route test)
- [ ] Admin and owner purges still succeed; orphan/bundle-only purges unchanged (route tests)
- [ ] `node --test lan-squad/host-router.test.js lan-squad/host-patient-ownership.test.js public/js/features/lan/lan-patient-delete.test.mjs` → `# fail 0`
- [ ] `npx eslint lan-squad/host-router.js lan-squad/host-patient-ownership.js` → exit 0
- [ ] `npm run metrics:check` → exit 0 (no debt regression)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The DELETE route or `purgePatientFromHostCensus` no longer matches the excerpts (plan 003 also touches `host-store.js` — coordinate via `plans/README.md` ordering).
- Host patient rows in route tests do **not** carry `audit_log` arrays with `patient.create` entries — the ownership rule's data source would be wrong, and the right fix needs a human decision.
- `pushPatientDeleteToHost` turns out to route through a code path that cannot attach query params without breaking other callers.
- You find yourself wanting to add per-client tokens or touch `bearer-auth.js` — out of scope by decision.

## Maintenance notes

- The ownership rule now lives in two places (renderer + `lan-squad/host-patient-ownership.js`) because the renderer is ESM/browser and `lan-squad` is CJS/node and they do not share modules today. If a shared `lib/` location for isomorphic LAN helpers ever appears, merge them.
- When per-client auth (LATER horizon) lands, replace the client-asserted `clientId`/`isProgramAdmin` query params with the authenticated identity — grep for the JSDoc marker added in Step 1.
- Reviewer should scrutinize: the 403 path does not regress the legitimate "purge orphaned/bundle-only ghosts" flow used by the host dashboard (`host-patients-dashboard.mjs:301-332` relies on purging ghost rows).
