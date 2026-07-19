---
type: "core"
name: "Product Context"
status: "stable"
dependencies: ["01-vision-north-star"]
description: "Personas, clinical domain, and product boundaries for R+."
---

# Product Context: R+

R+ serves **Hospital Universitario** guardia and sala workflows. It is a **coadyuvante** (adjunct) for documentation and lab extraction—not the hospital's certified EMR.

## Primary persona

**R1/R2 resident on a 24-hour guardia**

- Manages patients across urgencias and sala
- High cognitive load, frequent handoffs
- Needs: fast SOME → note pipeline, shared turn census, minimal tool friction
- Success = lower **Time-to-Document (TTD)** and trusted **LiveSync** census

## Secondary personas

| Role | Need from R+ |
|------|----------------|
| R4 / Admin | Ward census, host election, rotation config, directorio LAN |
| R3 | Team handoff, entrega phases, optional host escalation |
| Interno (mobile) | Vitals/glucometry board → sync to guardia |
| iPad sharer | Mirror turn via `/mobile/` without full desktop UI |

## Clinical modes

| Mode | Primary surfaces |
|------|------------------|
| **Sala** | Estado actual, HC ingreso, eventualidades, listado, censo guardia |
| **Interconsulta** | Nota, indicaciones, VPO, receta HU |
| **Modo Pase** | Round board; expediente opens in tabbed detail |

## Domain glossary (short)

| Term | Meaning |
|------|---------|
| SOME | Hospital lab report text format (paste source) |
| LiveSync / ⇄ | LAN sync on port 3738; Wi‑Fi icon in header |
| PIN del turno | ~12h reusable join code for the shift |
| @usuario | LAN clinical identity (distinct from display name in guardia) |
| Anfitrión | Single turn host holding authoritative bundle |

## Roadmap horizons

Aligned with [01-vision-north-star.md](./01-vision-north-star.md#-development-horizons):

- **NOW:** LiveSync stability, guardia board, host persistence
- **NEXT:** Guardia v7 workbench, Learn Hub, teams/handoffs
- **LATER:** RBAC, TLS, institutional pilot boundaries

## Related

- [03-user-journey.md](./03-user-journey.md)
- [16-glossary-of-terms.md](./16-glossary-of-terms.md)
