import { evaluateTeamScopeR4 } from './team-scope-r4.mjs';
import { evaluateTeamScopeEntregaR1 } from './team-scope-entrega-r1.mjs';
import { evaluateTeamScopeR1 } from './team-scope-r1.mjs';
import { evaluateTeamScopeR2 } from './team-scope-r2.mjs';
import { evaluateTeamScopeR3 } from './team-scope-r3.mjs';
import { evaluateTeamScopeTail } from './team-scope-tail.mjs';

const TEAM_SCOPE_EVALUATORS = [
  evaluateTeamScopeR4,
  evaluateTeamScopeEntregaR1,
  evaluateTeamScopeR1,
  evaluateTeamScopeR2,
  evaluateTeamScopeR3,
];

/**
 * Non-guardia team/rank scope (everything after the guardiaMode block).
 * @param {object} ctx
 * @returns {object}
 */
export function evaluateTeamScope(ctx) {
  for (const evaluate of TEAM_SCOPE_EVALUATORS) {
    const result = evaluate(ctx);
    if (result != null) return result;
  }
  return evaluateTeamScopeTail(ctx);
}
