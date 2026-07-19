# Plan 005: Cache parsed clinical blobs in storage.js instead of re-running JSON.parse per read

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- public/js/storage.js public/js/storage.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-ci-test-list-integrity.md
- **Category**: perf
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

`public/js/storage.js` is the renderer's persistence layer. Every accessor (`getPatients()`, notes, indicaciones, lab history, todos, …) goes through `readClinicalBlob`, which runs `JSON.parse` on the **full raw JSON string** on every single call — the `_blobCache` introduced for SQLCipher desktop mode caches the *string*, not the parsed value. A ward census with labs and historia can be a 50–200 KB blob; features call these getters freely (census renders, filters, sync reconciles), so the renderer re-parses the same large blob many times per interaction. A parsed-value cache invalidated on write is a small, mechanical change with a visible main-thread win on large censuses.

## Current state

- `public/js/storage.js:19` — `let _blobCache = null;` — maps `blob_key → JSON string` in SQLCipher desktop mode; `null` in plain localStorage mode.
- `public/js/storage.js:70-99` — the read path:

```js
function blobCacheRaw(blobKey) {
  if (!_blobCache) return undefined;
  var raw = _blobCache[blobKey];
  if (raw == null) return null;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}
// ...
function readClinicalBlob(blobKey, lsKey, parseFromRaw) {
  if (skipClinicalLocalPersist() && WEB_SESSION_EMPTY_CLINICAL_BLOBS.has(blobKey)) {
    return blobKey === 'patients' ? [] : parseFromRaw('{}');
  }
  if (_blobCache) {
    return parseFromRaw(blobCacheRaw(blobKey));
  }
  return parseFromRaw(localStorage.getItem(lsKey));
}
```

  `parseFromRaw` is `safeParseArray` / `safeParseObject` (lines 60–68) — i.e. a fresh `JSON.parse` every call.
- Cache lifecycle: `_blobCache` is hydrated at line 142 (`_blobCache = await hydrateStorageCache()`), cleared at 144/150, and merged-into after saves at line 771 (`_blobCache = Object.assign({}, _blobCache || {}, writtenBlobs);`). **Read each of these sites** plus every other `_blobCache` assignment (`grep -n "_blobCache" public/js/storage.js`) — each one is an invalidation point for the new parsed cache.
- Writers also go through localStorage in non-DB mode (`safeLocalStorageSet`, line 35) — find every function that writes a clinical blob (search for `localStorage.setItem` and the `writeClinicalBlob`-style helpers, e.g. `writeTodosMap` at line ~104) — each write must invalidate that key's parsed entry.
- **Mutation hazard**: callers receive the parsed object. Today each caller gets a *fresh* copy, so in-place mutation by a caller is invisible to others. With a shared cached object, a caller that mutates the result could corrupt what other callers see. Mitigation in Step 2.
- Conventions: this file is legacy style — `var`, plain functions, JSDoc; ESM imports at top. Match it. Tests: `public/js/storage.test.mjs` exists and is in the CI list; see also `public/js/storage-quota.test.mjs`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test public/js/storage.test.mjs public/js/storage-quota.test.mjs public/js/app-state.test.mjs` | `# fail 0` |
| Lint | `npx eslint public/js/storage.js` | exit 0 |
| Bundle | `npm run build:ui` | exit 0 |
| Debt gate | `npm run metrics:check` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `public/js/storage.js`
- `public/js/storage.test.mjs` (extend)

**Out of scope** (do NOT touch):
- `public/js/db-storage-bridge.mjs` — the SQLCipher hydration path; the parsed cache sits **above** it.
- Any caller of `getPatients()` etc. — the API contract (returns parsed array/object) must not change.
- IndexedDB, quota logic (`storage-quota.mjs`).

## Git workflow

- Branch: `advisor/005-storage-parsed-cache`
- Commit style: `perf(storage): parsed-blob cache with write invalidation`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the parsed cache to the read path

In `public/js/storage.js`, add near `_blobCache`:

```js
/** @type {Map<string, unknown>} blobKey → last parsed value (invalidate on write/hydrate) */
var _parsedCache = new Map();
function invalidateParsed(blobKey) {
  if (blobKey == null) _parsedCache.clear();
  else _parsedCache.delete(blobKey);
}
```

Change `readClinicalBlob` to consult `_parsedCache` first (keyed by `blobKey`), and on miss, parse as today and store the result before returning. The session-scoped-web early return (empty blobs) must **not** be cached.

### Step 2: Invalidate on every write and cache-lifecycle event

- Every clinical-blob write path (both `_blobCache` merge sites like line 771 and direct `localStorage.setItem` writers like `writeTodosMap`): call `invalidateParsed(blobKey)` for each written key — or `invalidateParsed()` (clear all) where the written key set isn't enumerable. When in doubt, clear all: correctness over cleverness.
- `_blobCache = await hydrateStorageCache()` (line 142) and both `_blobCache = null` sites (144, 150): `invalidateParsed()`.

To contain the mutation hazard, keep the change observable: add a comment on `_parsedCache` — "callers must not mutate returned blobs in place; treat reads as immutable" — and in Step 3's tests, assert the known mutating pattern still works: find how `saveAll`/`savePatients`-style functions are used (callers mutate their own copy then call save; the save invalidates, so subsequent reads see the saved data). Do **not** add deep-freeze or deep-clone — that would eat the perf win; rely on the existing call pattern (verified in tests).

**Verify**: `node --test public/js/storage.test.mjs` → `# fail 0` (existing tests must pass unchanged — they are the behavioral contract).

### Step 3: Add cache-behavior tests

Extend `public/js/storage.test.mjs` (match its existing setup/mocking style for `localStorage`):

1. Two consecutive `getPatients()` calls return the **same object reference** (cache hit).
2. Save patients → next `getPatients()` returns the new data (invalidation works).
3. Cache cleared when the blob cache is reset (simulate the `_blobCache = null` path if the test harness allows; if storage.js doesn't export a reset hook, test via the public save/read API only and note it).
4. Session-scoped web mode still returns empty blobs and does not poison the cache.

**Verify**: `node --test public/js/storage.test.mjs public/js/app-state.test.mjs public/js/storage-quota.test.mjs` → `# fail 0`.

### Step 4: Build + lint

**Verify**: `npm run build:ui` → exit 0; `npx eslint public/js/storage.js` → exit 0; `npm run metrics:check` → exit 0.

## Test plan

See Step 3. Pattern exemplar: existing tests in `public/js/storage.test.mjs`.

## Done criteria

- [ ] Repeated reads return cached parsed values (reference-equality test passes)
- [ ] All writes invalidate (test 2 passes)
- [ ] `node --test public/js/storage.test.mjs public/js/app-state.test.mjs` → `# fail 0`
- [ ] `npm run build:ui` exit 0; `npx eslint public/js/storage.js` exit 0; `npm run metrics:check` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You find a caller that demonstrably mutates a blob returned by a getter **and relies on other readers not seeing the mutation until save** (grep callers of `getPatients(`/`getNotes(` for in-place `push`/`splice`/property writes on the returned value). The reference-sharing cache would change behavior — report the call sites instead of patching them.
- A write path exists whose written blob keys you cannot determine — and clearing the whole cache there would fire so often the cache never helps (e.g. a per-keystroke save). Report it.
- Existing `storage.test.mjs` tests fail after Step 1.

## Maintenance notes

- Anyone adding a new clinical blob writer must call `invalidateParsed` — the reference-equality test will not catch a *new* uninvalidated path, so reviewers should check for it whenever `storage.js` grows a writer.
- If LAN sync ever writes blobs through a path outside `storage.js` (it shouldn't — check `db-storage-bridge.mjs` consumers), the cache would go stale; the invariant is "all clinical blob writes flow through storage.js".
- Deferred: measuring the actual win with `perf-markers.mjs` instrumentation (shipped in 7.3.4) — worth doing when the v8 profiling gate runs (see plans/README "Direction").
