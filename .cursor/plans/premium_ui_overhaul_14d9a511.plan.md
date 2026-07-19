---
name: Premium UI Overhaul
overview: "App-wide premium UI pass for R+: finish and unify the existing Hallmark \"premium\" foundation (tokens, elevation, glass), add a real motion + skeleton system, fix perceived-speed killers (FOUC, instant modals, text loaders), and consolidate components — evolving the Quiet Workbench language without breaking dark/HC themes or the motion-sobrio knob."
todos:
  - id: phase0-fouc
    content: Inline theme/motion/density boot script in index.src.html + fix theme-color meta (kill dark FOUC)
    status: pending
  - id: phase0-modal-exit
    content: Add modal-out/fade-out keyframes + closeModalAnimated helper; adopt in main modal backdrops
    status: pending
  - id: phase0-toasts
    content: "Toast v2: stacking container, enter/exit motion, styled success/error/warn/info variants"
    status: pending
  - id: phase0-selection-focus
    content: Add ::selection styles and fix :focus-visible gaps in modals.css
    status: pending
  - id: phase1-skeleton
    content: Create skeleton.css + ui-skeleton.mjs shimmer primitives (reduced-motion/HC safe)
    status: pending
  - id: phase1-loaders
    content: "Replace text loaders: lab panel skeleton, tendencias, clinical teams, LAN directory; button spinner in setAsyncButtonLoading"
    status: pending
  - id: phase2-motion-tokens
    content: Sweep raw transition durations/easings to --dur-*/--ease-out tokens
    status: pending
  - id: phase2-tab-motion
    content: Opacity cross-fade on main tab panels + animated tab-bar indicator (perf-gated, sobrio-aware)
    status: pending
  - id: phase2-micro-states
    content: Unified hover/press micro-states for cards, chips, buttons in base.css
    status: pending
  - id: phase3-buttons-inputs
    content: Consolidate button + input styles into one canonical layer; delete duplicates
    status: pending
  - id: phase3-modal-contract
    content: Migrate outlier modals to single .modal-backdrop/.open contract with glass treatment
    status: pending
  - id: phase3-layer-war
    content: Fold soft-ui.css !important radii into sources; wire or delete workbench-tokens.css
    status: pending
  - id: phase4-elevation-hex
    content: Adopt --elev-* everywhere; add --danger/--warn/z-index tokens; migrate worst stray hex (pase-board, lab, modals)
    status: pending
  - id: phase4-radius-dark
    content: Normalize literal radii to tokens; dark/HC verification pass; update design.md to phase 5
    status: pending
  - id: docs-spec
    content: Write spec doc 2026-06-11-v8-premium-ui-design.md + project-context changelog entry on commit
    status: pending
isProject: false
---

# Premium UI Overhaul (Hallmark phase 5)

## Context

Audits ([CSS/tokens](7c298e72-eb18-43ea-b1d5-8563f5fc2e81), [interactions](8f10eda7-b385-4c06-9cfe-0b72a3af4588)) show the premium foundation exists in `public/tokens.css` (elevation scale `--elev-*`, motion presets, glass `--overlay-*`) but is under-adopted, and three layers (`soft-ui.css`, `workbench-surfaces.css`, orphan `workbench-tokens.css`) fight each other with `!important`. The biggest premium-feel killers are behavioral, not cosmetic.

This is separate from the in-flight v8 perf plan (`docs/superpowers/plans/2026-06-11-v8-performance-overhaul.md`); board repaint perf stays there. Per `documentation-sync.mdc`, the executed phases land as a spec in `docs/superpowers/specs/2026-06-11-v8-premium-ui-design.md`.

## Phase 0 — Kill the cheap-feeling moments (highest impact/effort)

- **Dark-mode FOUC**: inline `<script>` in `public/index.src.html` head applying `html.dark` / motion / density classes from `localStorage` before first paint (today only JS in `chrome.mjs` does it, after bundle load). Fix stale `<meta name="theme-color" content="#065f46">` → accent.
- **Modal exit animations**: add `modal-out` / backdrop `fade-out` keyframes in `public/styles/motion.css` + a small shared helper `closeModalAnimated(backdropEl)` in `public/js/ui-motion.mjs`; adopt in the main backdrops (`#modal`, SOAP, agenda, entrega, templates, cmdk). Closes are currently instant `display:none`.
- **Toast system v2** in `public/js/app-shell.mjs` + `lab.css`: stacking container (max 3), enter/exit motion, styled `success/error/warn/info` variants with icon glyphs (today `warn/info/ok` render as unstyled dark boxes), hover-to-pause.
- **`::selection`** styling + consistent `:focus-visible` in `modals.css` (many `outline: none` without replacement).

