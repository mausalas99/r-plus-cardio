import { normalizeHandoffContext } from './entrega-handoff-context.mjs';
import { normalizePendientesJson } from './entrega-pendientes.mjs';

/**
 * Red-outline / "crítico" census styling — guardia entrega record only (not Estado actual).
 * @param {{ is_critical?: number|boolean, pendientes_json?: string|null }} [guardia]
 */
export function isGuardiaChipCritical(guardia) {
  if (!guardia) return false;
  const critical = !!(guardia.is_critical === 1 || guardia.is_critical === true);
  const pendientesDoc = normalizePendientesJson(guardia.pendientes_json);
  const handoff = normalizeHandoffContext(pendientesDoc.handoffContext);
  return critical || handoff.vasopressor.active || handoff.ventilation.active;
}
