---
type: "core"
name: "Knowledge Capture"
status: "stable"
description: "Decision log for product and architectural choices."
---

# Knowledge Capture & Decision Log

Records key decisions so agents and humans stay aligned with [01-vision-north-star.md](./01-vision-north-star.md).

## Decision Log

| Date | Theme | Decision / Suggestion | Impact |
| :--- | :--- | :--- | :--- |
| 2026-06-08 | Product Strategy | North Star: *"Paste the lab, print the note—before the next patient calls."* Primary metric: TTD. Ideal user: R1/R2 on 24h guardia. | All feature proposals must shorten TTD or improve LiveSync trust |
| 2026-06-08 | Product Strategy | Magic moment = SOME paste → structured data → `.docx` note (not LAN board alone) | Prioritize lab parser + doc export pipeline over peripheral UI |
| 2026-06-08 | Architecture | Local-first / LAN only; cloud PHI is anti-goal | No SaaS sync proposals |
| 2026-06-08 | Clinical Safety | Manejo automático retired (v7.1.2); human-in-the-loop over velocity | No autonomous treatment suggestions |
| 2026-06-08 | Documentation | Adopt vibe-app-wiki docs hub at `docs/core/00-system-index.md` | Agents read vision + project-context before exploring code |
| 2026-06-08 | Trade-offs | Fluidity > stability theater; sync reliability > departmental breadth | Reject features that add resident tool-management time |
