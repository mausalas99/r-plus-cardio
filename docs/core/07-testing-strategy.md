---
type: "core"
name: "Testing Strategy"
status: "stable"
description: "Cómo ejecutar tests en desarrollo, CI y suites con nativos SQLCipher."
---

# Estrategia de testing

## Ubicación

Los tests están **colocados** junto al código (`*.test.mjs` / `*.test.js`). No hay carpeta `tests/` de integración en este repositorio.

## Desarrollo y agentes

Ejecutar **targeted** runs — nunca la suite completa en desarrollo:

```bash
node --test path/to/changed.test.mjs
```

Ejemplos por dominio:

```bash
# LAN sync kernel (después de tocar features/lan/*)
node --test public/js/features/lan/orchestrator.test.mjs public/js/features/lan/push.test.mjs public/js/lan-sync-wiring.test.mjs

# IPC clínico (SQLCipher Node ABI — ver abajo)
node scripts/ensure-native-db-for-node.mjs
node --test lib/db/ipc-handlers.test.mjs
node scripts/rebuild-native-db.mjs
```

Para varios archivos relacionados, pásalos explícitamente a `node --test`. La suite monolítica (`npm test`, ~348 archivos) es solo para **CI y release**.

## CI y release

`npm test` ejecuta un **manifiesto explícito** en `package.json` `scripts.test`. El guard de drift vive en `scripts/lib/test-manifest.mjs` (y su test), con lista `QUARANTINED` comentada para suites temporalmente excluidas.

Orden de gates en CI: `build:ui` → `npm run lint` (root + scripts) → `metrics:check` (ratchet eslint sobre archivos Tier-1 cambiados vs `main`) → `npm test`.

## Nativos SQLCipher

Las suites que abren SQLCipher necesitan el ABI de Node, no el de Electron:

```bash
node scripts/ensure-native-db-for-node.mjs   # antes
node --test lib/db/schema.test.mjs
node scripts/rebuild-native-db.mjs         # después (restaura ABI Electron)
```

Los hooks `pretest` / `posttest` hacen esto automáticamente cuando corres `npm test`.

## Referencias

- Mapa de dominios y parsers: `docs/logic/logic-index.md`
- Índice de features: `docs/features/features-index.md`
- Mapa de código: `.cursor/rules/project-context.mdc`
