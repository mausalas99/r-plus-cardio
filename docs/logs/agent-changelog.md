# Agent Changelog

Chronological record of documentation and integration work. Format per `documentation-architecture-assessment` skill.

## Summary

| Date | Task | Key paths | Outcome |
|------|------|-----------|---------|
| 2026-07-15 | Release 7.6.9 prepare — gasometría highlight fix | `labs-gaso-section.mjs`, `lab-history-maint.mjs`, `lab-panel-history.mjs`, `RELEASE_NOTES_7.6.9.txt`, `release-notes-highlights.mjs` | Fix reprocess stripping GASES asterisks; bump 7.6.9; metrics:check OK; release notes + highlights filled. |
| 2026-07-06 | Equipos push return fix (local dev) | `cloud/equipos-worker/src/{push,routes}.js`, `public/equipos/equipos-sw-push.js`, `equipos-push.mjs` | Push send loop deduped into logged helper (sent/pruned/failed per sub); `/return`+push routes await dispatch on localhost (wrangler dev drops `waitUntil`); SW v20 with push-event log. Verified: return → FCM 201 `lumify_return`. |
| 2026-07-02 | LAN bundled auto-connect | `lan-ward-host-registry.mjs`, `panel-scan-hosts.mjs`, `lan-shift-pin-connect.mjs`, `lan-network-change.mjs` | Clients without bearer probe shipped ward URL; scan loop + boot/roam bypass; no PIN/code entry. |
| 2026-06-30 | Release 7.5.7 EA suplemento | `estado-actual-meds-diet.mjs`, `docs/RELEASE_NOTES_7.5.7.txt`, `release-notes-highlights.mjs` | Fix confirm suplemento re-proposal; bump/publish v7.5.7 to GitHub Releases. |
| 2026-06-26 | Release 7.5.2 prepare | `docs/RELEASE_NOTES_7.5.2.txt`, `estado-actual-panel-snapshot-*`, `estado-actual-vital-history-modal.mjs`, `med-receta-parse.mjs`, `release-notes-highlights.mjs` | EA signos en filas + modal historial, SOAP última lectura/PICO, SOME ayuno, traqueostomía; bump 7.5.2; metrics:check OK (no Tier-1 ratchet vs main). |
| 2026-06-25 | VibeDrift phases 0–5 | `.vibedriftignore`, `@vibedrift/cli`, `package.json`, `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `.agents/skills/vibedrift/` | Scan hygiene, arch/DI/dom-escape/equipos dedup; CI `vibedrift:check` floor 55; optional pre-push hook documented. |
| 2026-06-24 | LAN ⇄ + Ajustes panel redesign | `settings.css`, `panel-render-once.mjs`, `settings-dropdown.html`, `lan-hub-panel-shell.mjs`, `panel-host-pin.mjs` | Hero status/PIN, unified stack rows, Ajustes ghost buttons; spec `2026-06-24-lan-settings-panel-redesign-design.md`. |
| 2026-06-23 | Equipos cloud (CF Worker) | `cloud/equipos-worker/`, `equipos-cloud-config.mjs`, `equipos-qr-panel.mjs`, `equipos-board.mjs` | Standalone queue on Worker+D1+R2; desktop cloud config + admin API; mobile cloud mode via `__EQUIPOS_API_MODE__`. |
| 2026-06-23 | Equipos tracking (Lumify/EKG/US) | `lib/equipos/`, `public/equipos/`, schema v18, `equipos-router.js`, `equipos-board.mjs` | Program-wide custody queue, mobile `/equipos`, host DB, photo purge, temp host failover, R4 purge. |
| 2026-06-21 | Debt Phase 5c+6 + baseline refresh | `scripts/metrics/baseline.json`, `lazy-feature-routes-*`, LAN/interno god splits, `fix-mechanical-eslint.mjs --full` | `lint:tier1:full` exit 0; `totalScore` 31408→50 (boot graph structural); boot P5c deferrals complete. |
| 2026-06-20 | SQLCipher single runtime (Electron-as-Node tests) | `scripts/run-with-electron-node.mjs`, `package.json`, `test-manifest.mjs`, `CLAUDE.md`, `project-context.mdc` | Removed pretest/posttest ABI swap; `npm test` / `test:one` run under Electron Node 24 (abi 145) — same `.node` as app. |
| 2026-06-20 | SQLCipher native ABI root fix | `lib/native-runtime-probe.js`, `scripts/lib/sqlcipher-native.mjs`, `rebuild-native-db.mjs`, `ensure-native-db-for-node.mjs`, `fetch-sqlite-electron.mjs`, `package.json` | Probe opens `:memory:` (lazy .node load); Electron binary cached; prestart strict restore. |
| 2026-06-20 | Hallmark UI audit tracks 1–4 | `public/tokens.css`, `public/styles/{modals,layout,soft-ui,lab,pase-board}.css`, `public/interno/`, `estado-actual-*`, `command-palette.mjs`, `todos.mjs`, `guardia-vitals-feed.mjs` | Tracks 1–4 shipped: scrim/z-index/dvh, radius tiers, lab/pase hex→tokens (0 hex), empty-state parity; `build:ui:check` + `metrics:check` OK. |
| 2026-06-20 | Release 7.3.8 prepare | `docs/RELEASE_NOTES_7.3.8.txt`, `labs.js`, `estado-actual-io.mjs`, `db-unlock.mjs`, `release-notes-curated.mjs` | COAG section split; EA balance NC; DB boot toast; SQLCipher script hardening; bump 7.3.8; metrics OK; 27 targeted tests pass. |
| 2026-06-14 | Release 7.3.7 prepare | `docs/RELEASE_NOTES_7.3.7.txt`, LAN patient delete fix, `expediente-tabs.mjs`, `release-notes-curated.mjs` | Registro-reuse LAN delete bugfix; Drive import in clínico nav bar; bump 7.3.7. |
| 2026-06-13 | Release 7.3.6 prepare | `docs/RELEASE_NOTES_7.3.6.txt`, `release-notes-curated.mjs`, `README.md`, plans 010–020 | LAN client identity, orchestrator split, cultivo superset, IPC tests, quarantine drain; bump 7.3.6 on main. |
| 2026-06-12 | Advisor cycle 2 — LAN orchestrator split + IPC tests | `features/lan/{orchestrator,conflicts,entity-versions,patient-delete,patient-entries,historia-sync,host-patient-http,live-sync-emit}.mjs`, `lib/db/ipc-handlers.test.mjs` | Orchestrator 2,207→1,185 lines (move-only + `configure*` DI); 13 DB IPC integration tests; plans 010–020 DONE; metrics 14,540. |
| 2026-06-11 | Release 7.3.2 prepare | `docs/RELEASE_NOTES_7.3.2.txt`, `release-notes-curated.mjs`, `README.md` | Bump 7.3.2 (Premium UI + EA charts + hardening); npm test 1519 pass ~35s (explicit 199-file list); README bump regex fix in `release.js`. |
| 2026-06-11 | Premium UI closeout — plan bookkeeping | `docs/superpowers/plans/` (phase 2/3/4/5 plans) | Phase 2 marked SHIPPED with J/K hint DROPPED (shortcut never existed); Phase 4 triage closed (CI green on all main pushes); CSP manual pass closed via static scan (`'unsafe-inline'` shipped — inline styles cannot violate); iPad LAN smoke flagged as the sole remaining device-QA item. |
| 2026-06-11 | Premium UI Phase 6 — procesarLabs decomposition (audit M2.2) | `public/js/labs.js`, `public/js/labs-procesar-*.{mjs,json}`, `scripts/capture-procesar-labs-goldens.mjs` | Characterization goldens (4 fixtures) lock output; parser split into header/segmentation/pipeline helpers, all ≤ complexity 15; zero output diffs; labs.js complexity flags 40 → 38, debt score 14195 → 14193. |
| 2026-06-11 | Premium UI Phase 5 — hardening (audit M1+M2) | `window-open-policy.cjs`, `lan-db-bridge.cjs`, `session-clinical-wipe.mjs`, CSP meta, `.gitignore` bundles | window.open allowlist, DB injection bridge, dead storage writers removed, mobile PHI wipe, bundles untracked, CI `build:ui`. |
| 2026-06-11 | Premium UI Phase 4 — safety net (audit M0) | `.github/workflows/ci.yml`, `package.json`, `.gitignore` | GitHub Actions CI + gitlink cleanup. Glob runner (`scripts/run-tests.mjs`) reverted — 323 files in one `node --test` is too slow for local/agent use; targeted `node --test <file>` locally, full `npm test` on CI/release only. |

| 2026-06-11 | Premium UI Phase 3 — mobile + interno | `mobile-surfaces.css`, `group-row.css`, `expediente-group-row-ui.mjs`, `interno/interno.css`, `interno/index.html` | Mobile: grouped row + tap-to-expand at all widths, ≥44px targets, token surfaces. Interno: shared tokens + glass sheets. 1509 tests pass. |

| 2026-06-11 | Premium UI desktop surface rollout (T1–T7) | `workbench-surfaces.css`, `expediente.css`, `lab.css`, `pase-board.css`, `overlays.css`, `settings.css`, `modals.css` | Workbench Refinado: expediente/lab/sidebar/pase/guardia/manejo/agenda overlays; glass parity on settings dropdown, tour dock, learn hub. CSS-only. 1509 tests pass. |

| 2026-06-11 | Premium UI Phase 2 — navigation rework | `expediente-group-row*.mjs`, `header-context.mjs`, `command-palette*.mjs`, `fuzzy-match.mjs`, `group-row.css`, `cmdk.css`, `chrome.mjs`, `profile.mjs`, `layout.css` | Grouped expediente pill row (≥1100px) + narrow fallback; context header; segmented mode selector; ⌘K fuzzy palette; header search icon-only (magnifying glass); granular tab path removed. 1509 tests pass. |

| 2026-06-10 | Phase 1 design system foundation | `public/tokens.css`, `public/styles/base.css`, `public/styles/overlays.css`, `public/js/motion-mode.mjs` | Design system foundation complete — elevation tokens, type scale, motion presets (sobrio/mixto/expresivo), glass overlays, core chrome CSS tokenization |
| 2026-06-10 | Release 7.3.1 prepare | `medications.mjs`, `med-receta-core.mjs`, `med-pharm-profile-panel.mjs`, `docs/RELEASE_NOTES_7.3.1.txt` | Manejo modal SOME, AAS SOAP, borrar perfil, EA dieta; bump 7.3.1 |
| 2026-06-10 | Release 7.3.0 prepare | `med-pharm-view-window.mjs`, `teams-roster-lan.mjs`, `lab-panel.mjs`, `docs/RELEASE_NOTES_7.3.0.txt` | Perfil cross-mes, directorio LAN v17, lab historial, censo PDF; bump pendiente usuario |
| 2026-06-10 | Perfil histórico ventana dinámica | `med-pharm-view-window.mjs`, `med-pharm-profile-panel.mjs`, `pase-board.mjs` | Cross-mes grilla + FAB Copiar context-aware; spec/plan 2026-06-10 |
| 2026-06-10 | Release 7.2.9 prepare | `med-receta-core.mjs`, `medications.mjs`, `estado-actual-*`, `docs/RELEASE_NOTES_7.2.9.txt` | Manejo parser dietas/P2, propuesta dieta EA, bump + commit |
| 2026-06-08 | Docs hub + North Star integration | `docs/core/`, `.cursor/rules/` | Agent-first documentation library wired to Cursor rules |

---

## [2026-06-25] - VibeDrift phases 0–5

**Agent:** Cursor (Composer subagent)

**Scope:** Phase 0 `.vibedriftignore` hygiene; phases 1–4 arch/DI, `dom-escape`, equipos shared modules; Phase 5 CI gate + agent workflow.

**Paths:** `@vibedrift/cli@0.14.0`, `vibedrift:scan`/`vibedrift:check`, `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `.agents/skills/vibedrift/`.

