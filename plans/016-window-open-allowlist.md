# Plan 016: Tighten the external-URL policy from scheme-only to a real allowlist (GitHub + private LAN)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 83049b1..HEAD -- lib/window-open-policy.cjs lib/window-open-policy.test.mjs main.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (small surface; the entire legitimate URL inventory is known)
- **Depends on**: none
- **Category**: security (hardening)
- **Planned at**: commit `83049b1`, 2026-06-12

## Why this matters

`lib/window-open-policy.cjs` is named and commented as an "allowlist (audit
M1)" but it only checks the scheme — **any** `http(s)://` URL passes to
`shell.openExternal`. A compromised or scripted renderer gets a one-call
exfiltration/phishing channel to arbitrary external hosts. The app's entire
legitimate external-URL surface is small and known (verified by call-site
inventory below): GitHub release pages/installers, and LAN URLs on the ward
network (join links, iPad invites). Tightening to those two classes closes the
gap without breaking any feature.

This complements the documented LAN-plaintext risk acceptance
(`docs/core/15-security.md`) — that acceptance covers the ward LAN, not
arbitrary Internet hosts.

## Current state

- `lib/window-open-policy.cjs` — entire policy today:

  ```js
  /**
   * Electron window.open / shell.openExternal allowlist (audit M1).
   * Mirrors open-external IPC in main.js.
   */
  function isAllowedExternalUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  module.exports = { isAllowedExternalUrl };
  ```

- Gate points in `main.js` (both keep working unchanged):
  - `main.js:221-224` — `mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (isAllowedExternalUrl(url)) shell.openExternal(url); return { action: 'deny' }; });`
  - `main.js:453-456` — IPC `open-external` handler: `if (!isAllowedExternalUrl(url)) return false; await shell.openExternal(url);`
  - `main.js:421` — `open-downgrade-installer` calls `shell.openExternal(url)`
    **ungated**, but the URL is built internally by `buildManualInstallerUrl`
    from a sanitized version string (GitHub releases). Step 3 routes it through
    the policy for defense in depth.
  - `main.js:465-467` — `sesion-ingreso://` custom-scheme opens, deliberately
    NOT routed through this policy (non-http scheme). Leave them alone.

- Renderer call-site inventory (verified 2026-06-12; complete list of
  `openExternal` users):
  - `public/js/stable-downgrade-ui.mjs:170,173,230,273` — `buildManualInstallerUrl(...)` and `RELEASES_PAGE` (GitHub).
  - `public/js/features/platform/updater.mjs:291,298,380,460,643` —
    `RELEASES_LATEST_URL`, literal `https://github.com/mausalas99/r-mas/releases`,
    and `payload.manualUrl` (built by main from `buildManualInstallerUrl`).
  - LAN links: `window.open` paths for join/invite URLs hit the
    `setWindowOpenHandler` gate; the existing policy test pins
    `http://10.0.0.1:3738/join` → allowed, which this plan must preserve.

- `lib/window-open-policy.test.mjs` — current pins:

  ```js
  test('isAllowedExternalUrl allows http and https', () => {
    assert.equal(isAllowedExternalUrl('https://example.com/path'), true);   // ← will flip to false
    assert.equal(isAllowedExternalUrl('http://10.0.0.1:3738/join'), true);  // ← must stay true
    assert.equal(isAllowedExternalUrl('HTTPS://GitHub.com'), true);         // ← must stay true
  });
  ```

- Conventions: `lib/*.cjs` CommonJS, plain functions, colocated `*.test.mjs`.
  `lib/window-open-policy.cjs` is currently lint-clean (0 problems) — keep it
  that way.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `node --test lib/window-open-policy.test.mjs` | `# fail 0` |
| Adjacent suites | `node --test public/js/stable-downgrade-ui.test.mjs public/js/update-helpers.test.mjs` | `# fail 0` |
| Lint | `npx eslint lib/window-open-policy.cjs` | 0 problems |
| Debt gate | `npm run metrics:check` | `metrics:check OK` expected (touched file is clean) |

## Scope

**In scope** (the only files you should modify):
- `lib/window-open-policy.cjs`
- `lib/window-open-policy.test.mjs`
- `main.js` (one line: route `open-downgrade-installer` through the policy)

**Out of scope** (do NOT touch):
- `public/js/stable-downgrade-ui.mjs`, `public/js/features/platform/updater.mjs` —
  their URLs are already in the allowlist classes; no renderer changes.
- The `sesion-ingreso://` custom-scheme handlers in `main.js`.
- CSP, LAN plaintext, or any other documented security acceptance.

## Git workflow

- Branch: `advisor/016-window-open-allowlist`
- Commit (conventional): `fix(security): hostname allowlist for external URL opens`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement the real allowlist

