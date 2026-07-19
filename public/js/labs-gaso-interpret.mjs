// Gasometría interpretación corta (extracted from labs.js buildGasoInterpretacionFromValues_).

function classifyAcidosisPrimaria_(metaLow, respHigh) {
  if (metaLow) return 'Acidosis metabólica';
  if (respHigh) return 'Acidosis respiratoria';
  return '';
}

function classifyAlkalosisPrimaria_(metaHigh, respLow) {
  if (metaHigh) return 'Alcalosis metabólica';
  if (respLow) return 'Alcalosis respiratoria';
  return '';
}

function classifyCompensatedPrimaria_(metaLow, metaHigh, respLow, respHigh) {
  if (metaLow && respLow) return 'Acidosis metabólica con compensación respiratoria';
  if (metaHigh && respHigh) return 'Alcalosis metabólica con compensación respiratoria';
  if (metaLow) return 'Acidosis metabólica con compensación respiratoria';
  if (metaHigh) return 'Alcalosis metabólica con compensación respiratoria';
  return '';
}

function classifyGasoPrimaria_(pH, metaLow, metaHigh, respLow, respHigh, hco3, pCO2) {
  if (pH == null || (pCO2 == null && hco3 == null)) return '';
  if (pH < 7.35) return classifyAcidosisPrimaria_(metaLow, respHigh);
  if (pH > 7.45) return classifyAlkalosisPrimaria_(metaHigh, respLow);
  if (hco3 == null || pCO2 == null) return '';
  return classifyCompensatedPrimaria_(metaLow, metaHigh, respLow, respHigh);
}

function primariaFromCompensatedPh_(pH, metaLow, metaHigh) {
  if (pH == null || pH < 7.35 || pH > 7.45) return '';
  if (metaLow) return 'Acidosis metabólica';
  if (metaHigh) return 'Alcalosis metabólica';
  return '';
}

function appendMetabolicConcomitant_(partes, primaria, metaLow, respLow) {
  if (!metaLow || !respLow) return;
  if (/respiratoria/i.test(primaria) || /alcalosis respiratoria/i.test(primaria)) {
    partes.push('Acidosis metabólica concomitante (HCO3 bajo)');
  }
}

function appendMetabolicAlkalosisConcomitant_(partes, primaria, metaHigh, respHigh) {
  if (metaHigh && respHigh && /respiratoria/i.test(primaria)) {
    partes.push('Alcalosis metabólica concomitante (HCO3 alto)');
  }
}

function appendRespiratoryConcomitant_(partes, primaria, metaLow, metaHigh, respLow, respHigh) {
  if (metaLow && respHigh && /metabólica/i.test(primaria)) {
    partes.push('Acidosis respiratoria concomitante (PCO2 alto)');
  } else if (metaHigh && respLow && /metabólica/i.test(primaria)) {
    partes.push('Alcalosis respiratoria concomitante (PCO2 bajo)');
  }
}

function appendGasoConcomitantes_(partes, primaria, metaLow, metaHigh, respLow, respHigh) {
  appendMetabolicConcomitant_(partes, primaria, metaLow, respLow);
  appendMetabolicAlkalosisConcomitant_(partes, primaria, metaHigh, respHigh);
  appendRespiratoryConcomitant_(partes, primaria, metaLow, metaHigh, respLow, respHigh);
}

function appendGasoAgParts_(partes, primaria, ag, dd) {
  if (ag == null || ag <= 12 || dd == null) return;
  if (dd < 0.8) {
    if (/^Acidosis metabólica/i.test(primaria)) {
      partes.push('Componente hiperclorémico con anion gap elevado (Delta-Delta bajo)');
    } else {
      partes.push('Acidosis metabólica hiperclorémica con anion gap elevado (Delta-Delta bajo)');
    }
    return;
  }
  if (dd > 2) {
    if (/^Alcalosis metabólica/i.test(primaria)) {
      partes.push(
        'Componente agregado con anion gap elevado (Delta-Delta alto), considerar acidosis respiratoria crónica'
      );
    } else {
      partes.push(
        'Alcalosis metabólica agregada o acidosis respiratoria crónica con anion gap elevado (Delta-Delta alto)'
      );
    }
    return;
  }
  partes.push('Anion gap elevado');
}

export function buildGasoInterpretacionFromValues_(pH, pCO2, hco3, ag, dd) {
  var metaLow = hco3 != null && hco3 < 22;
  var metaHigh = hco3 != null && hco3 > 26;
  var respLow = pCO2 != null && pCO2 < 35;
  var respHigh = pCO2 != null && pCO2 > 45;

  var primaria = classifyGasoPrimaria_(pH, metaLow, metaHigh, respLow, respHigh, hco3, pCO2);
  if (!primaria) primaria = primariaFromCompensatedPh_(pH, metaLow, metaHigh);

  var partes = [];
  if (primaria) partes.push(primaria);
  else partes.push('Trastorno ácido-base compensado');

  appendGasoConcomitantes_(partes, primaria, metaLow, metaHigh, respLow, respHigh);
  appendGasoAgParts_(partes, primaria, ag, dd);

  return ('Interpretación gasometría:\t' + partes.join('; ')).toUpperCase();
}
