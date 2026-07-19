# Plan 004: Add failure-count lockout to LAN PIN exchange

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- lan-squad/auth-router.js server.js lan-squad/shift-pin-store.js lan-squad/ticket-store.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-ci-test-list-integrity.md
- **Category**: security
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

`POST /auth/exchange` converts a PIN into the team bearer token. The shift PIN is 6 decimal digits (≈900K possibilities) and stays valid for a calendar month. The only brute-force defense is `express-rate-limit` at 10 requests/minute keyed per IP — ~62 days to exhaust the space from one IP, much less from several, all within the PIN's lifetime. There is no per-PIN failure counter, no backoff, no lockout. A counter that pauses exchange after repeated failures makes brute force impractical at near-zero cost and without changing the PIN UX residents already know.

**Settled context**: plaintext LAN HTTP and the trusted-LAN posture are documented risk acceptances (`docs/core/15-security.md`); shift-PIN *reuse* (many residents exchanging the same monthly PIN) is by design. Do not change PIN length, PIN lifetime, or reuse semantics in this plan — only add failure lockout.

## Current state

- `lan-squad/auth-router.js:103-165` — `POST /auth/exchange` (no bearer required). Body decides the path: shift-PIN exchange calls `shiftPinStore.exchange(String(body.shiftPin).trim())` (line 125); ticket exchange calls `ticketStore.exchange({...})` (line 132). Successful exchanges audit via `auditLanSecurity('lan.shift_pin.exchange', {})` / `('lan.ticket.exchange', {})`. Errors are caught at line 162: `console.error('[auth/exchange]', redactAuthBody(body), e && e.message)` → 500.
- `server.js:291-295` — the rate limiter:

```js
const authExchangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  ...
});
```

- `lan-squad/shift-pin-store.js:152` — `exchange(pin)`; `lan-squad/ticket-store.js:55` — `exchange({ ticket, pin })`. Both return a falsy/err result on a bad PIN (read each function before Step 1 to learn the exact failure signaling — store result shape, thrown vs returned).
- Failed bearer auth already audits via `auditLanSecurity('lan.auth.fail', { reason: 'invalid_token' })` (`auth-router.js:31-33`) — follow that naming style.
- Tests: `lan-squad/auth-router.test.js` exists and shows how the router is mounted with fake stores; `lan-squad/shift-pin-store.test.js` exists (note: it is one of the orphaned files plan 001 adds to CI).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test lan-squad/auth-router.test.js lan-squad/shift-pin-store.test.js lan-squad/ticket-store.test.js` | `# fail 0` |
| Lint | `npx eslint lan-squad/auth-router.js lan-squad/auth-failure-lockout.js` | exit 0 |
| Debt gate | `npm run metrics:check` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `lan-squad/auth-failure-lockout.js` (create)
- `lan-squad/auth-failure-lockout.test.js` (create)
- `lan-squad/auth-router.js` (wire the lockout into `/auth/exchange`)
- `lan-squad/auth-router.test.js` (extend)
- `package.json` (add the new test file to `scripts.test`)

**Out of scope** (do NOT touch):
- PIN generation/length in `ticket-store.js` / `shift-pin-store.js` — UX decision, not yours.
- `server.js` rate limiters — they stay as a second layer.
- `bearer-auth.js`, token semantics, TLS — separate decisions (LATER horizon).

## Git workflow

- Branch: `advisor/004-shift-pin-lockout`
- Commit style: `fix(lan): failure-count lockout on PIN exchange`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the lockout module

Create `lan-squad/auth-failure-lockout.js` (CJS, `'use strict'`, factory style matching `createWriteQueue` in `write-queue.js`):

`createAuthFailureLockout({ maxFailures = 8, lockoutMs = 5 * 60 * 1000, windowMs = 10 * 60 * 1000, now = Date.now } = {})` returning:

