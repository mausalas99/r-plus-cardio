# Plan 013: Re-enable five of the six quarantined test suites (DB migration coverage back in CI)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- scripts/lib/test-manifest.mjs package.json lib/db/migrate-from-legacy.test.mjs lib/db/migration-probe.test.mjs lib/db/clinical-ops-fk-repro.test.mjs lib/interno/sala-interno-access.test.mjs public/js/features/settings-help/tour-intro.test.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW–MED (diagnosis step has unknowns; everything else is mechanical)
- **Depends on**: none. (The 6th quarantined suite, `app-shell-exports.test.mjs`, is handled by plan 018 — do NOT touch it here.)
- **Category**: tests
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`scripts/lib/test-manifest.mjs` quarantines six suites so `npm test` can exit 0.
Three of them (`migrate-from-legacy`, `migration-probe`, `clinical-ops-fk-repro`)
guard the **legacy→SQLCipher migration path** — the gateway for every install
that predates the encrypted store. That path currently has **zero CI
coverage**. The other two are trivially stale (a fixture expects 3 salas where
the schema now seeds 8; a source-regex assertion drifted). Each suite that
stays quarantined is coverage silently lost; the quarantine list is supposed to
shrink, and nothing has come off it since it was created.

## Current state

- `scripts/lib/test-manifest.mjs:96-110` — the `QUARANTINED` array with inline
  reasons:

  ```js
  export const QUARANTINED = [
    // lib/db/migrate-from-legacy.test.mjs — hangs: never exits under node --test (open DB handle / no teardown)
    'lib/db/migrate-from-legacy.test.mjs',
    // lib/db/migration-probe.test.mjs — hangs: never exits under node --test (open DB handle / no teardown)
    'lib/db/migration-probe.test.mjs',
    // lib/db/clinical-ops-fk-repro.test.mjs — hangs: never exits under node --test (open DB handle)
    'lib/db/clinical-ops-fk-repro.test.mjs',
    // public/js/app-shell-exports.test.mjs — fails: app-shell 842>800 line budget + DOM side-effect on import; file-level timeout
    'public/js/app-shell-exports.test.mjs',
    // lib/interno/sala-interno-access.test.mjs — fails: bootstraps three sala tokens expects 3 tokens, got 8 (stale fixture)
    'lib/interno/sala-interno-access.test.mjs',
    // public/js/features/settings-help/tour-intro.test.mjs — fails: quick_wrap regex assertion drift vs current copy
    'public/js/features/settings-help/tour-intro.test.mjs',
  ];
  ```

  The drift-guard test (`scripts/lib/test-manifest.test.mjs`, in CI) enforces:
  every on-disk test file is either listed in `package.json` `scripts.test` or
  in `QUARANTINED`. So re-enabling = remove from `QUARANTINED` **and** append
  the path to the `scripts.test` file list.

- **The three "hang" suites** use real SQLCipher natives. Structure (verified):
  - `lib/db/migrate-from-legacy.test.mjs` — uses `openTestDb(TEST_KEY_HEX)`
    (helper in `lib/db/test-open-db.mjs`) with a `close()` it calls at line 67,
    and a second test using `createDbManager` + `mgr.lock()` at line 102.
  - `lib/db/migration-probe.test.mjs` — same helpers; `close()` at 85,
    `mgr.lock()` at 133.
  - `lib/db/clinical-ops-fk-repro.test.mjs` — opens raw
    `new Database(':memory:')` via `better-sqlite3-multiple-ciphers` in a local
    `openDb()` with **no close calls at all**.
  - Note: `lib/db/db-manager.mjs` has **no `setInterval`/`setTimeout`** (verified
    by grep) — the hang is *not* an un-cleared manager timer. `close()`/`lock()`
    calls exist in most paths but may be skipped on assertion failure
    (not wrapped in `finally`) or some handle may be left open (e.g. whatever
    `readHostState` from `lan-host-persistence.mjs` opens). The diagnosis step
    below settles it empirically.

- **`lib/interno/sala-interno-access.test.mjs`** (lines 22–27):

  ```js
  it('bootstraps three sala tokens', () => {
    const rows = listSalaInternoAccess(db);
    assert.equal(rows.length, 3);
  ```

  while `lib/db/clinical-salas.mjs:2-11` `CLINICAL_SALA_VALUES` now has **8**
  entries (Sala 1, Sala 2, Sala E, Torre HU, Área A/Pensionistas,
  Interconsultas, UX, Eme) and `lib/db/schema.mjs` seeds all of them.

- **`public/js/features/settings-help/tour-intro.test.mjs`** (lines ~55–71)
  asserts source patterns against `tour-flow.mjs`, including:

  ```js
  assert.match(click[0], /if \(tourState\.tourStepId === 'wrap'\)/);
  ```

  while the live `public/js/features/settings-help/tour-flow.mjs:712` now reads:

  ```js
  if (tourState.tourStepId === 'wrap' || tourState.tourStepId === 'quick_wrap') {
  ```

