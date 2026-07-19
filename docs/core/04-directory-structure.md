---
type: "core"
name: "Directory Structure"
status: "stable"
description: "Canonical map of where source files, docs, and build artifacts belong in R+."
---

# Directory Structure

**Living duplicate:** `.cursor/rules/project-context.mdc` is updated on architectural commits. This doc explains *why* paths exist; the rule file is the fastest agent lookup.

## Root layout

```
R+/
├── main.js, preload.js, server.js    # Electron main, IPC bridge, LAN HTTP server
├── lan-squad/                          # LiveSync host: router, store, auth, WS hub
├── lib/                                # Node shared logic (importable from main/server)
├── public/js/                          # Renderer source (pre-bundle)
│   └── features/                       # Primary place for new UI features
├── public/interno/                     # Mobile interno/guardia web client
├── scripts/                            # build-ui, bundle, release, metrics
├── docs/
│   ├── core/                           # Strategy & architecture (agent hub)
│   ├── features/                       # Feature docs + features-index.md
│   ├── logic/                          # Parsers, engines + logic-index.md
│   ├── database/                       # Schema docs + database-index.md
│   ├── logs/                           # agent-changelog.md
│   └── superpowers/                    # specs/ + plans/ (large features)
└── .cursor/rules/                      # Always-on agent rules
```

## Where to add new work

| Change type | Location |
|-------------|----------|
| New UI feature | `public/js/features/<name>/` + register in `app-runtimes.mjs` |
| Node shared logic | `lib/<domain>/` as `.mjs` or `.js` |
| LAN HTTP/WS route | `lan-squad/host-router.js` or `server.js` |
| IPC channel | `preload.js` + `main.js` or `lib/db/ipc-handlers.mjs` |
| DB schema change | `lib/db/schema.mjs` + `schema.test.mjs` (bump version) |
| Feature design (large) | `docs/superpowers/specs/YYYY-MM-DD-*.md` |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-*.md` |
| Feature documentation | `docs/features/feat-*.md` + update `features-index.md` |

## Generated — do not hand-edit

- `public/js/app.bundle.mjs`, `public/js/chunks/*`
- `public/index.html` (from `scripts/build-ui.mjs`)

Run `npm run build:ui` after renderer changes.

## Related

- [08-core-architecture.md](./08-core-architecture.md)
- [features/features-index.md](../features/features-index.md)
