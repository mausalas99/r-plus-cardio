---
type: "core"
name: "User Journey"
status: "stable"
dependencies: ["01-vision-north-star", "02-product-context"]
description: "Primary happy-path flows from the clinician's perspective."
---

# User Journey: R+

## Onboarding (first shift)

1. Install R+ from GitHub Releases (Mac `.dmg` / Windows `.exe`).
2. Choose sync mode: **sala LAN** or **solo mi equipo**.
3. Register **@usuario**, rango (R1–R4), sala/guardia.
4. Unlock SQLCipher clinical DB (local-first).
5. Optional: open **⇄** → PIN del turno or join host → turn sync live.

## Happy path — Magic moment (documentation)

1. Select patient in sidebar.
2. Open **Laboratorio** → paste SOME report → **Procesar**.
3. Review structured results, tendencias, cultivos in **Expediente → Resultados**.
4. Open **Clínico → Nota** (or Estado actual in Sala) → generate **`.docx`**.
5. Print or attach per hospital workflow.

*North Star:* steps 2–4 complete in minimum wall-clock time (TTD metric).

## Happy path — Turn sync (team)

1. R4/admin or elected host runs R+ with LiveSync active.
2. Residents join via **PIN del turno** or invitation link.
3. Census, clinical-ops, HC deltas sync without silent overwrite (LWW + diagnostics).
4. Handoff via **Modo Entrega** / guardia phase bar when shift changes.

## Error recovery

| Situation | User action |
|-----------|-------------|
| Lost host | ⇄ → Reconectar / Restablecer conexión / paste host URL |
| Conflict | LWW toast; optional draft review in Ajustes → LAN |
| Offline | Local edits queue in SQL outbox; flush on reconnect |

## Related

- Feature map: [features/features-index.md](../features/features-index.md)
- LAN architecture: [08-core-architecture.md](./08-core-architecture.md)