**Verification:** `node .agents/skills/vibedrift/scripts/vibedrift-tools.mjs intent --root .`; `npm run vibedrift:check`.

---

## [2026-06-20] - Hallmark UI audit tracks 1–4

**Agent:** Cursor (Composer subagent wrap-up)

**Tracks completed:**
1. Scrim/z-index/dvh viewport tokens + interno skip link
2. Empty-state parity (EA, cmdk, todos, charts, guardia vitals)
3. Lab/pase-board hex → design tokens (0 hex remaining)
4. Radius hierarchy (soft-ui tiers)

**Spec:** `docs/superpowers/specs/2026-06-20-hallmark-ui-audit-tracks-design.md`

**Verification:** `npm run build:ui:check` pass; `npm run metrics:check` pass (totalScore=14690).

---

## [2026-06-08] - Documentation hub & North Star integration

**Agent:** Cursor (Composer)

**Files Modified:**
- `docs/core/00-system-index.md` through `18-knowledge-capture.md` (new hub)
- `docs/features/features-index.md`, `docs/logic/logic-index.md`, `docs/database/database-index.md`
- `docs/logs/agent-changelog.md`
- `docs/README.md`
- `docs/vision-north-star.md` (redirect stub)
- `.cursor/rules/product-north-star.mdc`, `.cursor/rules/documentation-sync.mdc`
- `.cursor/rules/project-context.mdc`

**Database Changes:** None

**Summary:** Bootstrapped vibe-app-wiki documentation architecture: master hub at `docs/core/00-system-index.md`, canonical North Star at `docs/core/01-vision-north-star.md`, category indices linking to existing `docs/superpowers/` specs, and always-on Cursor rules so agents check product trade-offs before feature work and sync indices on architectural changes.