- Conventions: `node:test` + `node:assert/strict`, `describe/it`. DB tests open
  per-test databases; exemplar with proper lifecycle:
  `lib/db/clinical-access-db.test.mjs` (in CI, does not hang) — note it uses
  raw `new Database(':memory:')` per `beforeEach` and **does not close** either,
  yet exits. That tells you raw in-memory handles alone do not keep the loop
  alive — focus diagnosis on `openTestDb` (file-backed temp dirs),
  `createDbManager`, and `readHostState`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Native build for system Node (REQUIRED before DB suites) | `node scripts/ensure-native-db-for-node.mjs` | exits 0 |
| Restore Electron ABI when finished | `node scripts/rebuild-native-db.mjs` | exits 0 |
| Run one suite with timeout guard | `timeout 120 node --test lib/db/migration-probe.test.mjs; echo "exit=$?"` | `exit=0` (124 = still hanging) |
| Manifest consistency | `node --test scripts/lib/test-manifest.test.mjs` | `# fail 0` |
| Manifest CLI overview | `node scripts/lib/test-manifest.mjs` | `missing` and `extra` both empty |

## Scope

**In scope** (the only files you should modify):
- `scripts/lib/test-manifest.mjs` (QUARANTINED entries removal)
- `package.json` (`scripts.test` — append re-enabled files)
- `lib/db/migrate-from-legacy.test.mjs`, `lib/db/migration-probe.test.mjs`,
  `lib/db/clinical-ops-fk-repro.test.mjs` (teardown fixes)
- `lib/interno/sala-interno-access.test.mjs` (fixture fix)
- `public/js/features/settings-help/tour-intro.test.mjs` (regex update)
- `lib/db/test-open-db.mjs` — ONLY if diagnosis shows the leak is in the shared
  helper (e.g. missing close on the manager path); keep changes additive.

**Out of scope** (do NOT touch):
- `public/js/app-shell-exports.test.mjs` and its QUARANTINED entry — plan 018.
- Production source under `lib/db/` (`db-manager.mjs`, `migrate-from-legacy.mjs`,
  `migration-probe.mjs`, `schema.mjs`, `lan-host-persistence.mjs`) — **unless**
  diagnosis proves the leaked handle is opened by production code with no
  close API; in that case STOP and report with evidence instead of patching
  production here.
- `public/js/features/settings-help/tour-flow.mjs` — the test adapts to the
  source, not the other way around.

## Git workflow

- Branch: `advisor/013-quarantine-drain`
- One commit per suite re-enabled (conventional): e.g.
  `test(db): fix teardown hang, re-enable migrate-from-legacy suite`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Build natives for system Node

`node scripts/ensure-native-db-for-node.mjs`

**Verify**: `node -e "require('better-sqlite3-multiple-ciphers'); console.log('ok')"` → `ok`.
(If this fails, your environment cannot run the DB suites — STOP.)

### Step 1: Fix the two mechanical suites first (quick wins)

1. `lib/interno/sala-interno-access.test.mjs`: import the source of truth and
   drop the magic number —

   ```js
   import { CLINICAL_SALA_VALUES } from '../db/clinical-salas.mjs';
   ...
   it('bootstraps a token per configured sala', () => {
     const rows = listSalaInternoAccess(db);
     assert.equal(rows.length, CLINICAL_SALA_VALUES.length);
   ```

   Scan the rest of the file for other count-based assumptions (8 vs 3) and fix
   the same way. (Confirm the export name with
   `grep -n "export" lib/db/clinical-salas.mjs` first.)
2. `tour-intro.test.mjs`: update the drifted regex to match current source:

   ```js
   assert.match(click[0], /if \(tourState\.tourStepId === 'wrap' \|\| tourState\.tourStepId === 'quick_wrap'\)/);
   ```

   Then run the suite; if other assertions in the same test drifted (the
   `wrapIdx < idxCheck` ordering check uses `indexOf` on the *old* literal —
   update its search string to the new literal too), fix them the same way:
   read `tour-flow.mjs` around lines 417, 631, 712 and mirror the current code.

**Verify**: `node --test lib/interno/sala-interno-access.test.mjs public/js/features/settings-help/tour-intro.test.mjs` → `# fail 0`.

### Step 2: Diagnose the hang empirically (do not guess)

For each DB suite, append a temporary handle probe at the end of the file:

```js
import { test } from 'node:test';
test('zz handle probe', () => {
  setTimeout(() => {
    console.error('ACTIVE:', process.getActiveResourcesInfo());
  }, 500).unref();
});
```

