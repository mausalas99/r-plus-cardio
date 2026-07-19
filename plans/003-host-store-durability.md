# Plan 003: Make LAN host persistence failures visible and flush the store on quit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- lan-squad/host-store.js lan-squad/persistence/commit-barrier.js main.js server.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-ci-test-list-integrity.md; execute **after** plans/002 (same files)
- **Category**: bug
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

The LAN host holds the team's shared patient census in memory and persists it through a write queue + commit barrier. Three gaps mean clinical data can be lost **silently**:

1. Every fire-and-forget persist ends in `.catch(() => {})` — a full disk, a locked SQLCipher DB, or an I/O error during flush produces *no log line and no user-visible signal*. Clients keep seeing the in-memory state and believe it is durable.
2. Quitting the app never flushes the host store: the Electron `before-quit` handler only closes the HTTP server. Writes coalescing in the 150 ms commit barrier window (plus anything queued behind them) are dropped on quit.
3. `putRoomClinicalOps` mutates the in-memory bundle (merge + revision bump) *before* awaiting the SQLCipher merge; if that merge throws, memory and DB diverge and a restart silently reverts the clinical roster.

This is the highest-impact correctness work in the audit: the failure mode is "a resident's census update disappears with no error anywhere".

## Current state

- `lan-squad/write-queue.js` (13 lines, whole file) — `enqueue(fn)` returns the un-swallowed promise `run`; the internal `chain = run.catch(() => {})` exists only to keep the queue alive. **The queue itself is fine.** The problem is the call sites.
- `lan-squad/host-store.js` — call sites that bury errors, e.g. lines 192–217 in `persistAlignedTeamCodeHash`:

```js
queue.enqueue(() => flushCacheToDiskFn()).catch(() => {});   // :192
queue.enqueue(() => persistCacheToDb()).catch(() => {});     // :195
queue.enqueue(() => writeJsonAtomic(...)).catch(() => {});   // :210, :217
```

  Search the file for `.catch(() => {})` — there are more (≈ lines 192, 195, 210, 217, and others). Each one needs a logging handler, not silence.
- `lan-squad/persistence/commit-barrier.js:69-75` — the timer-driven flush also swallows:

```js
function armTimer() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void executeFlush().catch(() => {});
  }, coalesceMs);
}
```

  Note: `executeFlush` settles waiters with the error *before* rethrowing (`commit-barrier.js:55-57`), so awaited paths (`flushNow`, `scheduleFlush` waiters) do see failures. Only the timer path and the host-store call sites are blind.
- `lan-squad/host-store.js:424-427` — `schedulePersist()` returns `commitBarrier.scheduleFlush(() => queue.enqueue(() => flushCacheToDisk()))`; callers invoke it as `void schedulePersist()` throughout the file.
- `main.js:1107-1111` — quit path:

```js
app.on('before-quit', () => {
  lanNetworkWatch.stop();
  const lanServer = require('./server');
  void lanServer.stopLanServer();
});
```

- `server.js:449-463` — `stopLanServer()` only closes the HTTP server; it has no reference to the host store flush. Find where `server.js` creates the host store (search `createHostStore(`) to see what handle is available for flushing; `host-store.js` already exposes `flushCacheNow({ serialized })` (line 432) and `awaitDurableCommit()` (line 429).
- `lan-squad/host-store.js:1102-1138` — `putRoomClinicalOps`: merges `bundle.clinicalOps` (lines 1108–1112), bumps `bundle.revision`/`entityVersions` (1114–1119), appends audit (1122–1130), and only **then** awaits `mergeBundleClinicalOpsIntoHostDb` (1133). A throw there propagates to the route (client sees 500) but the in-memory bundle keeps the merged state + bumped revision while the DB does not.
- Logging convention in `lan-squad/`: `console.error('[auth/exchange]', ...)` style — bracketed tag + message (see `auth-router.js:162`). There is also a LAN security audit (`auditLanSecurity`) but it is auth-scoped; use `console.error` here.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test lan-squad/host-store.test.js lan-squad/write-queue.test.js lan-squad/persistence/commit-barrier.test.js` | `# fail 0` |
| Clinical-ops merge tests | `node --test lan-squad/host-store-clinical-ops-db.test.js` | `# fail 0` |
| Lint | `npx eslint lan-squad/host-store.js lan-squad/persistence/commit-barrier.js` | exit 0 |
| Debt gate | `npm run metrics:check` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `lan-squad/host-store.js`
- `lan-squad/persistence/commit-barrier.js`
- `server.js` (export a flush hook from the LAN server)
- `main.js` (await the flush in `before-quit`)
- `lan-squad/host-store.test.js`, `lan-squad/persistence/commit-barrier.test.js` (extend)