## Phase 1 — Perceived speed: skeleton + loading system

- New `public/styles/skeleton.css` + helper `public/js/ui-skeleton.mjs`: shimmer primitives (`.skel-line`, `.skel-card`, `.skel-row`), token-driven, disabled under `prefers-reduced-motion`/HC.
- Replace text-only loaders: `showLabPanelLoadingSkeleton()` in `lazy-feature-routes.mjs` (real panel skeleton), tendencias `tend-loading`, clinical-teams roster, LAN directory.
- Button spinner: extend `setAsyncButtonLoading` in `public/js/ui-motion.mjs` with an inline spinner + `aria-busy`, replacing opacity-only `.loading`.

## Phase 2 — Motion & micro-interactions

- Tokenize motion: sweep raw durations/easings (`0.15s ease`, `cubic-bezier(0.25,1,0.5,1)`, etc.) in styles → `--dur-*` / `--ease-out`. ~176 transitions, fix the off-token ones.
- Main tab switch: cheap opacity-only cross-fade on `appcontent-*` panels (currently explicitly skipped in `ui-tab-motion.mjs`); gate behind `html.motion-sobrio` off and measure with `perf-markers.mjs` so it never costs frames.
- Tab-bar indicator: add transform/width transition (currently snaps; revisit the old "felt laggy" note with `--ease-out` 150ms).
- Micro-states: unified hover/press treatment (`--state-hover-bg`/`--state-active-bg` + 1px translate or 0.985 scale on press) for patient cards, board chips, primary buttons — defined once, in `base.css`.

## Phase 3 — Consistency: one component layer

- **Buttons**: canonical definitions in one place (`base.css` or new `components.css`) for `btn-generate`, `btn-save/cancel`, `btn-med-secondary`, `btn-primary/secondary`; delete the 4 duplicate `.btn-generate` definitions; all on `--elev-raised`, `--radius-control`, `--dur-fast`.
- **Modals**: one backdrop/panel CSS contract (`.modal-backdrop` + `.open`) with glass treatment from `overlays.css`; migrate `aria-hidden`/`style.display` outliers (`#rpc-wipe-modal`, templates, med-pharm) to it.
- **Inputs**: consolidate `profile-input` / `field-group input` styles; consistent `--input-fill`, focus ring, invalid state (`field-shake` already exists).
- Resolve the layer war: fold `soft-ui.css` `!important` radii into source rules where feasible; wire or delete orphan `workbench-tokens.css`.

## Phase 4 — Visual refinement (evolved Quiet Workbench)

Proposed evolution — stays clinical, gains depth:
- **Layered surfaces**: adopt `--elev-*` everywhere (replace ~78 ad-hoc `rgba()` shadows); subtle hairline top-highlight on raised cards (`--border-hairline`) instead of gradients.
- **Token completion**: add `--danger`/`--warn` (currently fallback-hex `var(--danger, #c53030)` in `pase-board.css`), z-index scale, chart series tokens; migrate the worst stray hex (top offenders: `pase-board.css` 68, `lab.css` 39 — legacy Tailwind greens/reds like `#10b981`, `#ef4444`).
- **Radius normalization**: replace ~117 literal `6–12px` radii (56 in `modals.css`) with `--radius-*` so `soft-ui.css` overrides become unnecessary.
- **Dark mode polish pass**: verify migrated colors in `html.dark` + both HC themes after hex migration; update `design.md` to phase 5 (anti-slop list amended: gradients still banned on CTAs, hairline highlights and tinted hovers allowed).

## Constraints

- All renderer edits in `public/styles/` + `public/js/`, then `npm run build:ui`; never touch `app.bundle.mjs`.
- Respect `html.motion-sobrio`, `prefers-reduced-motion`, both HC themes, `html.no-blur` on every new effect.
- Tier 1 debt budgets on touched `.mjs`; targeted `node --test` for `ui-motion`/skeleton helpers where testable.
- Phases are independently shippable and committable in order 0 → 4; each ends with a manual smoke in light/dark/HC.