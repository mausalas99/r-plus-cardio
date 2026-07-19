# Plan 017: Stop force-rebuilding the SQLCipher native on every `npm start`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- scripts/rebuild-native-db.mjs package.json`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **⚠️ In-flight work warning**: the maintainer has UNCOMMITTED changes to
> `scripts/ensure-native-db-for-node.mjs` and a new untracked
> `scripts/fetch-sqlite-node.mjs` (the *Node-ABI* side of native management).
> This plan touches ONLY the *Electron-ABI* side (`rebuild-native-db.mjs`). If
> your change seems to require touching those files, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED (dev-startup path; mitigated by the startup native probe and an escape hatch)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`package.json` `prestart` runs `node scripts/rebuild-native-db.mjs` before
every `npm start`, and that script invokes `@electron/rebuild` with `-f`
(force) — so **every dev launch pays a 10–30s native rebuild of
`better-sqlite3-multiple-ciphers` even when the binary is already correct**.
`@electron/rebuild` without `-f` checks whether a rebuild is needed (ABI/version
match) and skips when current; the `-f` has been there since the native dep was
introduced (`28e7e66`, no recorded justification). Two safety nets make
dropping it low-risk: `main.js:478` runs `probeNativeRuntime()` at startup and
surfaces native-load failures, and `postinstall` still rebuilds after
dependency changes.

## Current state

- `scripts/rebuild-native-db.mjs` — entire script:

  ```js
  import { execSync } from 'node:child_process';
  import path from 'node:path';
  import { fileURLToPath } from 'node:url';

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    execSync('npx @electron/rebuild -f -w better-sqlite3-multiple-ciphers', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (e) {
    console.warn('[rebuild-native-db] electron rebuild failed (ok in CI without electron):', e.message);
    process.exit(0);
  }
  ```

- `package.json` scripts (relevant): `"prestart": "node scripts/rebuild-native-db.mjs && node scripts/bundle-renderer.mjs"`,
  `"postinstall": "node scripts/rebuild-native-db.mjs || true"`,
  `"rebuild:db-native": "node scripts/rebuild-native-db.mjs"`, and `posttest`
  also calls it. All callers benefit from skip-when-current.

- Safety net: `main.js:18` requires `lib/native-runtime-probe.js`; `main.js:478`
  calls `probeNativeRuntime()` — it detects `NODE_MODULE_VERSION` mismatches
  (`hint: 'abi'`) and missing binaries at app startup.

- The Node-ABI counterpart (`scripts/ensure-native-db-for-node.mjs`, used by
  `pretest`) intentionally switches the native to the **system-Node ABI** for
  DB tests; `rebuild-native-db.mjs`/`posttest` switches it back to the
  **Electron ABI**. This round-trip is exactly the case where the rebuild must
  NOT be skipped — which is what makes Step 3's verification meaningful:
  `@electron/rebuild` decides via its own ABI check, not via our flag.

- `@electron/rebuild` is pinned at `3.7.2` in devDependencies.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Timed rebuild | `time npm run rebuild:db-native` | see steps |
| Switch native to Node ABI (to test the must-rebuild case) | `node scripts/ensure-native-db-for-node.mjs` | exits 0 |
| App smoke | `npm start` | app launches, DB unlock screen works |
| Script tests | `node --test scripts/build-ui.test.mjs scripts/bundle-renderer.test.mjs` | `# fail 0` (neighbors unaffected) |

## Scope

**In scope** (the only files you should modify):
- `scripts/rebuild-native-db.mjs`

**Out of scope** (do NOT touch):
- `scripts/ensure-native-db-for-node.mjs`, `scripts/fetch-sqlite-node.mjs`,
  `stable-versions.json` — **maintainer's uncommitted in-flight work**.
- `package.json` — `prestart`/`posttest`/`postinstall` keep calling the same
  script; no script-graph changes.
- `scripts/ensure-argon2-pack-natives.mjs`, `scripts/fetch-*-win.mjs` — release
  packaging paths.

## Git workflow

- Branch: `advisor/017-native-rebuild-skip`
- Commit (conventional): `chore(dx): let @electron/rebuild skip current natives on prestart`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline timing

