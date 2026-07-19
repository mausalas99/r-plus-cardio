# Plan 001: Make `npm test` run every test file on disk and keep the list from drifting again

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9db031d..HEAD -- package.json scripts/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `9db031d`, 2026-06-12

## Why this matters

The `test` script in `package.json` is an explicit, hand-maintained list of test files. It currently lists **201** files, but **337** test files exist on disk — **136 test files are never run by CI**. The orphans include tests for security-critical and recently shipped code: `lan-squad/shift-pin-store.test.js`, `lib/window-open-policy.test.mjs`, `public/js/session-clinical-wipe.test.mjs`, `public/js/todos-due.test.mjs`, `public/js/patient-list-virtual.test.mjs`, and all four `scripts/metrics/*.test.mjs` files. A green CI run therefore does not mean the tests pass. Every other plan in `plans/` relies on CI as its safety net, so this lands first.

A sample run of six orphaned files (`todos-due`, `patient-list-virtual`, `session-clinical-wipe`, `window-open-policy`, `shift-pin-store`, `metrics/score`) passed 42/42 on 2026-06-12, so most orphans are expected to pass.

**Decision context you must honor**: a glob-based test runner was tried and deliberately reverted (commit `3e2af44`); the team's documented policy (`.cursor/rules/project-context.mdc`, "Testing policy") is targeted `node --test <files>` locally and the full explicit-list suite only in CI/release. Do **not** reintroduce a glob runner. The fix is: complete the list, and add a cheap guard test that fails CI whenever a test file on disk is missing from the list.

## Current state

- `package.json` — the `scripts.test` entry is a single `node --test <201 explicit paths>` line. `pretest` runs `node scripts/ensure-native-db-for-node.mjs` (rebuilds SQLCipher natives for system Node); `posttest` restores them for Electron.
- `.github/workflows/ci.yml` — runs `npm ci`, `npm run build:ui`, `npm run metrics:check`, `npm test` on `macos-latest`.
- There is no script that compares the list against disk.

To reproduce the discrepancy (this is also the basis of the guard in Step 1):

```bash
node -e "
const pkg = require('./package.json');
const listed = new Set(pkg.scripts.test.replace(/^node --test /,'').split(/\s+/));
const { execSync } = require('child_process');
const onDisk = execSync(\"find . \\\\( -name '*.test.mjs' -o -name '*.test.js' \\\\) -not -path './node_modules/*' -not -path './.worktrees/*' -not -path './dist/*' -not -path './hallmark/*' -not -path './micode/*' -not -path './superpowers/*' -not -path './plugins/*' -not -path './lan-squad/node_modules/*'\", {encoding:'utf8'}).trim().split('\n').map(f=>f.replace(/^\.\//,''));
const missing = onDisk.filter(f => !listed.has(f));
console.log('listed:', listed.size, 'on disk:', onDisk.length, 'missing:', missing.length);
missing.forEach(f=>console.log(' ', f));
"
```

On 2026-06-12 this printed `listed: 201 on disk: 337 missing: 136`.

Repo conventions: build/check scripts live in `scripts/` as `.mjs` ESM files with colocated `*.test.mjs` (see `scripts/lib/electron-pack-files.js` + `scripts/lib/electron-pack-files.test.js` for the pattern of a script that can both check and `--write`). Tests use `node:test` + `node:assert`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test <files>` | `# fail 0` |
| Full suite (this plan only) | `npm test` | exit 0 (~35–60 s, runs pretest native rebuild) |
| Restore Electron natives | `node scripts/rebuild-native-db.mjs` | exit 0 (posttest does this automatically) |
| Lint | `npx eslint scripts/` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (the `scripts.test` line only)
- `scripts/lib/test-manifest.mjs` (create — list/disk comparison logic)
- `scripts/lib/test-manifest.test.mjs` (create — the guard test)

**Out of scope** (do NOT touch):
- `.github/workflows/ci.yml` — `npm test` already runs in CI; no workflow change needed.
- Any failing test's *source code*. If a resurrected test fails, you quarantine it (see Step 3), you do not fix the code under test.
- Any glob-based runner in `scripts.test` — explicitly rejected by the team.

## Git workflow

