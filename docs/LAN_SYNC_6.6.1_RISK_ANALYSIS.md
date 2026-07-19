# LiveSync risk analysis — 6.6.1 (LAN sync Phases 0–3)

**Date:** 2026-06-03  
**Scope:** Merge of PR #7 (`cursor/lan-sync-improvements-spec-4d31`) — IM-01 through IM-13.  
**Verdict:** Safe to ship **only with a homogeneous turno** (all stations on 6.6.1 + same host). Do **not** stagger 6.6.0 writers with 6.6.1 peers during guardia.

**Verification (pre-ship):** `npm test` — 1087/1087 pass (including `lan-sync-state`, `lan-merge-registry`, `lan-sync-clinical-ops`, `lan-sync-outbox`, `host-store-clinical-ops-db`, `host-router`).

---

## 1. What changed in the LiveSync hot path

| Layer | Before (6.6.0) | After (6.6.1) |
|-------|----------------|---------------|
| Debounced census/HC/entrega push | WS full `livesync:bundle` **+** HTTP PUT `sync-bundle` | **HTTP PUT only**; on success emits `livesync:revision` hint |
| Peer reaction to remote census change | Often immediate WS bundle merge | Debounced **500ms** → `reconcileLiveSyncRoom` (HTTP GET bundle) |
| Profile / @usuario push | Could `connectLiveChannel` while live → WS drop | `clinical-ops` PUT first; `sendLiveBundleIfOpen` only if socket OPEN |
| Offline queue | `localStorage` `rpc-lan-sync-outbox` | SQLCipher `lan_sync_outbox` (schema **v9**) when DB unlocked; LS fallback |
| Host `clinicalOps` | JSON host state primary | When host SQLCipher unlocked: merge/export from DB; refresh stale cache on GET bundle |
| Code layout | ~3.1k-line `features/lan-sync.mjs` | Facade + `lan-sync-{push,room,transport,panel,runtime}.mjs` |

**Unchanged (low regression surface):**

- `livesync:patch` → host `ConflictResolver` → `livesync:applied` (agenda/todo/patient mutations).
- Join / leave / hello flows; hello still pushes a WS bundle to new peers.
- 409 bundle conflicts → diff viewer / drafts.
- Hub-and-spoke topology, SQLCipher local-first model.

---

## 2. Failure modes (how LiveSync can break)

### 2.1 Mixed-version turno (HIGH — operational)

**Scenario:** Some Macs on **6.6.0**, some on **6.6.1** during the same guardia.

| Direction | Symptom | Mechanism |
|-----------|---------|-----------|
| 6.6.0 → 6.6.1 | Usually OK | Old peer still sends WS `livesync:bundle`; 6.6.1 still merges bundles on wire |
| 6.6.1 → 6.6.0 | **Broken / delayed** | 6.6.1 debounced push = HTTP + `livesync:revision` only; **6.6.0 ignores revision**; no WS bundle → old peer never reconciles until manual edit, rejoin, or full bundle from another old peer |

**Affected operations** (call `scheduleLiveSyncPush`, not patch mutations):

- Patient save hooks (`registerLanSaveHooks` — labs/notes side effects).
- `patients.mjs` census saves.
- Historia clínica panel, eventualidades, modo entrega, clinical teams refresh.

**Not affected:** Todo/agenda/patient **patch** edits (`sendLiveSyncMutation`).

**Mitigation:** Upgrade **every** station the same day; host Mac included. Release notes must say 6.6.0 + 6.6.1 mixed is unsupported.

---

### 2.2 Revision-hint race / latency (MEDIUM — UX)

**Scenario:** Two 6.6.1 peers edit census within ~500ms.

- Both PUT; both emit `livesync:revision`.
- Peers debounce reconcile to **500ms** (`scheduleReconcileFromRevisionHint`).
- Worst case: peers see updates **~0.9s debounce + 0.5s reconcile + HTTP** later than old instant WS bundle (~1–2s total vs near-real-time).

**Not data loss** if HTTP succeeds; feels like “LAN lag”.

**Edge case:** If HTTP PUT fails and outbox queues, peer only gets hint when another successful PUT happens — monitor outbox in diagnostics (IM-09).

---

### 2.3 SQL schema v9 migration (MEDIUM — startup)

**Scenario:** First unlock after upgrade; `lan_sync_outbox` migration fails.

- **Symptom:** Clinical DB unlock/migration error (whole app, not only ⇄).
- **Mitigation:** Test unlock on copy of production `rplus-clinical.db` before ward rollout; `lib/db/schema.test.mjs` covers v9.

