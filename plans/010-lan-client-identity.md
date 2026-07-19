# Plan 010: Server-issued per-client identity for LAN — stop trusting `clientId`/`isProgramAdmin` from the query string

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- lan-squad/auth-router.js lan-squad/host-router.js lan-squad/host-patient-ownership.js server.js public/js/features/lan/transport.mjs public/js/features/lan/orchestrator.mjs public/js/lan-shift-pin-connect.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (auth flow on a live ward; every change here ships with a legacy fallback so mixed-version wards keep working)
- **Depends on**: none. **Plan 014 edits `host-router.js` too — run 010 first, 014 after.**
- **Category**: security
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

All LAN clients authenticate with the **same shared team bearer** — both
exchange paths return `getHostToken()` verbatim (`ticket-store.js:77`,
`shift-pin-store.js:158`), and `bearer-auth.js` verifies the token against the
single `teamCodeHash`. So when plan 002 added the server-side patient-purge
ownership guard, the only identity available was **client-asserted**: the
DELETE route reads `clientId` and `isProgramAdmin=1` straight from the query
string. `host-patient-ownership.js` documents it honestly: *"clientId is
client-asserted (no per-client auth on LAN yet)"*.

Consequences today: any authenticated ward client can purge another team's
patients by sending `isProgramAdmin=1` (or another client's `clientId`), and
every `clientId` recorded in the audit log is unverifiable. This plan adds the
minimal server-issued identity: the host mints a per-client token at exchange,
binds it to the client's declared `clientId`, and the purge guard prefers the
**server-resolved** identity over query parameters. It is also the explicit
groundwork for the RBAC LATER-horizon item
(`docs/superpowers/specs/2026-05-30-r-plus-security-architecture-remediation-design.md`,
Phase 3 "User Attribution").

**Honest boundary** (state this in the commit): `clientId` is still
*self-declared once* at exchange time, and `isProgramAdmin` remains an
assertion (verified rank/role needs RBAC). What this plan removes is *silent
per-request impersonation* — identity gets pinned at exchange, resolved
server-side thereafter, and legacy unpinned requests are audited.

## Current state

- `lan-squad/host-router.js:110-129` — the DELETE route (the consumer):

  ```js
  r.delete('/patients/:id', (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const registro = String(req.query.registro || '').trim();
      const clientId = String(req.query.clientId || '').trim();
      const isProgramAdmin = req.query.isProgramAdmin === '1';
      if (!id) return res.status(400).json({ error: 'patient_id_required' });
      const guard = evaluateHostPatientPurgeGuard(store, id, clientId, isProgramAdmin);
      if (guard.blocked) {
        console.warn('[lan] purge blocked', guard);
        return res.status(403).json({ error: 'owned_by_other_client' });
      }
      ...
  ```

  The router factory is `createLanRouter({...})` (`lan-squad/host-router.js`),
  wired in `server.js:340`.

- `lan-squad/auth-router.js:105-178` — `POST /auth/exchange`: validates
  exactly one of `ticket|pin|shiftPin`, exchanges via `ticketStore.exchange`
  or `shiftPinStore.exchange` (both return `{ token: getHostToken() }`),
  then responds:

  ```js
  res.json({
    token: result.token,
    hostUrl,
    persist: true,
    storageTarget: 'userData',
    ...(wardHostHints ? { wardHostHints } : {}),
  });
  ```

  Factory `createAuthRouter({ ticketStore, shiftPinStore, wardHostRegistry, getHostToken, getHostUrl, getRequiresMigrationNotice })`,
  wired in `server.js:307-314`. Body redaction for logs:
  `redactAuthBody` (see `lan-squad/redact-secrets.js` — the new field must be
  covered, Step 2).

- `lan-squad/host-patient-ownership.js` — pure guard functions
  (`evaluateHostPatientPurgeGuard(store, patientId, clientId, isProgramAdmin)`);
  no change needed here — identity *resolution* improves upstream. Header
  comment must be updated (Step 4).

- Renderer, client id source — `public/js/features/lan/runtime.mjs:118-128`:

  ```js
  export function getLanClientId() {
    try {
      var id = localStorage.getItem('rpc-lan-client-id');
      if (id && String(id).trim()) return String(id).trim();
      var gen = 'lc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('rpc-lan-client-id', gen);
      return gen;
    } catch (_e) { return 'lc_anon'; }
  }
  ```

- Renderer, exchange call sites (both must send `clientId` and store the
  returned `clientToken`):
  - `public/js/features/lan/transport.mjs:475` — ticket/join path; response
    handled at ~501 via `persistGuestBearerFromExchange(data)`.
  - `public/js/lan-shift-pin-connect.mjs:83` — shift-PIN path
    (`body: JSON.stringify({ shiftPin: pin })`), response → `persistShiftPinBearer(data)`.

- Renderer, authenticated fetch chokepoint —
  `public/js/features/lan/transport.mjs:301`:

  ```js
  export async function lanFetchAuthed(path, opts) {
    await ensureLanClientTeamCodeAligned();
    var resp = await lanClient.fetch(path, opts);
    if (resp.status !== 401) return resp;
    ...
  ```

- Renderer, the purge sender — `public/js/features/lan/orchestrator.mjs:938-965`
  (`lanDeleteHostPatientCensus`) builds the query params (`registro`,
  `clientId`, `isProgramAdmin`) and calls `lanFetchAuthed(..., { method: 'DELETE' })`.
  Keep the query params (legacy fallback for older hosts); the header is added
  centrally in `lanFetchAuthed`.

- Tests that pin this area: `lan-squad/auth-router.test.js`,
  `lan-squad/host-router.test.js`, `lan-squad/host-patient-ownership.test.js`,
  `lan-squad/ticket-store.test.js`, `public/js/features/lan/transport.test.mjs`,
  `public/js/features/lan/orchestrator.test.mjs`.

- Lint baselines (record before starting; "no new problems" rule):
  `auth-router.js` ~5, `host-router.js` ~2 (fix both files' pre-existing
  issues — they are small and in scope), `transport.mjs` ~67 and
  `orchestrator.mjs` ~76 (baseline-compare only).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Server-side suites | `node --test lan-squad/auth-router.test.js lan-squad/host-router.test.js lan-squad/host-patient-ownership.test.js lan-squad/client-identity-store.test.js` | `# fail 0` |
| Renderer suites | `node --test public/js/features/lan/transport.test.mjs public/js/features/lan/orchestrator.test.mjs public/js/lan-shift-pin-connect.test.mjs` | `# fail 0` |
| Redaction suite | `node --test lan-squad/redact-secrets.test.js` | `# fail 0` |
| Bundle | `npm run build:ui` | exit 0 |
| Lint (small files to leave clean) | `npx eslint lan-squad/auth-router.js lan-squad/host-router.js lan-squad/client-identity-store.js` | 0 problems |
| Debt gate | `npm run metrics:check` | no `DEBT REGRESSION`; see done-criteria note |

No SQLCipher natives needed for these suites.

## Scope

**In scope** (the only files you should modify):
- New: `lan-squad/client-identity-store.js` + `lan-squad/client-identity-store.test.js`
- `lan-squad/auth-router.js`, `lan-squad/host-router.js`, `server.js`
- `lan-squad/redact-secrets.js` — only if Step 2's check shows `clientToken`
  is not already masked by its patterns
- `lan-squad/host-patient-ownership.js` — header comment only
- `public/js/features/lan/transport.mjs`, `public/js/lan-shift-pin-connect.mjs`
- `public/js/features/lan/orchestrator.mjs` — no logic change expected; only
  if its characterization tests need the new header in a fixture
- Test files of all of the above

**Out of scope** (do NOT touch):
- `lan-squad/bearer-auth.js`, `team-code.js`, `ticket-store.js`,
  `shift-pin-store.js` — the shared team bearer mechanism is unchanged.
- `public/js/features/lan/runtime.mjs` (`getLanClientId` stays as-is).
- Any RBAC/role verification — explicitly LATER-horizon.
- Mobile clients (`public/interno/`, `/mobile/`) — they don't purge patients;
  they simply won't send the header (legacy path).

## Git workflow

- Branch: `advisor/010-lan-client-identity`
- Commits (conventional): `feat(lan): per-client identity tokens at exchange`,
  `fix(lan): purge guard prefers server-resolved client identity`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `lan-squad/client-identity-store.js`

New CJS module, factory pattern (model after `createTicketStore` in
`lan-squad/ticket-store.js` — same file layout, `crypto.randomBytes`, sweep):

```js
'use strict';
const crypto = require('crypto');

const TTL_MS = 36 * 60 * 60 * 1000; // outlives any shift; in-memory only

function createClientIdentityStore({ now = Date.now } = {}) {
  const byToken = new Map(); // token -> { clientId, mintedAt }

  function sweep() { /* drop entries older than TTL_MS */ }

  /** Mint a token bound to the client-declared id. Multiple tokens per clientId are fine (multi-exchange). */
  function issue(clientId) {
    sweep();
    const id = String(clientId || '').trim();
    if (!/^[\w.-]{4,64}$/.test(id)) return null;
    const token = 'cit_' + crypto.randomBytes(16).toString('hex');
    byToken.set(token, { clientId: id, mintedAt: now() });
    return token;
  }

  /** @returns bound clientId or '' */
  function resolve(token) { sweep(); const rec = byToken.get(String(token || '')); return rec ? rec.clientId : ''; }

  return { issue, resolve, sweep };
}

module.exports = { createClientIdentityStore, TTL_MS };
```

In-memory is deliberate (host restart clears it; requests then fall to the
audited legacy path and clients re-pin on next exchange — same posture as the
plan-004 lockout). Write `lan-squad/client-identity-store.test.js` modeled on
`ticket-store.test.js`: issue/resolve roundtrip, bad-id rejection (`null`),
unknown-token → `''`, TTL sweep (inject `now`).

**Verify**: `node --test lan-squad/client-identity-store.test.js` → `# fail 0`;
`npx eslint lan-squad/client-identity-store.js` → 0 problems.

### Step 2: Mint at exchange (`auth-router.js` + `server.js`)

1. `server.js`: `const { createClientIdentityStore } = require('./lan-squad/client-identity-store.js');`
   create one instance near the other stores (~line 184), pass it into BOTH
   `createAuthRouter({ ..., clientIdentityStore })` (line ~307) and
   `createLanRouter({ ..., clientIdentityStore })` (line ~340).
2. `auth-router.js`: accept `clientIdentityStore` in the factory params. In
   the exchange success path (after `recordSuccess()`, before `res.json`),
   read `body.clientId`; if present and the store is provided:

   ```js
   const clientToken = body.clientId != null ? clientIdentityStore.issue(body.clientId) : null;
   ```

   Add `...(clientToken ? { clientToken } : {})` to the response JSON. No
   `clientId` in the body → response unchanged (old clients unaffected).
3. Redaction check: `grep -n "token" lan-squad/redact-secrets.js` — confirm its
   masking covers a `clientToken` field in logged bodies/objects (the exchange
   error path logs `redactAuthBody(body)`; the *request* body has no token, but
   be sure nothing logs the response). If not covered, add the field to the
   redaction patterns + a case in `redact-secrets.test.js`.

**Verify**: `node --test lan-squad/auth-router.test.js lan-squad/redact-secrets.test.js`
→ `# fail 0` plus your new cases: exchange with `clientId` returns a
`cit_`-prefixed `clientToken`; exchange without it returns no such field;
exchange with a malformed `clientId` (e.g. 200 chars) returns no token (issue
returned null) and still succeeds.

### Step 3: Resolve at the purge guard (`host-router.js`)

Accept `clientIdentityStore` in `createLanRouter` params. In the DELETE route,
replace the identity block:

```js
const headerToken = String(req.get('x-client-token') || '').trim();
const boundClientId = headerToken && clientIdentityStore
  ? clientIdentityStore.resolve(headerToken) : '';
const queryClientId = String(req.query.clientId || '').trim();
const clientId = boundClientId || queryClientId;
const isProgramAdmin = req.query.isProgramAdmin === '1';
if (boundClientId && queryClientId && boundClientId !== queryClientId) {
  console.warn('[lan] purge identity mismatch', { boundClientId, queryClientId });
}
if (!boundClientId) {
  console.warn('[lan] purge using legacy client-asserted identity', { queryClientId });
}
```

Pass `clientId` into `evaluateHostPatientPurgeGuard` as before. The
`boundClientId || queryClientId` fallback keeps mixed-version wards working;
the warn lines make legacy use observable. (If the router has an audit helper
in scope, use it alongside the warns — check how the route's existing
`console.warn('[lan] purge blocked', …)` neighbors do it and match.)

**Verify**: `node --test lan-squad/host-router.test.js` → `# fail 0` plus new
cases (Step 6).

### Step 4: Update the ownership-module comment

`lan-squad/host-patient-ownership.js:3-6` header: replace "clientId is
client-asserted (no per-client auth on LAN yet)" with a sentence reflecting
the new reality: bound via `X-Client-Token` when available (plan 010), query
fallback audited, `isProgramAdmin` still an assertion pending RBAC. Mirror
note: the comment also says to keep `public/js/features/lan/host-patients-annotate.mjs`
in sync — update that file's mirror comment identically (comment-only edit).

### Step 5: Renderer — send `clientId`, store and attach the token

1. `transport.mjs:475` exchange body → `JSON.stringify({ ticket: tid, clientId: getLanClientId() })`
   (import `getLanClientId` from `./runtime.mjs` — check transport's existing
   imports; if a cycle appears, read how transport already gets runtime values
   and match it).
2. In the response handling (`persistGuestBearerFromExchange(data)` call site
   ~501): `if (data.clientToken) localStorage.setItem('rpc-lan-client-token', String(data.clientToken));`
   — wrap in try/catch like neighboring storage writes.
3. `lan-shift-pin-connect.mjs:83`: body → `{ shiftPin: pin, clientId: ... }`;
   it cannot import from `features/lan/runtime.mjs`? Check its imports — if
   importing `getLanClientId` there creates a load-order problem, read
   `localStorage.getItem('rpc-lan-client-id')` directly with the same
   fallback-to-nothing behavior (send no clientId when absent), and say so in
   the commit. Store `data.clientToken` next to where `persistShiftPinBearer`
   handles `data`.
4. `lanFetchAuthed` (`transport.mjs:301`): attach the header on every call:

   ```js
   var ct = '';
   try { ct = localStorage.getItem('rpc-lan-client-token') || ''; } catch (_e) {}
   if (ct) {
     opts = opts || {};
     opts.headers = Object.assign({}, opts.headers, { 'X-Client-Token': ct });
   }
   ```

   (Before the first `lanClient.fetch(path, opts)`; the 401-retry second fetch
   reuses the same `opts`.)

**Verify**: `npm run build:ui` → exit 0;
`node --test public/js/features/lan/transport.test.mjs public/js/lan-shift-pin-connect.test.mjs` → `# fail 0`
plus new cases: exchange body contains `clientId`; `lanFetchAuthed` adds the
header when the localStorage key is set and omits it otherwise (the transport
characterization suite shows how `lanClient`/localStorage are faked — model on it).

### Step 6: Server-side regression cases (the point of the plan)

Add to `lan-squad/host-router.test.js` (model after the existing DELETE/purge
cases from plan 002):

1. Row owned by `clientA` (audit_log `patient.create` with `clientId: 'clientA'`):
   DELETE with `X-Client-Token` bound to `clientB` + query `clientId=clientA`
   (spoof attempt) → **403** (bound identity wins over query).
2. Same row: DELETE with token bound to `clientA` → 200, row purged.
3. Same row: DELETE with **no** header, query `clientId=clientA` (legacy path)
   → 200 (fallback works; warn emitted).
4. Unknown/garbage `X-Client-Token` + query `clientId=clientA` → resolve
   returns `''`, falls back to query → 200 with legacy warn (graceful host-restart behavior).

**Verify**: `node --test lan-squad/host-router.test.js` → `# fail 0` including
the four new cases.

## Test plan

- New unit suite: `client-identity-store.test.js` (Step 1).
- New cases in `auth-router.test.js` (Step 2), `host-router.test.js` (Step 6),
  `transport.test.mjs` + `lan-shift-pin-connect.test.mjs` (Step 5).
- Patterns: `ticket-store.test.js` for the store;
  plan-002's purge-guard cases in `host-router.test.js` for the routes;
  the plan-008 characterization style for renderer fakes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] All suites in "Commands" table → `# fail 0`, including the 4 Step 6 cases.