Run `time npm run rebuild:db-native` twice from a clean state and record both
times (expect both ≈10–30s today, since `-f` forces).

**Verify**: both runs show compile output (forced).

### Step 2: Drop `-f`, add an escape hatch

Edit `scripts/rebuild-native-db.mjs`:

```js
const force = process.env.R_PLUS_FORCE_NATIVE_REBUILD === '1' ? ' -f' : '';
execSync(`npx @electron/rebuild${force} -w better-sqlite3-multiple-ciphers`, { ... });
```

Add one comment line: `// -f only via R_PLUS_FORCE_NATIVE_REBUILD=1 — @electron/rebuild skips when the ABI is already current.`
Also document the new env var where the repo documents dev knobs: check
`.env.example` — if it lists `R_PLUS_*` knobs, append
`R_PLUS_FORCE_NATIVE_REBUILD=` with a one-line comment (this is the one
sanctioned edit outside the script; `.env.example` is not part of the
maintainer's in-flight diff — confirm with `git status .env.example` first).

**Verify**: `time npm run rebuild:db-native` (first run after the Electron ABI
is already in place) completes in a few seconds with `@electron/rebuild`'s
skip output (no compiler invocation).

### Step 3: Prove the must-rebuild case still rebuilds

1. `node scripts/ensure-native-db-for-node.mjs` — switches the installed
   native to the system-Node ABI (this is the maintainer's in-flight file; you
   are only *running* it, not editing it).
2. `time npm run rebuild:db-native` — must now actually rebuild (compile
   output, tens of seconds), because the on-disk ABI no longer matches
   Electron's.

**Verify**: step 2's run shows a real rebuild; a subsequent
`npm run rebuild:db-native` is again fast (skip).

### Step 4: End-to-end smoke

`npm start` → the app must reach the unlock/onboarding screen (proves the
Electron-ABI native loads; `probeNativeRuntime` at `main.js:478` would surface
a load failure).

**Verify**: app launches; quit cleanly. Then
`R_PLUS_FORCE_NATIVE_REBUILD=1 npm run rebuild:db-native` shows a forced full
rebuild (escape hatch works).

## Test plan

No new test files (the script has no test today and is exercised by the
verifications above). If `scripts/` gains a test harness later, a unit test
asserting the command string with/without the env var would be the right shape.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `time npm run rebuild:db-native` with current Electron-ABI native: **< 10s**, no compiler output.
- [ ] Step 3 sequence shows a real rebuild after the Node-ABI switch, then a skip.
- [ ] `R_PLUS_FORCE_NATIVE_REBUILD=1 npm run rebuild:db-native` forces a rebuild.
- [ ] `npm start` reaches the UI (native loads under Electron).
- [ ] `git status` shows modifications ONLY to `scripts/rebuild-native-db.mjs`
  (and optionally `.env.example`) — explicitly NOT
  `ensure-native-db-for-node.mjs`, `fetch-sqlite-node.mjs`, `stable-versions.json`.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Without `-f`, `@electron/rebuild` **skips** in Step 3 despite the Node-ABI
  native being installed (would mean its ABI detection misses this case — the
  `-f` was load-bearing; restore it and report).
- `npm start` fails the native probe after a skipped rebuild.
- The maintainer's in-flight changes land mid-plan and conflict (re-run the
  drift check; their `ensure-native-db-for-node.mjs` rewrite may change Step 3's
  behavior).
- `@electron/rebuild 3.7.2` turns out not to support skip-when-current the way
  assumed — report what its output actually says before changing approach.

## Maintenance notes

- `posttest` also runs this script: test runs that didn't touch the native now
  finish seconds faster too.
- Reviewer should scrutinize: the env-var gate exactly (`'1'`), and that CI
  behavior is unchanged (CI has no Electron and already exits 0 via the catch).
- If the maintainer's in-flight prebuild-fetch work later makes Electron-side
  prebuilds available (`fetch-sqlite-node.mjs` sibling for Electron), this
  script is where the fetch-before-rebuild fast path would go — keep it the
  single chokepoint.
