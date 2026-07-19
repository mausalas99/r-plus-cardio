# Plan 014: Cut redundant serialization and reassembly in the LAN host-store hot paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- lan-squad/host-store.js lan-squad/host-router.js`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (host sync path; mitigated by an investigation gate and existing suites)
- **Depends on**: plan 010 (both edit `lan-squad/host-router.js`; run sequentially, 010 first)
- **Category**: perf
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

Two measured inefficiencies on the LAN host (the machine serving a whole ward):

1. **Every persist flush stringifies the entire ward snapshot up to twice** —
   once to write it (JSON modes) and once more *purely to record a
   `byteLength` audit metric*; in `sql-v3` mode the full-snapshot stringify is
   **pure metric overhead** (the data is written as shards that compute their
   own sizes). Flushes are coalesced (~150ms windows), so during active sync
   this runs constantly with full-census payloads.
2. **`PUT /rooms/:id/sync-bundle` with `clinicalOps` reassembles the whole
   bundle just to refresh one field.** After persisting clinical ops to the DB,
   the route re-fetches the bundle via `getRoomSyncBundleForApi`, which runs
   `assembleBundleLabsForApi` — a walk of all bundle entries with a lab-sidecar
   lookup per patient — even though only `clinicalOps` changed. Pushes with
   clinicalOps are routine (directory/team sync), so a 10–50-patient room pays
   per-patient sidecar assembly on every such push.

This also feeds the pending v8 perf decision: shrinking host-side work reduces
the pressure the LAN-sync-workers spec is trying to relieve.

## Current state

- `lan-squad/host-store.js` — three audit sites stringify the snapshot
  (verified at `83049b1`; line numbers approximate):

  `persistCacheToDb()` (~line 335–348):
  ```js
  const t0 = Date.now();
  if (mode === 'sql-v3') {
    persistFullCacheSql(db, snapshot, labSidecarCache);
  } else {
    writeHostState(db, snapshot);
  }
  const commitMs = Date.now() - t0;
  audit(getClientId(), 'lan.host.commit', {
    action: 'host.commit',
    byteLength: JSON.stringify(snapshot).length,   // ← full stringify #1
    commitMs,
    persistGeneration: mode,
  });
  ```

  `flushCacheToDisk()` `sql-monolith` branch (~line 391–400):
  ```js
  if (mode === 'sql-monolith') {
    await persistCacheToDb();
    lastCommitAudit = {
      commitMs: Date.now() - t0,
      byteLength: JSON.stringify(snapshot).length,  // ← full stringify #2
      ...
  ```

  `flushCacheToDisk()` `json-monolith` branch (~line 420–430):
  ```js
  await writeJsonAtomic(filePath, snapshot);        // stringifies internally
  lastCommitAudit = {
    commitMs: Date.now() - t0,
    byteLength: JSON.stringify(snapshot).length,    // ← full stringify #3
  ```

- `lan-squad/host-router.js:450-489` — the PUT route:

  ```js
  r.put('/rooms/:id/sync-bundle', express.json({ limit: '16mb' }), async (req, res) => {
    try {
      const body = req.body && req.body.bundle ? req.body.bundle : req.body;
      const out = store.putRoomSyncBundle(req.params.id, body);
      if (
        out && out.bundle && out.bundle.clinicalOps &&
        typeof store.persistRoomBundleClinicalOpsToHostDb === 'function'
      ) {
        await store.persistRoomBundleClinicalOpsToHostDb(req.params.id);
        const refreshed =
          typeof store.getRoomSyncBundleForApi === 'function'
            ? store.getRoomSyncBundleForApi(req.params.id)   // ← full labs reassembly
            : store.getRoomSyncBundle(req.params.id);
        if (refreshed) out.bundle = refreshed;
      }
      ...
      const payload = { bundle: out.bundle, merged: true };
  ```

- `lan-squad/host-store.js` — `getRoomSyncBundleForApi(roomId)` =
  `getRoomSyncBundle(roomId)` + `assembleBundleLabsForApi(bundle, roomId)`
  (per-patient sidecar walk). Important asymmetry, verified:
  `putRoomSyncBundle` **strips labs to sidecars** before returning
  (`stripRoomBundleLabsToSidecars`), so in the **no-clinicalOps** branch the
  response bundle has labs stripped, while in the **clinicalOps** branch the
  refreshed bundle has labs **assembled**. Whether any client depends on
  assembled labs in PUT responses is the investigation gate (Step 2).