- `isLockedOut()` → boolean (global, not per-IP — the host serves one ward; per-IP tracking invites spoofing and adds state for no benefit at this scale).
- `recordFailure()` → increments a counter of failures within `windowMs`; when it reaches `maxFailures`, sets a lockout until `now() + lockoutMs`.
- `recordSuccess()` → resets counter and lockout.
- `getStatus()` → `{ failures, lockedUntil }` for diagnostics.

Pure in-memory; inject `now` for tests (the repo's tests use injected clocks — see `shift-pin-store.test.js` for the pattern).

**Verify**: `node --test lan-squad/auth-failure-lockout.test.js` → `# fail 0` (write the tests in the same step; cases listed in Test plan).

### Step 2: Wire into `/auth/exchange`

In `lan-squad/auth-router.js`:

1. Instantiate one lockout in `createAuthRouter`'s closure (or accept an injected one via options for tests, defaulting to a real instance — match how `shiftPinStore` is injected).
2. At the top of the `/auth/exchange` handler: if `isLockedOut()`, respond `429 { error: 'too_many_attempts' }` and `auditLanSecurity('lan.auth.lockout', {})`.
3. Where an exchange **fails because the PIN/ticket is wrong** (determine the exact failure branch from reading both `exchange` implementations — wrong-PIN, not infrastructure errors): call `recordFailure()` and audit `auditLanSecurity('lan.auth.exchange_fail', {})` before sending the existing error response.
4. On successful exchange: `recordSuccess()`.

Infrastructure failures (store unavailable → current 503/500 paths) must **not** count as failures.

**Verify**: `node --test lan-squad/auth-router.test.js` → `# fail 0`.

### Step 3: Route tests + manifest

Extend `lan-squad/auth-router.test.js` (reuse its existing mounting helpers/fake stores):

1. 8 wrong-PIN exchanges → 9th attempt returns 429 even with the *correct* PIN.
2. After `lockoutMs` advances (injected clock), correct PIN succeeds again.
3. A successful exchange resets the failure counter (7 failures + 1 success + 7 failures → no lockout).

Add `lan-squad/auth-failure-lockout.test.js` to `scripts.test` in `package.json`.

**Verify**: `node --test lan-squad/auth-router.test.js lan-squad/auth-failure-lockout.test.js scripts/lib/test-manifest.test.mjs` → `# fail 0`.

## Test plan

- `lan-squad/auth-failure-lockout.test.js`: failures below threshold → not locked; threshold reached → locked; lock expires after `lockoutMs`; success resets; failures outside `windowMs` don't count. Model after `lan-squad/shift-pin-store.test.js` (injected `now`).
- Route-level cases in Step 3.

## Done criteria

- [ ] 9th attempt after 8 wrong PINs → 429 (route test proves it)
- [ ] `node --test lan-squad/auth-router.test.js lan-squad/auth-failure-lockout.test.js lan-squad/shift-pin-store.test.js lan-squad/ticket-store.test.js` → `# fail 0`
- [ ] `npx eslint lan-squad/auth-failure-lockout.js lan-squad/auth-router.js` → exit 0
- [ ] `npm run metrics:check` → exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `shiftPinStore.exchange` / `ticketStore.exchange` failure signaling is ambiguous (e.g. same return for "wrong PIN" and "store error") — miscounting infrastructure errors as attacks would lock out a whole ward; a human must decide.
- `auth-router.js` has drifted from the excerpts.
- Existing auth-router tests fail for reasons unrelated to the lockout.

## Maintenance notes

- The lockout is global and in-memory: a host restart clears it. That is acceptable (restart requires host-machine access) — do not persist it.
- If legitimate users ever hit the lockout in practice (e.g. a ward of typo-prone juniors at shift change), tune `maxFailures`/`lockoutMs` in one place; both are factory options.
- Reviewer should scrutinize: which store-failure branches count as `recordFailure()` — only wrong-credential branches may count.
