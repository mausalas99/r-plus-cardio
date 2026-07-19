---
type: "core"
name: "Security"
status: "stable"
description: "LAN perimeter, clinical safety, and institutional remediation roadmap."
---

# Security

R+ is **local-first** with optional **hospital LAN** sync. It is not a certified EMR.

## Implemented (LAN)

- Cryptographic team token (rejects weak codes like `1234`)
- `Authorization: Bearer` on API (no secrets in URLs for routine ops)
- Shift PIN / one-time tickets with TTL
- Rate limiting on API and doc export
- Log redaction (`lan-squad/redact-secrets.js`)

## Implemented (clinical)

- Calculator caps and high-risk rules (`lib/clinical-safety-rules/`)
- Human confirmation before persisting flagged actions
- Forensic audit hooks on DB (`lib/db/audit-hooks.mjs`, `forensic-audit.mjs`)

## LAN plaintext (formal risk acceptance)

R+ sync and document export on the hospital LAN use **HTTP + WebSocket without TLS**. This is an explicit product trade-off for local-first ward workflows (no cert management on every Mac/iPad).

| Condition | Requirement |
|-----------|-------------|
| Network | Hospital VLAN or isolated Wi‑Fi only — not guest or public Internet |
| Exposure | Port **3738** must not be port-forwarded or reachable from outside the ward |
| Token hygiene | Team bearer + shift PIN; logs redacted (`lan-squad/redact-secrets.js`) |
| PHI at rest (web) | iPad/Safari clients wipe clinical `localStorage` on session end (`session-clinical-wipe.mjs`) |

**Revisit trigger:** IT offers managed TLS (WSS) on the VLAN, or an audit finds LAN exposure beyond the ward perimeter. See [remediation spec](../superpowers/specs/2026-05-30-r-plus-security-architecture-remediation-design.md).

## Legacy recovery passphrase

The `'r+123'` recovery path remains for field support. Sunset when `legacy: true` unlock events stop appearing in forensic audit exports.

## Known boundaries (honest)

| Gap | Mitigation today | Roadmap |
|-----|------------------|---------|
| HTTP without TLS on LAN | Accepted risk (table above) | WSS + IT certs ([remediation spec](../superpowers/specs/2026-05-30-r-plus-security-architecture-remediation-design.md)) |
| Shared turn token | Shift-level access | RBAC per user (LATER) |
| Adjunct not EMR | Product positioning | Institutional agreement |

## Anti-goals (security-related)

See [01-vision-north-star.md](./01-vision-north-star.md#-out-of-bounds-anti-goals): no cloud PHI, no unmanaged Internet exposure.

## Related

- Presentation limits: [presentacion-r-plus-gemini-slides.md](../presentacion-r-plus-gemini-slides.md)