- Tests that pin this area: `lan-squad/host-store.test.js`,
  `lan-squad/host-router.test.js`, `lan-squad/host-store-clinical-ops-db.test.js`,
  `lan-squad/persistence/*.test.js`.

- Lint baseline: `lan-squad/host-store.js` has ~23 pre-existing eslint
  problems; `lan-squad/host-router.js` has ~2. `metrics:check` lints changed
  Tier-1 files with `--max-warnings 0` — your obligation is **no new problems**
  (and fixing host-router's 2 is in scope and cheap).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test lan-squad/host-store.test.js lan-squad/host-router.test.js lan-squad/host-store-clinical-ops-db.test.js` | `# fail 0` |
| Persistence suites | `node --test lan-squad/persistence/commit-barrier.test.js lan-squad/persistence/sharded-host-persistence.test.js lan-squad/persistence/lab-sidecar-persistence.test.js lan-squad/persistence/sqlite-host-repositories.test.js` | `# fail 0` |
| Lint baseline | `npx eslint lan-squad/host-store.js lan-squad/host-router.js \| tail -1` | record count before starting (~25) |
| Debt gate | `npm run metrics:check` | no `DEBT REGRESSION`; see done-criteria note |

These lan-squad suites do not need the SQLCipher Electron/Node ABI dance
unless they import `better-sqlite3` — `host-store-clinical-ops-db.test.js`
does: run `node scripts/ensure-native-db-for-node.mjs` first and
`node scripts/rebuild-native-db.mjs` when done.

## Scope

**In scope** (the only files you should modify):
- `lan-squad/host-store.js`
- `lan-squad/host-router.js`
- `lan-squad/host-store.test.js`, `lan-squad/host-router.test.js` (assertions/new cases)

**Out of scope** (do NOT touch):
- `lan-squad/persistence/**` — the shard writers already compute sizes
  correctly; nothing to change there.
- `lan-squad/bundle-merge.js`, `conflict-resolver.js` — merge semantics are not
  part of this plan.
- Renderer files (`public/js/**`) — even if Step 2 tempts you; a renderer
  change means STOP.
- The `byteLength` **semantic** — it must remain "serialized size of the full
  snapshot" so historical audit records stay comparable.

## Git workflow

- Branch: `advisor/014-host-store-hot-path`
- Commits (conventional): `perf(lan): compute snapshot byteLength once per flush`,
  `perf(lan): skip full bundle reassembly on clinical-ops PUT`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Single `byteLength` per flush

In `lan-squad/host-store.js`:
1. In `flushCacheToDisk()`, compute once near the top of the flush (after the
   snapshot is final): `const snapshotJson = JSON.stringify(snapshot);` and
   derive `const byteLength = snapshotJson.length;`
2. Reuse `byteLength` in every audit object in that function (`sql-monolith`,
   `json-sharded` if it records one, `json-monolith`). For `json-monolith`,
   pass the already-serialized string into the write if `writeJsonAtomic`'s
   signature allows it (check it — if it takes an object and stringifies
   internally, either extend it to accept a pre-serialized string or leave the
   write as is and just reuse `byteLength`; do NOT change its atomicity).
3. `persistCacheToDb()` is also called from the `sql-monolith` flush branch —
   thread the precomputed `byteLength` in as an optional parameter
   (`persistCacheToDb({ byteLength })`), falling back to computing it when
   called standalone. In `sql-v3` mode this removes the only remaining
   full-snapshot stringify on the flush path.

**Verify**: `node --test lan-squad/host-store.test.js lan-squad/persistence/commit-barrier.test.js` → `# fail 0`; and
`grep -c "JSON.stringify(snapshot).length" lan-squad/host-store.js` → 0
(replaced by the single computation; ≤1 if the standalone fallback keeps one).

### Step 2: Investigation gate — do clients consume assembled labs from PUT responses?

Search the renderer for consumers of the PUT response bundle:

```
grep -n "sync-bundle" public/js/features/lan/push.mjs
```

Read the response-handling code around the `.fetch('/api/lan/v1/rooms/' + … + '/sync-bundle')`
call (`push.mjs` ~line 435) and trace what happens to the parsed response
`bundle`: does anything read per-entry lab history (`labHistory`,
`assembleLabHistory` output fields) from it, or only `revision`,
`entityVersions`, `lwwAppliedKeys`, `clinicalOps`?

- If labs from the PUT response are **not** consumed → proceed to Step 3.
- If they **are** consumed → STOP and report (include the consuming code path).
  The optimization then needs a renderer change, which is out of scope here.

Record your evidence (file:line of every consumer you checked) in the commit
message body.

### Step 3: Targeted clinicalOps refresh instead of full reassembly

In `lan-squad/host-router.js` PUT `/rooms/:id/sync-bundle`: after
`persistRoomBundleClinicalOpsToHostDb`, replace the
`getRoomSyncBundleForApi` refresh with a targeted update of the already-merged
bundle. Add a narrow accessor to `host-store.js`, e.g.:

```js
/** Post-persist clinicalOps view for API responses; no lab assembly. */
function getRoomClinicalOpsForApi(roomId) {
  const bundle = getRoomSyncBundle(roomId);
  if (!bundle) return null;
  return {
    clinicalOps: bundle.clinicalOps || null,
    entityVersions: bundle.entityVersions || {},
    revision: bundle.revision,
  };
}
```

(Adjust to whatever `persistRoomBundleClinicalOpsToHostDb` actually mutates —
read it first; if it refreshes `bundle.clinicalOps` from the DB, the accessor
above is sufficient.) In the route:

```js
const refreshed = store.getRoomClinicalOpsForApi(req.params.id);
if (refreshed) {
  out.bundle = { ...out.bundle, clinicalOps: refreshed.clinicalOps,
                 entityVersions: refreshed.entityVersions, revision: refreshed.revision };
}
```

This makes both PUT branches return labs-stripped bundles (consistent shape),
which Step 2 verified is safe.

**Verify**: `node --test lan-squad/host-router.test.js lan-squad/host-store-clinical-ops-db.test.js` → `# fail 0`.

### Step 4: Response-shape regression test

Add to `lan-squad/host-router.test.js`: a PUT with `clinicalOps` returns a
bundle whose `clinicalOps` reflects the persisted state and whose entries do
NOT carry assembled lab history (assert the stripped marker/absence — read how
`stripRoomBundleLabsToSidecars` marks entries to pick the right assertion).
Model after the existing PUT tests in that file.

**Verify**: `node --test lan-squad/host-router.test.js` → `# fail 0`, including the new case.

## Test plan

- New: the Step 4 response-shape test (clinicalOps refreshed, labs stripped).
- Extended: if `host-store.test.js` already asserts `lastCommitAudit.byteLength`,
  confirm it still passes; if it does not, add one assertion that
  `byteLength > 0` after a flush in each persist mode the suite already exercises.
- Pattern: existing cases in `lan-squad/host-store.test.js` /
  `host-router.test.js` (supertest-style router harness).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test lan-squad/host-store.test.js lan-squad/host-router.test.js lan-squad/host-store-clinical-ops-db.test.js lan-squad/persistence/commit-barrier.test.js lan-squad/persistence/sharded-host-persistence.test.js lan-squad/persistence/lab-sidecar-persistence.test.js lan-squad/persistence/sqlite-host-repositories.test.js` → `# fail 0`.
- [ ] `grep -c "getRoomSyncBundleForApi" lan-squad/host-router.js` → 0 in the PUT route (the GET route may still use it — check context of any remaining hit).
- [ ] At most one `JSON.stringify(snapshot).length` remains in `host-store.js` (the standalone fallback), none in the flush branches.
- [ ] `npx eslint lan-squad/host-router.js` → 0 problems (its 2 pre-existing issues fixed).
- [ ] `npx eslint lan-squad/host-store.js | tail -1` → problem count ≤ pre-plan baseline.
- [ ] `npm run metrics:check` → no `DEBT REGRESSION` (the eslint pass may flag host-store's pre-existing problems; acceptable only with the baseline comparison above — state it in your report).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2 finds a renderer consumer of assembled labs in PUT responses.
- `persistRoomBundleClinicalOpsToHostDb` does something other than refresh the
  bundle's clinicalOps from the DB (read it before Step 3; if it rewrites
  entries or versions beyond clinicalOps, the targeted accessor is wrong —
  report what it actually mutates).
- `writeJsonAtomic` cannot accept a pre-serialized payload without changing its
  atomic rename behavior — in that case do only the audit-reuse half of Step 1
  and say so.
- Any persistence-suite failure: those suites are characterization for ward
  durability; do not "fix" them to match new behavior.

## Maintenance notes

- The `byteLength` audit metric is now computed once per flush; if a future
  persist mode is added, wire its audit record to the same precomputed value.
- Reviewer should scrutinize: the PUT response in the clinicalOps branch — diff
  one real payload before/after to confirm only lab assembly disappeared
  (revision/entityVersions/clinicalOps identical).
- Deferred (rejected this cycle): replacing the audit metric with a cheaper
  size estimate — it would break comparability of historical
  `lan.host.commit` records.