- Branch: `advisor/001-ci-test-list-integrity`
- Commit style: conventional commits, e.g. `test(ci): complete npm test manifest + drift guard` (matches `git log` style like `chore(ci): revert glob test runner...`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the manifest module and guard test

Create `scripts/lib/test-manifest.mjs` exporting two functions:

- `listedTestFiles(pkg)` — parses `pkg.scripts.test`, strips the leading `node --test `, splits on whitespace, returns an array.
- `testFilesOnDisk(rootDir)` — walks the repo (use `node:fs` `readdirSync` with recursion, not a shell `find`) collecting `*.test.mjs` / `*.test.js`, excluding directories: `node_modules`, `.worktrees`, `dist`, `build`, `hallmark`, `micode`, `superpowers`, `plugins`, `.git`, `python-runtime`, `ui-ux-pro-max-skill`. Return repo-relative paths with `/` separators.

Create `scripts/lib/test-manifest.test.mjs` with one test: every file from `testFilesOnDisk()` is present in `listedTestFiles()`. On failure, the assertion message must print the missing paths (so the fix is obvious). Support an explicit quarantine: an exported `QUARANTINED` array of paths (with a comment per entry saying why) that the test skips.

**Verify**: `node --test scripts/lib/test-manifest.test.mjs` → currently **fails**, listing 136+ missing files (it will pass after Step 2).

### Step 2: Add the missing files to `scripts.test`

Generate the complete list and rewrite the `scripts.test` value as `node --test <all files>`, preserving the current ordering convention (existing entries first, new entries appended is fine). The simplest reliable way: write a tiny one-off node script that reads both lists from `scripts/lib/test-manifest.mjs` and prints the merged line, then paste it into `package.json`. Do not hand-type 136 paths.

Also add `scripts/lib/test-manifest.test.mjs` itself to the list.

**Verify**: `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`.

### Step 3: Run the full suite once and quarantine genuine failures

**Known issue (reported by the operator 2026-06-12): the full suite HANGS — at least one test file never exits.** Do not sit waiting on a hung `npm test`. Strategy:

1. Run the suite with a per-test timeout so hangs become failures instead of stalls: `node --test --test-timeout=30000 <files>` (note: `npm test` doesn't pass the flag through; invoke `node --test` directly with the full file list, after running `node scripts/ensure-native-db-for-node.mjs` manually since you're bypassing `pretest`).
2. If something still hangs (a file can hang outside any test, e.g. an open server handle keeping the process alive), bisect: split the file list into batches (~40 files each, e.g. by directory), run each batch with a hard wall-clock bound (`timeout 300 node --test ...` or run in background and kill), and narrow the hanging batch until you've identified the specific file(s).
3. Quarantine each hanging file exactly like a failing file: add to `QUARANTINED` with reason `hangs — never exits under node --test` and remove it from `scripts.test`.
4. Run `node scripts/rebuild-native-db.mjs` when finished (you bypassed `posttest`).

Run the suite. Expect most resurrected files to pass (sample of 6 passed on 2026-06-12).

- If a file fails because of the environment (e.g. needs Electron ABI natives despite `pretest`), or fails on a real assertion: add it to `QUARANTINED` in `scripts/lib/test-manifest.mjs` with a one-line reason, **remove it from `scripts.test`**, and record it in your final report. Do not attempt to fix the code under test.
- If **more than 10 files** fail → STOP condition.

**Verify**: `npm test` → exit 0, and the reported test-file count is ≥ 320 (was ~201 files' worth before).

### Step 4: Lint and final check

**Verify**: `npx eslint scripts/lib/test-manifest.mjs scripts/lib/test-manifest.test.mjs` → exit 0.
**Verify**: `git status --porcelain` → only the three in-scope files modified/created.

## Test plan

- The guard test in `scripts/lib/test-manifest.test.mjs` IS the deliverable: it covers (a) happy path — list and disk agree; (b) the regression this plan fixes — a new `*.test.mjs` on disk not added to `scripts.test` makes CI fail with the path named.
- Model the file layout after `scripts/lib/electron-pack-files.test.js`.

## Done criteria

- [ ] `node --test scripts/lib/test-manifest.test.mjs` → `# fail 0`
- [ ] `npm test` → exit 0
- [ ] The one-liner from "Current state" prints `missing: 0` (quarantined files excluded from disk-walk or documented)
- [ ] `QUARANTINED` entries (if any) each have a reason comment and are listed in the final report
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- More than 10 resurrected test files fail in Step 3 (hangs count as failures) — that means CI has been masking real regressions and a human must triage before this plan proceeds.
- A file that was **already in the 201-entry list** is the one hanging — that means today's CI should be hanging too, which contradicts observed CI behavior; a human must reconcile.
- `npm test` fails on files that were **already** in the 201-entry list (pre-existing breakage unrelated to this plan).
- The `scripts.test` parse assumption (`node --test ` prefix followed by whitespace-separated paths) doesn't match what's in `package.json`.

## Maintenance notes

- Whenever someone adds a test file, the guard test forces them to add it to `scripts.test`. If the team later adopts CI sharding (the documented eventual direction), the manifest module is the natural input for the shard splitter.
- Reviewer should scrutinize: the exclusion dir list in `testFilesOnDisk` (an over-broad exclusion silently recreates this bug), and every `QUARANTINED` entry.
- Deferred: actually fixing any quarantined failing tests — file follow-up issues per quarantined entry.
