// Primary-disorder rationale text (extracted from evaluateGasoExtended).

import { fmtLab_ } from './gaso-extended-steps.mjs';

/** @param {{ pH: number|null, hco3: number|null, pCO2: number|null, primary: object, winterCenter: number|null }} ctx */
function rationaleMixedWinter_(ctx) {
  var lines = [];
  var pH = ctx.pH;
  var hco3 = ctx.hco3;
  var pCO2 = ctx.pCO2;
  var winterCenter = ctx.winterCenter;
  var primary = ctx.primary;

  if (pH != null && pH < 7.35) lines.push('pH ' + fmtLab_(pH, 2) + ': acidemia.');
  else if (pH != null && pH > 7.45) lines.push('pH ' + fmtLab_(pH, 2) + ': alcalemia.');
  else if (pH != null) lines.push('pH ' + fmtLab_(pH, 2) + ': en rango o compensado.');

  var w = fmtLab_(winterCenter, 1);
  if (pCO2 != null && winterCenter != null && pCO2 < winterCenter - 2) {
    lines.push(
      'HCO₃⁻ ' +
        fmtLab_(hco3, 1) +
        ' < 22 (acidosis metabólica). Winter predice PaCO₂ ≈ ' +
        w +
        ' mmHg, pero la medida es ' +
        fmtLab_(pCO2) +
        ' mmHg (por debajo del margen ±2): hiperventilación / segundo proceso respiratorio.'
    );
  } else if (pCO2 != null && winterCenter != null) {
    lines.push(
      'HCO₃⁻ ' +
        fmtLab_(hco3, 1) +
        ' < 22. Winter predice PaCO₂ ≈ ' +
        w +
        ' mmHg, pero la medida es ' +
        fmtLab_(pCO2) +
        ' mmHg (por encima del margen ±2): retención de CO₂ adicional.'
    );
  }
  if (primary.type === 'alkalosis') {
    lines.push('El pH alcalino orienta el etiquetado hacia alcalosis en el cuadro mixto.');
  } else if (primary.type === 'acidosis') {
    lines.push('El pH ácido orienta el etiquetado hacia acidosis en el cuadro mixto.');
  }
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleMetabolicAcidosis_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push('HCO₃⁻ ' + fmtLab_(ctx.hco3, 1) + ' < 22: acidosis metabólica primaria.');
  if (ctx.pCO2 != null && ctx.winterCenter != null && Math.abs(ctx.pCO2 - ctx.winterCenter) <= 2) {
    lines.push(
      'PaCO₂ ' +
        fmtLab_(ctx.pCO2) +
        ' mmHg coincide con compensación respiratoria esperada (Winter ≈ ' +
        fmtLab_(ctx.winterCenter, 1) +
        ').'
    );
  }
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleMetabolicAlkalosis_(ctx) {
  return phPrefix_(ctx.pH).concat(['HCO₃⁻ ' + fmtLab_(ctx.hco3, 1) + ' > 26: alcalosis metabólica primaria.']).join(' ');
}

/** @param {object} ctx */
function rationaleRespAcidosis_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push('PaCO₂ ' + fmtLab_(ctx.pCO2) + ' mmHg > 45: acidosis respiratoria primaria.');
  if (ctx.metaLow) {
    lines.push('HCO₃⁻ bajo coexisten; la hipercapnia y el pH ácido predominan para nombrar el trastorno respiratorio.');
  }
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleRespAlkalosis_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push('PaCO₂ ' + fmtLab_(ctx.pCO2) + ' mmHg < 35: alcalosis respiratoria primaria.');
  if (ctx.metaLow) {
    lines.push('HCO₃⁻ bajo coexisten; la hipocapnia y el pH alcalino predominan frente al componente metabólico ácido.');
  }
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleMixedAcidosis_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push(
    'En acidemia, HCO₃⁻ y PaCO₂ no encajan con un solo trastorno primario (ni acidosis metabólica clara con compensación, ni hipercapnia aislada).'
  );
  if (ctx.metaLow) lines.push('Hay acidosis metabólica (HCO₃⁻ bajo).');
  if (ctx.respHigh) lines.push('Hay retención de CO₂ (PaCO₂ elevada).');
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleMixedAlkalosis_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push('En alcalemia, HCO₃⁻ y PaCO₂ apuntan a procesos opuestos.');
  if (ctx.metaLow && ctx.respLow) {
    lines.push(
      'HCO₃⁻ bajo (tendencia metabólica ácida) con PaCO₂ baja (alcalosis respiratoria); el pH alto indica que la hipocapnia pesa más en el balance.'
    );
  } else {
    if (ctx.metaLow) lines.push('HCO₃⁻ bajo sin alcalosis metabólica (HCO₃⁻ no elevado).');
    if (ctx.respLow) lines.push('PaCO₂ baja (hipocapnia).');
  }
  return lines.join(' ');
}

/** @param {object} ctx */
function rationaleCompensated_(ctx) {
  var lines = phPrefix_(ctx.pH);
  lines.push('Alteraciones de HCO₃⁻ y PaCO₂ se equilibran y dejan el pH casi normal.');
  if (ctx.metaLow && ctx.respLow) lines.push('Patrón acidótico compensado (HCO₃⁻ bajo + PaCO₂ baja).');
  if (ctx.metaHigh && ctx.respHigh) lines.push('Patrón alcalótico compensado (HCO₃⁻ alto + PaCO₂ alta).');
  return lines.join(' ');
}

/** @param {number|null} pH @returns {string[]} */
function phPrefix_(pH) {
  if (pH == null) return [];
  if (pH < 7.35) return ['pH ' + fmtLab_(pH, 2) + ': acidemia.'];
  if (pH > 7.45) return ['pH ' + fmtLab_(pH, 2) + ': alcalemia.'];
  return ['pH ' + fmtLab_(pH, 2) + ': en rango o compensado.'];
}

/**
 * @param {object} ctx
 * @returns {string}
 */
export function buildPrimaryRationale_(ctx) {
  if (ctx.pH == null && !ctx.mixedFromWinter) {
    return 'Sin pH no se puede inferir el trastorno predominante con estas reglas.';
  }
  if (ctx.mixedFromWinter) return rationaleMixedWinter_(ctx);

  var primary = ctx.primary;
  var handlers = {
    'metabolic:acidosis': rationaleMetabolicAcidosis_,
    'metabolic:alkalosis': rationaleMetabolicAlkalosis_,
    'respiratory:acidosis': rationaleRespAcidosis_,
    'respiratory:alkalosis': rationaleRespAlkalosis_,
    'mixed:acidosis': rationaleMixedAcidosis_,
    'mixed:alkalosis': rationaleMixedAlkalosis_,
    'compensated:none': rationaleCompensated_,
    'compensated:acidosis': rationaleCompensated_,
    'compensated:alkalosis': rationaleCompensated_,
  };
  var key = primary.disorder + ':' + primary.type;
  if (handlers[key]) return handlers[key](ctx);
  if (primary.disorder === 'unknown') {
    return phPrefix_(ctx.pH).concat(['Datos insuficientes para clasificar con las reglas automatizadas.']).join(' ');
  }
  return phPrefix_(ctx.pH).join(' ');
}