Run `timeout 120 node --test lib/db/migration-probe.test.mjs; echo "exit=$?"`.
If it hangs (`exit=124`), the `ACTIVE:` line printed ~500ms after the last test
names the resource type(s) holding the loop (e.g. `FSWatcher`, `TCPSocket`,
`Timeout`, `FILEHANDLE`). Trace that resource type to its origin:
- `FILEHANDLE`/file-backed DB → a `openTestDb`/`createDbManager` instance whose
  `close()`/`lock()` is skipped on a failure path → wrap in `try/finally` or
  `t.after(() => close())`.
- `FSWatcher` → something in the imported module graph watches a file at import
  time — find it with `grep -rn "fs.watch" lib/db lib/` and report if it is
  production code (STOP condition).
- `Timeout` → find the producer; `.unref()` it **in test code only**.

Remove the probe once the cause is fixed.

### Step 3: Fix teardown in the three DB suites

Apply the diagnosis. Expected shape of the fix (per suite):
- Wrap every `openTestDb()` / `createDbManager()` usage so close/lock always
  runs: `try { ... } finally { close(); }` or node:test `after()` hooks.
- `clinical-ops-fk-repro.test.mjs`: add `db.close()` for each `openDb()`
  instance (`try/finally` per test, matching the style of the other two suites
  after your fix).
- Temp dirs created via `os.tmpdir()` should be removed in `after()` (match
  what `lib/db/clinical-access-db.test.mjs` does, if anything).

**Verify** (each suite, then together):
`timeout 120 node --test lib/db/migrate-from-legacy.test.mjs; echo "exit=$?"` → `exit=0`
`timeout 120 node --test lib/db/migration-probe.test.mjs; echo "exit=$?"` → `exit=0`
`timeout 120 node --test lib/db/clinical-ops-fk-repro.test.mjs; echo "exit=$?"` → `exit=0`
`timeout 300 node --test lib/db/migrate-from-legacy.test.mjs lib/db/migration-probe.test.mjs lib/db/clinical-ops-fk-repro.test.mjs; echo "exit=$?"` → `exit=0`, `# fail 0`

### Step 4: De-quarantine and register the five suites

1. Remove the five entries (NOT `app-shell-exports`) from `QUARANTINED` in
   `scripts/lib/test-manifest.mjs`.
2. Append the five paths to `package.json` `scripts.test` (end of the list is
   fine — the manifest guard only checks set membership).

**Verify**: `node scripts/lib/test-manifest.mjs` → `missing` and `extra` empty;
`node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`.

### Step 5: Restore the Electron-ABI native

`node scripts/rebuild-native-db.mjs`

**Verify**: exits 0. (Skipping this leaves the repo unable to `npm start`.)

## Test plan

No new test files — this plan *restores* existing coverage. The five re-enabled
suites passing under `node --test` with clean exit IS the test plan. Sanity:
the full migration suite trio must pass twice in a row (`for i in 1 2; do timeout 300 node --test lib/db/migrate-from-legacy.test.mjs lib/db/migration-probe.test.mjs lib/db/clinical-ops-fk-repro.test.mjs || exit 1; done`)
to rule out order-dependent state in the shared temp dirs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] All five suites pass with `exit=0` via the Step 3/Step 1 commands (no `timeout` kills).
- [ ] `grep -c "lib/db/migrate-from-legacy\|lib/db/migration-probe\|lib/db/clinical-ops-fk-repro\|sala-interno-access\|tour-intro" scripts/lib/test-manifest.mjs` → 0.
- [ ] `node scripts/lib/test-manifest.mjs` → no missing, no extra; only 1 quarantined remains (`app-shell-exports`).
- [ ] `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`.
- [ ] `npm run metrics:check` → `metrics:check OK` (test files are not Tier-1-scored, but confirm).
- [ ] No production source modified (`git status` shows only in-scope files).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0 cannot produce a loadable native for system Node.
- The Step 2 probe shows the leaked handle is opened by **production** code
  (`db-manager.mjs`, `lan-host-persistence.mjs`, …) with no close API reachable
  from the test — report the resource type, the owning module, and a proposed
  production fix as a NEW plan; do not patch production here.
- A suite still hangs after teardown fixes in two attempts.
- The migration suites fail on **assertions** (not hangs): that means the
  migration code itself drifted while unguarded — report the failures verbatim;
  fixing migration logic is out of scope.
- `tour-intro.test.mjs` requires more than regex/string updates (i.e., the
  structures it asserts no longer exist) — the test may need redesign, which is
  a product question.

## Maintenance notes

- The `QUARANTINED` list should now hold exactly one entry
  (`app-shell-exports`, removed by plan 018). Any future addition needs an
  inline reason comment — the manifest file documents this contract.
- Reviewer should scrutinize: teardown is in `finally`/`after()` (not inline at
  the end of `it()` bodies where an assertion failure skips it).
- If CI time grows noticeably from the three DB suites, that is the trigger to
  revisit the stated direction of sharding `npm test`.