**Fallback:** If IPC unavailable, renderer logs once and uses **localStorage** outbox (same as 6.6.0) — queue not durable across profile wipe.

---

### 2.4 Host IM-13 dual persistence (MEDIUM — directorio)

**Scenario:** Host Mac runs squad with SQLCipher **unlocked** but DB merge path errors.

- `putRoomClinicalOps` / `putRoomSyncBundle` may write JSON bundle **and** DB; stale `clinicalOps` in JSON refreshed on `getRoomSyncBundle` when DB newer.
- **Symptom:** Directorio on host ≠ clients until reconcile; rare if DB export fails silently.

**Mitigation:** Host should be the same 6.6.1 build; keep host DB unlocked consistently; `host-store-clinical-ops-db.test.js` covers unlocked path.

**Scenario:** Host DB **locked** — behavior matches 6.6.0 (JSON only).

---

### 2.5 Module split / bridge init (LOW — catastrophic if hit)

**Scenario:** `registerLanSyncPushBridge` / `registerLanSyncRoomBridge` not called before first push.

- **Symptom:** Immediate throw `lan-sync-push: registerLanSyncPushBridge() not called` — LAN dead on boot.
- **Mitigation:** Bridges registered at bottom of `features/lan-sync.mjs` before exports; `app-boot-imports` / bundle order unchanged (only `lan-sync.mjs` entry).

---

### 2.6 Merge registry semantic drift (LOW)

**Scenario:** `lan-merge-registry.mjs` delegates differ from pre-split merge.

- **Symptom:** Subtle merge bugs (agenda/todos/patients/clinicalOps/manejo).
- **Mitigation:** Golden tests in `lan-merge-registry.test.mjs`; `live-sync-room.test.mjs` pass.

---

### 2.7 Pinned host / confirm auto-join (LOW — perceived “broken sync”)

| Change | Misread as broken sync |
|--------|-------------------------|
| IM-08 Pinned host | Client still points at old host IP — no connect until user confirms switch |
| IM-10 Confirm inferred sala | Changing `clinicalSala` in settings no longer auto-joins wrong room — user must confirm once per session |

These are **intentional**; document in ward rollout.

---

### 2.8 `liveSyncBundleHasPayload` false negative (LOW)

**Scenario:** Push skipped because bundle “empty” but `clinicalOps` only change.

- **Mitigation:** `pushClinicalOpsLanNow` always sets `envelope.clinicalOps = snap` and uses `/clinical-ops` endpoint; tests assert this.

---

## 3. What we expect to improve (why ship)

1. Fewer spurious WS reconnects on @usuario save (IM-01).
2. Less duplicate full-bundle traffic → fewer 409s and merge churn (IM-05).
3. Durable outbox across restart when DB unlocked (IM-06).
4. Smaller/faster directory pushes (IM-07).
5. Ward-debuggable ⇄ panel (IM-09).
6. Safer host switching (IM-08).

---

## 4. Pre-ship checklist (manual, ~20 min, 2 Macs + host)

1. **Homogeneous:** Both clients 6.6.1, same `teamCode`, same sala.
2. **Join:** A joins sala → B joins → both show phase `live` in diagnostics.
3. **Patch path:** A adds todo → B sees &lt;2s.
4. **Bundle path:** A saves patient census field → B sees &lt;3s (allow debounce+reconcile).
5. **@usuario:** A registers handle with ⇄ live → B directorio updates; DevTools WS stays open.
6. **Offline:** A offline edit → reconnect → outbox drains (diagnostics count → 0).
7. **409:** Force conflict (if possible) → viewer still opens.
8. **Host:** Host unlocked → directorio consistent after push; restart host app → still consistent.
9. **iPad link:** Copy invite twice → both work; expiry shown.
10. **Windows:** One PC on 6.6.1, firewall 3738, joins Mac host.

---

## 5. Rollback

- Downgrade via Ajustes → stable catalog to **6.6.0** only after turno ends (avoid mixed versions).
- Schema v9 is forward-only; older app ignores `lan_sync_outbox` table.
- JSON host state remains; DB clinical ops on host is additive cache.

---

## 6. References

- Design: `docs/superpowers/specs/2026-06-03-lan-sync-improvements-design.md`
- Plan: `docs/superpowers/plans/2026-06-03-lan-sync-improvements.md`
- Release notes: `docs/RELEASE_NOTES_6.6.1.txt`
