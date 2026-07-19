import { evaluateGuardiaR1 } from './guardia-r1.mjs';
import { evaluateGuardiaR2 } from './guardia-r2.mjs';
import { evaluateGuardiaR4 } from './guardia-r4.mjs';
import { evaluateGuardiaFallback } from './guardia-fallback.mjs';
import { evaluateTeamScope } from './team-scope.mjs';
import {
  SCOPE_PREAMBLE_EVALUATORS,
  evaluateScopeInterconsultas,
} from './preamble.mjs';
import { attachJoinedTeamScope, buildScopeContext } from './scope-context.mjs';

const GUARDIA_SCOPE_EVALUATORS = [
  evaluateGuardiaR1,
  evaluateGuardiaR2,
  evaluateGuardiaR4,
  evaluateGuardiaFallback,
];

/**
 * @param {object|null|undefined} currentUser
 * @param {object|null|undefined} targetPatient
 * @param {object|null|undefined} activeGuardia
 * @param {object|null|undefined} context
 */
export function runEvaluateClinicalScope(currentUser, targetPatient, activeGuardia, context) {
  const built = buildScopeContext(currentUser, targetPatient, activeGuardia, context);
  const { scopeCtx, guardiaMode } = built;

  for (const evaluate of SCOPE_PREAMBLE_EVALUATORS) {
    const result = evaluate(scopeCtx);
    if (result != null) return result;
  }

  attachJoinedTeamScope(built, built.userId);

  const interconsultasResult = evaluateScopeInterconsultas(scopeCtx);
  if (interconsultasResult != null) return interconsultasResult;

  if (guardiaMode) {
    for (const evaluate of GUARDIA_SCOPE_EVALUATORS) {
      const result = evaluate(scopeCtx);
      if (result != null) return result;
    }
  }

  return evaluateTeamScope(scopeCtx);
}
