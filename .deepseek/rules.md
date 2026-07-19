# DeepSeek GUI — Rules for R+

Este directorio contiene reglas para que **Kun** (el agente nativo de DeepSeek GUI) opere correctamente en el repositorio R+.

## Convención de reglas

El directorio **canónico** para reglas de agente es `.cursor/rules/` (formato MDC).
Este archivo es la puerta de entrada para DeepSeek GUI. Los agentes Kun deben:

1. Leer este archivo al iniciar
2. Seguir las reglas en `.cursor/rules/` (especialmente `project-context.mdc`)
3. Reportar cambios en `docs/logs/agent-changelog.md`

## Orden de lectura para Kun

1. `docs/core/01-vision-north-star.md` — Trade-offs del producto
2. `.cursor/rules/project-context.mdc` — Mapa del código
3. `docs/core/00-system-index.md` — Hub completo de documentación
4. `docs/core/17-docs-blueprint.md` — Estándar de documentación

## Reglas para DeepSeek GUI (Kun)

### No hacer

- No modificar `docs/superpowers/plans/` a menos que estés ejecutando ese plan explícitamente
- No editar manualmente `public/js/app.bundle.mjs` ni chunks
- No auto-indexar `docs/superpowers/` — es user-managed
- No revertir trabajo de usuario no relacionado

### Sí hacer

- Leer estado actual antes de actuar (`read`, `grep`, `find`, `ls`)
- Añadir tests cerca del código modificado
- Actualizar `docs/logs/agent-changelog.md` al cerrar sesión
- Crear spec en `docs/superpowers/specs/` antes de implementar features grandes
- Actualizar `docs/features/features-index.md` al añadir nuevo dominio de feature
- Actualizar `docs/core/18-knowledge-capture.md` para decisiones arquitectónicas

### Documentación

| Cambio | Actualizar |
|--------|-----------|
| Nuevo dominio de feature | `docs/features/features-index.md` + opcional `feat-*.md` |
| Nuevo parser/engine | `docs/logic/logic-index.md` |
| Cambio de esquema DB | `docs/database/database-index.md` |
| Commit arquitectónico | `.cursor/rules/project-context.mdc` + changelog |
| Feature grande | `docs/superpowers/specs/` antes de codificar |
| Pivote estratégico | `docs/core/01-vision-north-star.md` + `18-knowledge-capture.md` |
| Cierre de sesión | `docs/logs/agent-changelog.md` |

### Cache y telemetría

- Mantener el prefijo del prompt estable para cache
- No fabricar cache hit rates; usar telemetría real del proveedor
- Reportar `prompt_cache_hit_tokens` y `prompt_cache_miss_tokens` cuando estén disponibles

## Referencias

- `CONTRIBUTING.md` — Guía para contribuidores humanos y agentes
- `.cursor/rules/` — Reglas siempre activas (formato MDC)
- `docs/core/17-docs-blueprint.md` — Estándar de documentación
