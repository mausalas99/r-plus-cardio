# Plan 020: Integration tests for the IPC handler surface (`lib/db/ipc-handlers.mjs`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- lib/db/ipc-handlers.mjs lib/db/test-open-db.mjs`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW (tests only — production code is read, not modified)
- **Depends on**: plan 013 (teardown discipline for SQLCipher-native suites —
  reuse its `finally`/`after()` pattern so this suite doesn't join the
  quarantine list on day one)
- **Category**: tests
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`lib/db/ipc-handlers.mjs` is 1,232 lines registering ~62 `ipcMain.handle`
channels — the **entire renderer↔main trust boundary for clinical data
mutations** (teams, patients, guardias, rotations, profiles, audit export,
unlock/migration). It has zero direct tests; the only coverage is one static
assertion in `main-lan-boot.test.mjs` that a single channel name exists. Any
refactor of this file — or any new handler — ships unverified. The module is
fully injectable (verified below), so integration tests with a real temp
SQLCipher DB are cheap to write. This plan covers the ~15 highest-risk
handlers, not all 62 — the goal is a harness + the dangerous paths, and a
pattern that makes covering the rest incremental.

## Current state

- `lib/db/ipc-handlers.mjs:174-181` — the registration entry point, fully
  dependency-injected:

  ```js
  export function registerDbIpcHandlers({
    ipcMain,
    dbManager,
    app,
    dialog,
    safeStorage: _safeStorage,
    getClientId,
  }) {
    const userDataPath = () => app.getPath('userData');
  ```

  Handlers are registered as `ipcMain.handle('<channel>', async (_e, args) => …)`.
  List all channels with:
  `grep -n "ipcMain.handle('" lib/db/ipc-handlers.mjs | sed "s/.*handle('\([^']*\)'.*/\1/"`

- Test helper that already solves DB setup —
  `lib/db/test-open-db.mjs`:

  ```js
  export async function createUnlockedDbManager(userDataPath, getClientId = () => 'host-store-test') {
    const mgr = createDbManager({ userDataPath, safeStorage: mockSafeStorage, getClientId });
    await mgr.unlockWithKeyHex(TEST_KEY_HEX);
    return mgr;
  }
  ```

  (Also exports `TEST_KEY_HEX` and a `mockSafeStorage`.)

- Exemplar for DB-level assertions and fixture style:
  `lib/db/clinical-access-db.test.mjs` (in CI, passes) — `describe/it`,
  `node:assert/strict`, builds users/teams via the same functions the handlers
  call.

- Priority channels (clinical-data mutation, pick these first — confirm exact
  names from the grep above): the `clinical-teams-*` cluster (create, join,
  member add/remove, leader promote, archive), `patient-team-assign`-style
  assignment channels, guardia upsert/resolve channels, rotation cycle
  channels, profile upsert, username claim, and the audit export channel
  (`dbAuditExport` consumer side — verify chain rows shape).

- This suite needs the SQLCipher native for system Node: `pretest` flow
  (`node scripts/ensure-native-db-for-node.mjs` before,
  `node scripts/rebuild-native-db.mjs` after).

- Lint: new test files must be clean (Tier-1 globs include `lib/**`);
  `ipc-handlers.mjs` itself has ~4 pre-existing problems — you are NOT
  modifying it, so they stay out of metrics:check scope.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Native for Node | `node scripts/ensure-native-db-for-node.mjs` | exit 0 |
| Run the new suite | `timeout 180 node --test lib/db/ipc-handlers.test.mjs; echo "exit=$?"` | `exit=0`, `# fail 0` |
| Restore Electron ABI | `node scripts/rebuild-native-db.mjs` | exit 0 |
| Manifest | `node --test scripts/lib/test-manifest.test.mjs` | `# fail 0` after registering |
| Lint new file | `npx eslint lib/db/ipc-handlers.test.mjs` | 0 problems |

## Scope

**In scope**:
- `lib/db/ipc-handlers.test.mjs` (new — split into `ipc-handlers-teams.test.mjs`
  etc. only if a single file exceeds ~600 lines)
- `scripts/lib/test-manifest.mjs` is NOT edited (nothing quarantined);
  `package.json` `scripts.test` — append the new file(s)

**Out of scope** (do NOT touch):
- `lib/db/ipc-handlers.mjs` itself — if a handler proves untestable without
  production changes, STOP and report; do not refactor production here. The
  single exception: NONE in this plan.
- `main.js`, `preload.js` — the Electron wiring is not under test here.
- Unlock/migration channels that spawn dialogs or touch real `safeStorage`
  beyond the injected mock — cover only what the fake-deps seam reaches.

## Git workflow

- Branch: `advisor/020-ipc-handlers-tests`
- Commits per cluster: `test(db): IPC harness + clinical-teams channels`, …
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the harness

In `lib/db/ipc-handlers.test.mjs`:

