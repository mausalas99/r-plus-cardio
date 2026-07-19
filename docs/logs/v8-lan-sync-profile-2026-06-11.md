# v8 LAN sync profile — 2026-06-11

Track B Task B1 profiling gate. Instrumentation landed in `public/js/features/lan/orchestrator.mjs`; **manual measurement required** before choosing worker (B2a) vs scoped repaint (B2b).

## Setup

1. Dev build: `npm run build:ui` then `npm start` (or hot-reload after source edits).
2. Enable perf logging in DevTools console:
   ```js
   localStorage.setItem('rplus-perf', '1');
   ```
   Reload the app. Measures log as `[R+ perf] <name>: <ms>`.
3. Optional: set `globalThis.__RPLUS_PERF__ = true` for the same effect without localStorage.
4. Journey: two Macs on the same LAN room **or** host with **10+ patient bundle**; trigger reconcile (⇄ join, revision hint, or safety bundle).

## Instrumentation points added

| Measure name | Marks | Location |
|--------------|-------|----------|
| `lan-sync-merge` | `lan-sync-merge-start` / `lan-sync-merge-end` | `profiledMergeLiveSyncFullBundles()` — exposed on push/room bridge as `mergeLiveSyncFullBundles` |
| `lan-sync-bundle-apply` | `lan-sync-bundle-apply-start` / `lan-sync-bundle-apply-end` | `applyLiveSyncMerged()` — full bundle apply after merge |
| `lan-sync-lww-apply` | `lan-sync-lww-apply-start` / `lan-sync-lww-apply-end` | `applyLwwConflictLocally()` — LWW conflict resolution |
| `lan-sync-todos-refresh` | `lan-sync-todos-refresh-start` / `lan-sync-todos-refresh-end` | Post-reconcile todo UI refresh in `applyLiveSyncMerged`; single-entity todo apply in `applyLiveSyncApplied` |

**Note:** Reconcile paths in `push.mjs` and `room.mjs` still import `mergeLiveSyncFullBundles` from `lan-merge-registry.mjs` directly. To profile merge on reconcile, switch those call sites to `bridge().mergeLiveSyncFullBundles(...)` (wired to profiled wrapper) or call `profiledMergeLiveSyncFullBundles` from orchestrator.

## Journeys measured

| Journey | Patients | Host/client | Trigger | Runs |
|---------|----------|-------------|---------|------|
| _(fill in)_ | ≥10 | | LAN reconcile / revision hint | ≥5 |

## Results (median / p95 ms)

**Placeholder — manual measurement required with 10+ patient bundle.**

| Measure | Median (ms) | p95 (ms) | Long tasks ≥50ms? |
|---------|-------------|----------|-------------------|
| `lan-sync-merge` | _TBD_ | _TBD_ | _TBD_ |
| `lan-sync-bundle-apply` | _TBD_ | _TBD_ | _TBD_ |
| `lan-sync-lww-apply` | _TBD_ | _TBD_ | _TBD_ |
| `lan-sync-todos-refresh` | _TBD_ | _TBD_ | _TBD_ |

### Recommended Chrome Performance steps

1. Open **DevTools → Performance**, enable **Screenshots** and **Memory** if needed.
2. Set `rplus-perf=1`, reload, start recording.
3. Trigger LAN reconcile on a 10+ patient room; stop after sync settles.
4. In the timeline, filter **Main** thread for **Long Tasks** (yellow blocks ≥50ms).
5. Cross-check console `[R+ perf]` lines with **User Timing** marks (`lan-sync-*`).
6. Repeat ≥5 runs; record median and p95 per measure name.

## Code changes (2026-06-11, post-instrumentation)

- `push.mjs` / `room.mjs` reconcile paths now call `bridge().mergeLiveSyncFullBundles()` (profiled wrapper).
- Room-join tail no longer calls blanket `refreshAllTodoUIs()` — bundle apply already runs scoped `refreshTodoUIsForPatients`.
- Pendientes LAN apply uses `profiledRefreshTodoUIsAfterReconcile` when todos changed.

## Conclusion: worker needed? scoped repaint enough?

**Default recommendation (pre-profile): proceed with scoped repaint (B2b)** until manual profile shows **≥50ms long tasks** on `lan-sync-merge` or `lan-sync-bundle-apply`.

**Status:** B2b scoped repaint landed in code; worker (B2a) still gated on filled Results table above.

| Outcome | Next task |
|---------|-----------|
| Long tasks ≥50ms on merge/apply | B2a Worker spike |
| Jank from `lan-sync-todos-refresh` / full census repaint | B2b Scoped repaint (partially started) |
| Network wait only | B2c Debounce/delta only; skip worker |

## Recommended fix

1. **Now (B2b):** scoped todo/census repaint — `refreshTodoUIsForPatients` / per-patient refresh instead of blanket `refreshAllTodoUIs` on every reconcile.
2. **If profile shows merge/apply ≥50ms:** B2a worker spike per `docs/superpowers/specs/2026-06-11-v8-lan-sync-workers.md`.
3. **Do not start B2a** until this doc has filled Results with real median/p95 from a 10+ patient journey.
