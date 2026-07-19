# R+ — Design system (Hallmark)

**Genre:** utilitarian clinical · **Theme:** Quiet workbench  
**Checkpoint previo a fase 4:** `checkpoint/pre-hallmark-fase-4`  
**Última actualización:** fase 4 (2026-05-19)  
**UI audit tracks (2026-06-20):** `docs/superpowers/specs/2026-06-20-hallmark-ui-audit-tracks-design.md`

## Principios

- Densidad de información alta sin ruido visual: bordes y tipografía antes que color.
- Un solo acento (`--color-accent`); éxito/error como semánticos, no como segundo brand.
- Sin gradientes en chrome ni CTAs; sombras suaves y bordes `var(--border)`.
- Tipografía: IBM Plex Sans (UI), IBM Plex Mono (labs, registro, valores).
- Motion: `--ease-out`, 150–220 ms; sin rebote.

## Tokens (fuente de verdad)

Archivo: `public/tokens.css`

| Token | Uso |
| --- | --- |
| `--color-paper` | Fondo de app / modo Pase |
| `--color-surface` | Cards, header, sidebar |
| `--color-ink` / `--color-ink-muted` | Texto principal y secundario |
| `--color-accent` | Acciones, pestaña activa, enlaces |
| `--font-ui` / `--font-mono` | Familias tipográficas |
| `--radius-lg` / `--radius-md` / `--radius-pill` | Radios |
| `--shadow` / `--shadow-md` | Elevación |
| `--density-space` / `--density-font` | Normal vs Pase |

Legacy aliases (`--action`, `--surface`, `--text`, …) se mantienen para CSS existente.

## Layout (no cambiar sin motivo)

- **Workbench:** sidebar pacientes + área principal con pestañas (Normal) o `appcontent-pase` (Pase).
- **Pase:** resumen en columna; secciones `pase-section`; banner `pase-patient-banner` arriba.
- **Normal:** Laboratorio · Expediente · Medicamentos · Agenda.

## Componentes clave

- **Card:** header plano `card-header`, cuerpo `card-body-bg`.
- **Pestañas:** subrayado 2px activo, sin pastilla flotante.
- **Modales:** backdrop semitransparente; cierre con clic fuera / Esc.
- **Botón primario:** `btn-generate` sólido; éxito `btn-generate--success` vía `--color-success-emphasis`.

## Temas

- `html` — claro  
- `html.dark` — oscuro (superficies neutras, sin tinte azul fuerte)  
- `html.high-contrast` / `html.high-contrast.dark` — legibilidad WCAG  

## Modos de densidad

- `html.ui-density-normal` — pestañas completas  
- sin esa clase (Pase) — `appcontent-pase` + sidebar ronda  

## No hacer (anti-slop)

- Gradientes en botones, cards activas o banners de ayuda.
- MAYÚSCULAS decorativas en labels (solo datos clínicos en mayúsculas si vienen del reporte).
- Hex sueltos en componentes nuevos: siempre `var(--…)`.
- Botón × circular en modales a pantalla completa (usar margen + backdrop).

## Hallmark stamp (CSS)

```css
/* Hallmark · phase 4 · utilitarian clinical · theme: Quiet workbench
 * contrast: pass (tokens + HC)
 */
```
