---
type: "core"
name: "Features Index"
status: "stable"
description: "Map of user-facing feature domains to source paths."
---

# Features Index

When adding a feature, create `feat-<name>.md` here and link from this table.

| Feature | Code path | Doc / spec |
|---------|-----------|------------|
| Laboratorio / SOME | `public/js/labs*.mjs`, `lab-panel.mjs` | Magic moment pipeline |
| Lab repo import | `lib/lab-repo/`, `public/js/features/lab-repo-import.mjs` | [spec](../superpowers/specs/2026-06-27-lab-repo-scraper-design.md) |
| Tendencias | `public/js/features/tendencias.mjs` | |
| Expediente / tabs | `public/js/expediente-tabs.mjs` | |
| Estado actual | `public/js/features/estado-actual-*.mjs` | [spec](../superpowers/specs/2026-05-26-estado-actual-monitoreo-design.md) |
| Historia clínica | `lib/historia-clinica/`, expediente Sala | [spec](../superpowers/specs/2026-05-31-historia-clinica-institutional-format-design.md) |
| VPO | `public/js/features/vpo.mjs`, `vpo-*.mjs` | [spec](../superpowers/specs/2026-05-29-vpo-design.md) |
| Medicamentos / receta | `public/js/med-receta-core.mjs` | |
| Document export | `lib/doc-generators/`, `document-export-client.mjs` | [spec](../superpowers/specs/2026-05-30-native-document-generation-design.md) |
| LiveSync / LAN | `public/js/features/lan/`, `lan-squad/` | [spec](../superpowers/specs/2026-06-03-lan-sync-improvements-design.md) |
| Guardia board | `public/js/features/guardia-board.mjs`, `guardia-phase-bar.mjs` | [spec](../superpowers/specs/2026-06-05-guardia-panel-overhaul-design.md) |
| Modo entrega | `lib/entrega/`, `clinical-entrega.mjs` | |
| Clinical teams | `public/js/features/clinical-teams/` | |
| Onboarding / Learn Hub | `clinical-onboarding*.mjs`, `learn-hub.mjs` | |
| Interno mobile | `lib/interno/`, `public/interno/` | [spec](../superpowers/specs/2026-06-02-interno-guardia-mobile-design.md) |
| Equipos (Lumify/EKG/US) | `lib/equipos/`, `public/equipos/`, `cloud/equipos-worker/`, `equipos-cloud-config.mjs` | [spec](../superpowers/specs/2026-06-23-equipos-tracking-design.md); cloud deploy: `cloud/equipos-worker/README.md` |
| Settings / tours | `public/js/features/settings-help/` | |
| Platform / backup | `public/js/features/platform/` | |

**Hub:** [docs/core/00-system-index.md](../core/00-system-index.md)
