# Contributing to R+ Cardio

¡Gracias por tu interés en contribuir a R+ Cardio!

## Índice

- [Documentación](#documentación)
- [Primeros pasos](#primeros-pasos)
- [Agentes AI](#agentes-ai)
- [Estándar de documentación](#estándar-de-documentación)
- [Pull requests](#pull-requests)
- [VibeDrift (opcional)](#vibedrift-opcional)

## Documentación

La documentación del proyecto sigue una arquitectura hub-and-spoke documentada en:

- **Punto de entrada:** [`docs/core/00-system-index.md`](docs/core/00-system-index.md)
- **Estándar:** [`docs/core/17-docs-blueprint.md`](docs/core/17-docs-blueprint.md)
- **Reglas para agentes:** `.cursor/rules/` (siempre activas)
- **Diseño Cardio:** [`docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md`](docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md)

Upstream R+ (referencia, no releases): [`mausalas99/r-mas`](https://github.com/mausalas99/r-mas).

## Primeros pasos

```bash
# Clonar e instalar
git clone https://github.com/mausalas99/r-plus-cardio.git
cd r-plus-cardio
npm install
npm run build:ui
npm start
```

Revisa [`README.md`](README.md) para instrucciones detalladas de instalación y desarrollo. Puerto local: **3838** (R+ usa 3738).

## Agentes AI

Este repositorio tiene reglas preconfiguradas para múltiples asistentes AI:

| Herramienta | Reglas en |
|-------------|-----------|
| **DeepSeek GUI (Kun)** | `.cursor/rules/` (formato MDC) |
| Cursor | `.cursor/rules/` |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) → `.claude/` + `.cursor/rules/` |
| OpenCode | `.opencode/` |

**Convención:** El directorio canónico para reglas es `.cursor/rules/`. Los demás directorios contienen configuraciones específicas de cada herramienta y deben mantenerse mínimas.

### Para agentes DeepSeek GUI / Kun

Lee en orden:

1. `docs/core/01-vision-north-star.md` — Trade-offs del producto
2. `.cursor/rules/project-context.mdc` — Mapa del código
3. `docs/core/00-system-index.md` — Hub completo de documentación

Reglas clave para agentes:

- **No** modificar `docs/superpowers/plans/` a menos que estés ejecutando ese plan
- **No** editar manualmente `public/js/app.bundle.mjs` o chunks
- **Sí** actualizar `docs/logs/agent-changelog.md` al cerrar sesión
- **Sí** crear spec en `docs/superpowers/specs/` antes de implementar features grandes
- **Sí** actualizar `docs/features/features-index.md` al añadir un nuevo dominio de feature

## Estándar de documentación

Ver [`docs/core/17-docs-blueprint.md`](docs/core/17-docs-blueprint.md) para:

- Taxonomía de directorios
- Convenciones de nomenclatura
- Reglas de mantenimiento para agentes

## VibeDrift (opcional)

VibeDrift mide drift arquitectónico (duplicación, patrones dominantes, funciones huérfanas). El repo incluye `@vibedrift/cli` como devDependency.

```bash
# Ver score local (no falla el build)
npm run vibedrift:scan

# Mismo check que CI (falla si score < 55)
npm run vibedrift:check
```

**Pre-push hook (opcional):** `npx vibedrift hook install --fail-on-score 45` — útil antes de abrir PR; no es obligatorio para contribuir.

Agentes: skill `.agents/skills/vibedrift/SKILL.md`; runner local `node .agents/skills/vibedrift/scripts/vibedrift-tools.mjs intent --root .`.

## Pull requests

1. Crea un branch con nombre descriptivo
2. Asegúrate de que `npm test` y `npm run metrics:check` pasen (CI también corre `npm run vibedrift:check`)
3. Si agregas una feature nueva, incluye o actualiza la documentación correspondiente
4. Actualiza `docs/logs/agent-changelog.md` si un agente AI participó en el cambio
5. Para cambios arquitectónicos, considera registrar la decisión en `docs/core/18-knowledge-capture.md`