```js
function createFakeIpcMain() {
  const handlers = new Map();
  return {
    handle(channel, fn) { handlers.set(channel, fn); },
    invoke(channel, args) {
      const fn = handlers.get(channel);
      if (!fn) throw new Error('no handler: ' + channel);
      return fn({ /* fake event */ }, args);
    },
    handlers,
  };
}
```

Per-test setup (in `before`/`beforeEach` with matching teardown in
`after`/`finally`, per plan 013's discipline):
- temp dir via `fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-ipc-'))`
- `mgr = await createUnlockedDbManager(tmpDir)`
- fake `app = { getPath: () => tmpDir }`, fake
  `dialog = { showOpenDialog: async () => ({ canceled: true }) }`
- `registerDbIpcHandlers({ ipcMain: fake, dbManager: mgr, app, dialog, safeStorage: null, getClientId: () => 'test-client' })`
- teardown: `mgr.lock()` (and close anything `createUnlockedDbManager` exposes),
  `fs.rmSync(tmpDir, { recursive: true, force: true })`

**Verify**: a smoke test that registers and asserts
`fake.handlers.size >= 50` passes:
`timeout 120 node --test lib/db/ipc-handlers.test.mjs; echo "exit=$?"` → `exit=0`.
**The suite must exit cleanly — if it hangs, apply plan 013's
`process.getActiveResourcesInfo()` probe before anything else.**

### Step 2: Cover the clinical-teams cluster (~6 channels)

For each: invoke through the fake, assert the response shape (`ok`,
ids), and assert the DB state with the same query functions the exemplar test
uses (`listActiveTeams`, `listTeamMembers`, …). Include one negative case per
handler (e.g. joining a non-existent team) asserting the error shape rather
than a throw — read the handler body first to learn its error convention
(many wrap in try/catch and return `{ ok: false, error }`).

**Verify**: suite passes; each new test's DB assertions go through real
SQLCipher (no mocks of `clinical-access-db.mjs`).

### Step 3: Patients/guardia/rotation clusters (~6–9 channels)

Same pattern: assignment channel (assign patient→team, verify
`fetchActivePatientTeamId`), guardia upsert/resolve, rotation cycle
upsert/get/archive.

### Step 4: Audit + read-only channels (~2–3)

Audit export channel: perform a mutation, invoke the export channel, assert
rows exist and `verifyChainRows` (imported from `./forensic-audit.mjs`)
validates the chain.

### Step 5: Register in the manifest

Append the new file path(s) to `package.json` `scripts.test`.

**Verify**: `node scripts/lib/test-manifest.mjs` → missing/extra empty;
`node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`.

## Test plan

This plan IS a test plan. Coverage floor (count, machine-checkable):
≥ 15 channels invoked, each with ≥ 1 happy-path DB-state assertion; ≥ 5
negative cases. Structure model: `lib/db/clinical-access-db.test.mjs`.
Run twice consecutively to prove no inter-run temp-dir state.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `for i in 1 2; do timeout 180 node --test lib/db/ipc-handlers.test.mjs || exit 1; done` → both runs `# fail 0`, clean exit.
- [ ] `grep -c "fake.invoke\|ipc.invoke" lib/db/ipc-handlers.test.mjs` ≥ 20 (proxy for ≥15 channels + negatives).
- [ ] `npx eslint lib/db/ipc-handlers.test.mjs` → 0 problems.
- [ ] `lib/db/ipc-handlers.mjs` unmodified (`git diff --stat` clean for it).
- [ ] New file(s) listed in `package.json` `scripts.test`; manifest guard green.
- [ ] `node scripts/rebuild-native-db.mjs` run at the end (Electron ABI restored).
- [ ] `npm run metrics:check` → `metrics:check OK`.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The harness hangs and the probe points at production code holding a handle
  (same rule as plan 013: report, don't patch production).
- A priority handler cannot be invoked without real Electron objects (BrowserWindow,
  real dialogs) — skip it, note it in the report; if more than ~5 priority
  handlers are skipped for this reason, stop and report the list (the harness
  seam may need a production-side change, which is a new plan).
- A handler test reveals an actual bug (wrong response, missing validation,
  state corruption) — do NOT fix it here; record a finding with file:line in
  your report and keep the test as `it.todo`/skipped with a comment.
- `lib/db/ipc-handlers.test.mjs` would exceed ~600 lines — split by cluster as
  noted in Scope.

## Maintenance notes

- New IPC channels must land with a case in this suite — reviewers should
  treat a new `ipcMain.handle` without one as a red flag.
- The harness's fake `ipcMain` is intentionally minimal; if preload-side
  contract tests are wanted later, that is a different seam (`preload.js`),
  not an extension of this file.
- If suite runtime grows past ~60s, split clusters into separate files (the
  manifest handles many small files well; CI sharding is the stated future
  direction).