**Out of scope** (do NOT touch):
- `lan-squad/write-queue.js` — its contract (return un-swallowed promise) is correct; changing it churns every consumer.
- Retry logic, persistence-mode changes, or anything under `lan-squad/persistence/sharded-host-persistence.js` / `sqlite-host-repositories.js` — the persistence engine itself is recent, tested work (`release-7.2.5`).
- Renderer code — surfacing the error to clients via sync messages is a follow-up, not this plan.

## Git workflow

- Branch: `advisor/003-host-store-durability`
- Commit style: conventional commits, e.g. `fix(lan): log persist failures, flush host store on quit`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Centralize persist-failure logging in host-store

In `lan-squad/host-store.js`, add one module-level helper near the top of `createHostStore`:

```js
let lastPersistError = null;
function reportPersistFailure(tag, err) {
  lastPersistError = { tag, message: err && err.message, at: new Date().toISOString() };
  console.error(`[lan-host-store] persist failed (${tag}):`, err && err.message);
}
```

Replace **every** `.catch(() => {})` on persist/flush promises in this file with `.catch((e) => reportPersistFailure('<call-site-tag>', e))`, where the tag names the operation (`team-code-hash`, `schedule-persist`, etc.). Expose `getLastPersistError()` on the returned store object (next to `flushCacheNow` in the export block around line 1700) so the health route can surface it later.

Also change the `void schedulePersist()` call sites: keep them fire-and-forget, but route their rejection through the same reporter — the cleanest way is inside `schedulePersist()` itself:

```js
function schedulePersist() {
  const p = commitBarrier.scheduleFlush(() => queue.enqueue(() => flushCacheToDisk()));
  p.catch((e) => reportPersistFailure('schedule-persist', e));
  return p;
}
```

(Returning the original promise keeps `awaitDurableCommit()` semantics; attaching a catch on a separate `.catch()` branch does not swallow it for awaiters.)

**Verify**: `node --test lan-squad/host-store.test.js` → `# fail 0`; `grep -n "catch(() => {})" lan-squad/host-store.js` → no matches on persist paths (the only acceptable remaining matches are non-persist, e.g. none expected).

### Step 2: Give the commit barrier an error reporter

In `lan-squad/persistence/commit-barrier.js`, accept an optional `onError` in the factory options (`createCommitBarrier({ coalesceMs = 150, onError } = {})`) and change the timer path (line 73) to `void executeFlush().catch((e) => { if (onError) onError(e); });`. Same for the `await executeFlush().catch(() => {})` inside `flushNow` (line 100) — but **preserve its behavior of resolving the waiter via settleWaiters**, i.e. only add the `onError` call, do not rethrow there. Wire it up in `host-store.js` where the barrier is created: `createCommitBarrier({ ..., onError: (e) => reportPersistFailure('commit-barrier', e) })`.

**Verify**: `node --test lan-squad/persistence/commit-barrier.test.js` → `# fail 0`, plus the new test from the Test plan section.

### Step 3: Flush the host store on quit

1. In `server.js`, near `stopLanServer` (line 449): add an exported `async function flushHostStoreNow()` that, when the host store instance exists, awaits `store.flushCacheNow({ serialized: true })` inside a try/catch that logs via `console.error('[lan-server] final flush failed:', ...)`. Find the actual store variable name by searching `createHostStore(` in `server.js`. Export it from the existing `module.exports` block (line 468).
2. In `main.js:1107`, make the handler flush before stopping, bounded so a hung disk cannot block quit:

```js
app.on('before-quit', (event) => {
  lanNetworkWatch.stop();
  const lanServer = require('./server');
  event.preventDefault();
  const timeout = new Promise((r) => setTimeout(r, 3000));
  Promise.race([lanServer.flushHostStoreNow().catch(() => {}), timeout])
    .then(() => lanServer.stopLanServer())
    .finally(() => app.exit(0));
});
```

  **Careful**: `preventDefault` + `app.exit` must not re-trigger `before-quit` recursion — guard with a module-level `let quitting = false; if (quitting) return; quitting = true;` at the top of the handler.

**Verify**: `npm start` → app launches; quit it (Cmd+Q) → app exits within ~3 s, no zombie process (`pgrep -f "R+\|electron"` shows nothing from this run). If `npm start` is unavailable in your environment, verify by `node --test lan-squad/host-store.test.js` plus code review, and say so in the report.

### Step 4: Close the `putRoomClinicalOps` divergence window

In `lan-squad/host-store.js:1102-1138`, reorder so the in-memory commit happens only after the DB merge succeeds: compute the merged snapshot into a local (`const mergedOps = serverOps ? mergeClinicalOpsSnapshotsData(serverOps, incomingSnapshot) : incomingSnapshot;`), await `mergeBundleClinicalOpsIntoHostDb(mergedOps, ...)` **first**, then assign `bundle.clinicalOps = authoritative || mergedOps`, bump revision/entityVersions, and append the audit entry. If the DB merge throws, the bundle must be untouched (the route already returns 500 — that behavior stays).

Mind one subtlety: `mergeBundleClinicalOpsIntoHostDb` is currently called with `revision: bundle.revision` *after* the bump. Preserve the recorded revision value by computing `const nextRevision = serverRevision + 1;` up front and passing that.

**Verify**: `node --test lan-squad/host-store.test.js lan-squad/host-store-clinical-ops-db.test.js` → `# fail 0`.

## Test plan

New tests (extend existing files, matching their style — plain `node:test`, temp dirs, fake clocks where used):

- `lan-squad/persistence/commit-barrier.test.js`: timer-driven flush whose `runFn` rejects → `onError` called with the error; subsequent flushes still work.
- `lan-squad/host-store.test.js`:
  - a store whose injected flush function throws → `getLastPersistError()` returns the tag + message (instead of silence).
  - `putRoomClinicalOps` with a DB-merge stub that throws → call rejects AND `bundle.clinicalOps` / `bundle.revision` are unchanged afterwards (read back via the store's getters). Check how existing tests inject/stub the DB manager — `lan-squad/host-store-clinical-ops-db.test.js` shows the pattern.
- Verification: `node --test lan-squad/host-store.test.js lan-squad/persistence/commit-barrier.test.js lan-squad/host-store-clinical-ops-db.test.js` → all pass, including ≥3 new tests.

## Done criteria

- [ ] `grep -c "catch(() => {})" lan-squad/host-store.js` → 0
- [ ] New tests above exist and pass
- [ ] `node --test lan-squad/host-store.test.js lan-squad/persistence/commit-barrier.test.js lan-squad/host-store-clinical-ops-db.test.js lan-squad/host-router.test.js` → `# fail 0`
- [ ] `npx eslint lan-squad/host-store.js lan-squad/persistence/commit-barrier.js server.js main.js` → exit 0
- [ ] `npm run metrics:check` → exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `host-store.js` has drifted from the excerpts (plan 002 edits the same file — it is sequenced first; re-run the drift check).
- `mergeBundleClinicalOpsIntoHostDb` turns out to mutate its input snapshot in place (reordering would then change semantics) — verify before Step 4; if it mutates, report instead of patching around it.
- The `before-quit` change causes the app to hang or re-enter quit in manual testing — revert that step only, land the rest, and report.
- Any existing host-store test starts failing for reasons unrelated to your change.

## Maintenance notes

- `getLastPersistError()` is intentionally minimal. Natural follow-up (deferred): surface it in the `/health` route and the host dashboard so a resident sees "host cannot save" instead of nothing.
- If the team later adds retry-on-persist-failure, put it behind the commit barrier's `onError`, not in the write queue.
- Reviewer should scrutinize: the `before-quit` race guard, and that Step 4 preserves the exact merge semantics (`authoritative || mergedOps` fallback mirrors today's `if (authoritative) bundle.clinicalOps = authoritative`).