Replace the body of `lib/window-open-policy.cjs` with a `URL`-parsing policy.
Allowed, exactly:

1. `https:` URLs whose hostname is `github.com` or ends with `.github.com`
   (release asset downloads redirect through `objects.githubusercontent.com` —
   include `githubusercontent.com` and subdomains).
2. `http:` or `https:` URLs whose hostname is a private/ward address:
   `localhost`, `127.0.0.1`, RFC1918 ranges (`10.*`, `172.16-31.*`,
   `192.168.*`), link-local `169.254.*`, or `*.local` (mDNS).

Shape (match the file's existing comment style; keep functions small —
this is a Tier-1 file with complexity ≤15 per function):

```js
function isPrivateLanHost(hostname) { /* the range checks above */ }
function isAllowedExternalHost(protocol, hostname) { /* classes 1 + 2 */ }
function isAllowedExternalUrl(url) {
  if (typeof url !== 'string') return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return isAllowedExternalHost(u.protocol, u.hostname.toLowerCase());
}
```

Export `isAllowedExternalUrl` exactly as before (same name — `main.js` imports
it at line 19).

**Verify**: `node -e "const {isAllowedExternalUrl}=require('./lib/window-open-policy.cjs'); console.log(isAllowedExternalUrl('https://github.com/mausalas99/r-mas/releases'), isAllowedExternalUrl('http://10.0.57.52:3738/join'), isAllowedExternalUrl('https://example.com/x'))"` → `true true false`.

### Step 2: Update the policy tests

In `lib/window-open-policy.test.mjs`:
- `https://example.com/path` now asserts `false` (this documents the tightening).
- Keep/extend: `http://10.0.0.1:3738/join` true, `HTTPS://GitHub.com` true.
- Add: `https://objects.githubusercontent.com/...` true,
  `http://192.168.1.20:3738/mobile/?token=x` true, `http://172.20.0.5:3738` true,
  `http://172.32.0.1` **false** (just outside the 172.16/12 range),
  `http://rplus-host.local:3738` true, `https://evil.github.com.attacker.io` **false**,
  `file:///etc/passwd` false (existing), `javascript:alert(1)` false (existing).

**Verify**: `node --test lib/window-open-policy.test.mjs` → `# fail 0`.

### Step 3: Gate the downgrade-installer open

In `main.js` `open-downgrade-installer` (~line 414–423), wrap the open:

```js
if (!isAllowedExternalUrl(url)) return { ok: false, url };
await shell.openExternal(url);
```

**Verify**: `grep -n "openExternal" main.js` → every `http(s)` open site is
preceded by an `isAllowedExternalUrl` check (the two `sesion-ingreso://` sites
at ~465–467 are the only ungated ones).

### Step 4: Adjacent suites

**Verify**: `node --test lib/window-open-policy.test.mjs public/js/stable-downgrade-ui.test.mjs main-lan-boot.test.mjs` → `# fail 0`.

## Test plan

- Step 2 covers the matrix: both allowed classes, range boundaries (172.15 vs
  172.16 vs 172.32), lookalike-host attacks, scheme attacks.
- Pattern: existing `node:test` cases in `lib/window-open-policy.test.mjs`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test lib/window-open-policy.test.mjs public/js/stable-downgrade-ui.test.mjs main-lan-boot.test.mjs` → `# fail 0`.
- [ ] Step 1's `node -e` probe prints `true true false`.
- [ ] `npx eslint lib/window-open-policy.cjs` → 0 problems.
- [ ] `npm run metrics:check` → `metrics:check OK` (`main.js` is not Tier-1; `window-open-policy.cjs` starts clean).
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- You find an `openExternal`/`window.open` consumer whose URL host is neither
  GitHub nor LAN (the inventory above would be incomplete — list the site and
  the URL class it needs).
- `electron-updater`'s own flows (outside this policy) appear to depend on
  `isAllowedExternalUrl` — they should not; if a grep says otherwise, report.
- The complexity rule (≤15) forces awkward splitting — prefer a small table of
  range predicates over one mega-conditional; if still stuck, report.

## Maintenance notes

- If the app ever needs to open a new external domain (e.g. hospital intranet
  docs), add the hostname to `isAllowedExternalHost` **with a test** — that is
  the entire process.
- Reviewer should scrutinize: hostname checks use `URL.hostname` (never string
  `includes`), and the `.github.com` suffix check requires a leading dot
  boundary (`h === 'github.com' || h.endsWith('.github.com')`) so
  `evilgithub.com` fails.
- Release-notes line (Spanish, if user-visible behavior is mentioned at all):
  «R+ ahora solo abre enlaces externos de GitHub o de la red del hospital».
