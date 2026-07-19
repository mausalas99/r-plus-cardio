---
type: "core"
name: "Database Index"
status: "stable"
description: "SQLCipher clinical store — schema, migrations, outbox."
---

# Database Index

**Canonical schema:** `lib/db/schema.mjs` (currently **v21**).

## When to read which file

| Task | File |
|------|------|
| Schema bump / migration | `lib/db/schema.mjs`, `lib/db/schema.test.mjs` |
| Open / unlock DB | `lib/db/db-manager.mjs`, `lib/db/crypto.mjs` |
| Clinical session / roles | `lib/db/clinical-access-db.mjs`, `clinical-privileges.mjs` |
| LAN SQL outbox | `lib/db/lan-sync-outbox.mjs` |
| Clinical ops sync | `lib/db/clinical-ops-sync.mjs` |
| Forensic audit | `lib/db/forensic-audit.mjs`, `audit-hooks.mjs` |
| IPC from renderer | `lib/db/ipc-handlers.mjs` — integration tests: `lib/db/ipc-handlers.test.mjs` (fake `ipcMain`, `createUnlockedDbManager`) |

## Key tables (conceptual)

| Area | Tables / concepts |
|------|-------------------|
| Patients & clinical | Encrypted patient store, HC, estado |
| LAN outbox | `lan_sync_outbox` — delta, command, bundle kinds |
| LAN host (v15) | `lan_host_meta`, `lan_room_bundles`, `lan_bundle_entries`, `lan_lab_sets` — normalized ward state when DB unlocked |
| Clinical ops | Users (`last_activity_at` v16, backfill v17), teams, guardia metadata |
| Audit | Chained integrity log (expand in LATER horizon) |

## Rules

- Bump `SCHEMA_VERSION` on breaking changes; always add migration + test.
- Host may mirror `clinicalOps` to SQLCipher when DB unlocked (`host-store.js`).

**Hub:** [docs/core/08-core-architecture.md](../core/08-core-architecture.md)