- [ ] `npm run build:ui` → exit 0.
- [ ] `npx eslint lan-squad/auth-router.js lan-squad/host-router.js lan-squad/client-identity-store.js` → 0 problems (the ~7 pre-existing issues in the two routers fixed as part of touching them).
- [ ] `npx eslint public/js/features/lan/transport.mjs | tail -1` and `... orchestrator.mjs | tail -1` → ≤ recorded baselines (~67 / ~76).
- [ ] `npm run metrics:check` → no `DEBT REGRESSION` (its eslint pass may flag transport/orchestrator pre-existing problems; acceptable only with the baseline comparison — state it in your report).
- [ ] `grep -n "client-asserted" lan-squad/host-patient-ownership.js` → 0 matches (comment updated).
- [ ] No secret values in any committed file (tokens in tests are obvious fakes).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `redact-secrets.js` masking cannot cover `clientToken` without restructuring
  it (report what its patterns actually match).
- Importing `getLanClientId` into `transport.mjs` creates an import cycle that
  the existing structure can't absorb (check `app-boot-imports.test.mjs`).
- The transport/orchestrator characterization suites fail in a way not
  explained by the new header/body field.
- You are tempted to make the header mandatory (rejecting legacy requests) —
  that is a future flip, explicitly NOT this plan (mixed-version wards exist
  during rollout).
- Anything requires touching `bearer-auth.js` or the team-code mechanism.

## Maintenance notes

- **Follow-up flip (one release later)**: once the ward fleet is updated,
  reject purges with neither header nor matching legacy identity, and stop
  honoring `isProgramAdmin` without a bound token. Watch host logs for the
  `legacy client-asserted identity` warn rate to time it.
- This store is THE seam for RBAC Phase 3 (remediation spec): role claims
  attach to the identity record at exchange; `resolve()` grows a role field.
  Don't build a second identity mechanism next to it.
- Reviewer should scrutinize: the header is attached in exactly one renderer
  place (`lanFetchAuthed`); exchange responses without `clientId` are
  byte-identical to before (old-client compatibility); no token value ever
  reaches a log line.
- The plan-002 ownership guard semantics (`shouldBlockHostPatientPurge`) are
  intentionally untouched — only the *provenance* of `clientId` improved.
