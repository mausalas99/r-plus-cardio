---
type: "core"
name: "Logic Index"
status: "stable"
description: "Parsers, sync engines, and algorithm modules."
---

# Logic Index

| Module | Path | Input → output |
|--------|------|----------------|
| SOME lab parser | `public/js/labs.js`, `labs-*.mjs` (`labs-anion-gap.mjs`: AG / AGc / UAG) | Raw SOME text → structured lab lines |
| Lab historial | `lab-history-auto-store-core.mjs` | Parsed labs → per-patient history |
| BH trends | `public/js/tend-core.mjs`, `labs-bh-trend-parse.mjs` | History → chart series |
| Cultivos | `public/js/labs-cultivo.mjs` | SOME micro sections → isolate rows |
| Doc generators | `lib/doc-generators/note.js`, etc. | Form state → `.docx` bytes |
| LAN bundle merge | `lan-squad/bundle-merge.js` | Peer bundles → merged turn state |
| LAN sync kernel (renderer) | `public/js/features/lan/orchestrator.mjs` (façade) + `conflicts.mjs`, `entity-versions.mjs`, `patient-entries.mjs`, `patient-delete.mjs`, `historia-sync.mjs`, `host-patient-http.mjs`, `live-sync-emit.mjs` | Room join → bundle merge/apply, LWW, typed mutations; characterization: `orchestrator.test.mjs` |
| Conflict LWW | `lan-squad/lww-utils.js`, `lan-conflict-*` | Overlapping edits → winner |
| HC compile | `lib/historia-clinica/compile-narrative.mjs` | HC sections → narrative text |
| Perfil farmacoterapéutico ventana | `public/js/med-pharm-view-window.mjs` | Perfil mensual + `fimiFecha` → columnas visibles cross-mes |
| Clinical safety | `lib/clinical-safety-rules/evaluate.mjs` | Calc input → pass / block |
| Drive import | `lib/drive-import/*.mjs` | Google Doc → HC/eventualidades patch |

**Hub:** [docs/core/08-core-architecture.md](../core/08-core-architecture.md)
