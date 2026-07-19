import {
  effectiveSoapCategory,
  formatMedicationSoapShort,
  advanceAbxMedTextForManejoDate,
} from '../med-receta-core.mjs';
import { shouldIncludeMedicationInSoap } from '../med-receta-soap.mjs';
import {
  MED_FIELD_KEYS,
  applyDietaSuplementoPolicy,
} from './estado-actual-data.mjs';
import {
  hasActiveDietProposal,
  shouldSkipDietProposal,
  tryAutoConfirmMatchingDiet,
  writeDietProposal,
  mergedDietFromReceta,
  mergedDietHasContent,
  clearDietPending,
} from './estado-actual-meds-diet.mjs';
import { stripDietaMacroSuffixFromLabel } from './estado-actual-data.mjs';
import {
  insulinPumpNmSoapFragment,
  skipRecetaItemForNmSoapBucket,
  skipRecetaItemForInsulinPumpCarrier,
} from '../insulin-pump-receta-display.mjs';
import {
  insulinRescateNmSoapFragment,
  skipRecetaItemForInsulinRescateBucket,
  INSULIN_RESCATE_NM_LABEL,
  patientHasInsulinRescateMeds,
  isInsulinRescateMedicationItem,
} from '../insulin-rescate-display.mjs';
import {
  detectInsulinPumpAlgorithmFromRecetaItems,
  formatInsulinPumpAlgoritmoLabel,
} from '../insulin-pump-some-detect.mjs';

/**
 * @param {string | null | undefined} activeId
 * @param {Record<string, { fechaActualizacion?: string }>} [medRecetaByPatient]
 */
export function resolveManejoFechaActualizacion(activeId, medRecetaByPatient) {
  var block = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  return block && block.fechaActualizacion ? String(block.fechaActualizacion).trim() : '';
}

/**
 * @param {string} text
 * @param {string | null | undefined} fechaActualizacion
 * @param {Date} [refDate]
 */
function advanceAbxTextForEa(text, fechaActualizacion, refDate) {
  if (!text || !fechaActualizacion) return text;
  return advanceAbxMedTextForManejoDate(String(text), fechaActualizacion, refDate);
}

/**
 * @param {Record<string, unknown>} ec
 * @param {string} fechaActualizacion
 * @param {Date} [refDate]
 */
function withAdvancedAbxEc(ec, fechaActualizacion, refDate) {
  if (!fechaActualizacion || !ec || !ec.abx || !String(ec.abx).trim()) return ec;
  var next = Object.assign({}, ec);
  next.abx = advanceAbxTextForEa(String(ec.abx), fechaActualizacion, refDate);
  return next;
}

export const DIET_PENDING_KEYS = /** @type {const} */ (['dieta', 'kcal', 'proteinG']);

/**
 * @param {Record<string, unknown> | null | undefined} pendienteReceta
 * @returns {boolean}
 */
export function hasPendingEaProposals(pendienteReceta) {
  var pend = pendienteReceta && typeof pendienteReceta === 'object' ? pendienteReceta : {};
  if (
    DIET_PENDING_KEYS.some(function (k) {
      return pend[k] && String(pend[k]).trim();
    })
  ) {
    return true;
  }
  return MED_FIELD_KEYS.some(function (k) {
    return pend[k] && String(pend[k]).trim();
  });
}

/**
 * Estado clínico efectivo para texto SOAP: incluye propuestas pendientes no confirmadas.
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @returns {Record<string, unknown>}
 */
function mergePendingDietProposal(ec, pend, _conf) {
  if (!ec || typeof ec !== 'object') return ec;
  if (!hasActiveDietProposal(pend)) return ec;
  DIET_PENDING_KEYS.forEach(function (k) {
    var pending = pend[k];
    if (pending != null && String(pending).trim()) ec[k] = String(pending).trim();
  });
  applyDietaSuplementoPolicy(ec);
  return ec;
}

/**
 * Copia dieta detectada en Manejo (block.dietas) a propuesta pendiente de EA si aún no hay una.
 * @param {Record<string, unknown>} monitoreo
 * @param {{ dietas?: unknown[] } | null | undefined} recetaBlock
 * @param {{ force?: boolean } | undefined} [opts]
 * @returns {boolean}
 */
export function applyDietProposalFromRecetaBlock(monitoreo, recetaBlock, opts) {
  if (!monitoreo || !recetaBlock || !Array.isArray(recetaBlock.dietas) || !recetaBlock.dietas.length) {
    return false;
  }
  var merged = mergedDietFromReceta(recetaBlock.dietas);
  if (!mergedDietHasContent(merged)) return false;
  if (tryAutoConfirmMatchingDiet(monitoreo, merged)) return true;
  if (shouldSkipDietProposal(monitoreo, opts, merged)) return false;
  writeDietProposal(monitoreo, merged);
  return true;
}

/**
 * Estado clínico para inputs del panel EA (incluye propuesta de dieta pendiente).
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {{ fechaActualizacion?: string, refDate?: Date }} [opts]
 */
export function estadoClinicoForDisplay(monitoreo, opts) {
  if (!monitoreo || typeof monitoreo !== 'object') return {};
  var fechaActualizacion = opts && opts.fechaActualizacion ? String(opts.fechaActualizacion).trim() : '';
  var refDate = opts && opts.refDate;
  var ec =
    monitoreo.estadoClinico && typeof monitoreo.estadoClinico === 'object'
      ? Object.assign({}, monitoreo.estadoClinico)
      : {};
  var pend =
    monitoreo.pendienteReceta && typeof monitoreo.pendienteReceta === 'object'
      ? monitoreo.pendienteReceta
      : {};
  var conf =
    monitoreo.confirmado && typeof monitoreo.confirmado === 'object' ? monitoreo.confirmado : {};
  mergePendingDietProposal(ec, pend, conf);
  return withAdvancedAbxEc(ec, fechaActualizacion, refDate);
}

/**
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @param {{ fechaActualizacion?: string, refDate?: Date }} [opts]
 */
/**
 * @param {string} pending
 * @param {string} fechaActualizacion
 * @param {Date} [refDate]
 */
function pendingMedValueForText(key, pending, fechaActualizacion, refDate) {
  var val = String(pending).trim();
  return key === 'abx' ? advanceAbxTextForEa(val, fechaActualizacion, refDate) : val;
}

/**
 * @param {Record<string, unknown>} ec
 * @param {Record<string, unknown>} pend
 * @param {Record<string, unknown>} conf
 * @param {string} fechaActualizacion
 * @param {Date} [refDate]
 */
function mergePendingMedsForText(ec, pend, conf, fechaActualizacion, refDate) {
  for (var k of MED_FIELD_KEYS) {
    if (conf[k]) continue;
    var pending = pend[k];
    if (pending == null || !String(pending).trim()) continue;
    if (!ec[k] || !String(ec[k]).trim()) {
      ec[k] = pendingMedValueForText(k, String(pending), fechaActualizacion, refDate);
    }
  }
}

export function estadoClinicoForText(monitoreo, opts) {
  if (!monitoreo || typeof monitoreo !== 'object') return {};
  var fechaActualizacion = opts && opts.fechaActualizacion ? String(opts.fechaActualizacion).trim() : '';
  var refDate = opts && opts.refDate;
  var ec = estadoClinicoForDisplay(monitoreo, opts);
  var pend =
    monitoreo.pendienteReceta && typeof monitoreo.pendienteReceta === 'object'
      ? monitoreo.pendienteReceta
      : {};
  var conf =
    monitoreo.confirmado && typeof monitoreo.confirmado === 'object' ? monitoreo.confirmado : {};
  mergePendingMedsForText(ec, pend, conf, fechaActualizacion, refDate);
  return ec;
}

/**
 * Aplica propuestas desde medicamentos marcados SOAP en la pestaña Receta.
 * @param {string | null | undefined} patientId
 * @param {Record<string, unknown>} monitoreo
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 * @param {Record<string, Record<string, boolean>>} medNotaSelectionByPatient
 * @param {(nombreRaw: string) => string} classifyFn
 * @returns {boolean} true si se aplicó al menos una propuesta
 */
export function syncRecetaProposalsFromSoapSelection(
  patientId,
  monitoreo,
  medRecetaByPatient,
  medNotaSelectionByPatient,
  classifyFn
) {
  if (!patientId || !monitoreo) return false;
  var block = medRecetaByPatient ? medRecetaByPatient[patientId] : null;
  var items = block && Array.isArray(block.items) ? block.items : [];
  var fechaActualizacion = resolveManejoFechaActualizacion(patientId, medRecetaByPatient);
  var pruned = pruneEstadoClinicoMedsFromReceta(monitoreo, items, classifyFn, fechaActualizacion);
  var sel = medNotaSelectionByPatient && medNotaSelectionByPatient[patientId];
  var buckets = bucketsFromRecetaItems(items, sel || {}, classifyFn);
  applyRecetaProposal(monitoreo, buckets);
  var hasAny = MED_FIELD_KEYS.some(function (k) {
    return buckets[k] && String(buckets[k]).trim();
  });
  return pruned || hasAny;
}

/**
 * @param {{ nombreRaw?: string, viaRaw?: string, dosisRaw?: string, frecuenciaRaw?: string, diaTratamiento?: number | null, suspendido?: boolean }} it
 * @returns {string}
 */
export function medInstructionFragmentForSoap(it) {
  return formatMedicationSoapShort(it);
}

/**
 * @param {unknown[]} items
 * @param {Record<string, boolean>} selMap
 * @param {(nombreRaw: string) => string} classifyFn
 * @returns {Record<string, string>}
 */
export function bucketsFromRecetaItems(items, selMap, classifyFn) {
  /** @type {Record<string, string[]>} */
  var arrays = {
    analgesia: [],
    antiemeticos: [],
    sedacion: [],
    antiepilepticos: [],
    antiparkinsonianos: [],
    antidotos: [],
    viaAerea: [],
    abx: [],
    transfusiones: [],
    antihta: [],
    diuretico: [],
    antitromboticos: [],
    anticoagulacion: [],
    antiarritmicos: [],
    estatinas: [],
    vasop: [],
    nm: [],
    otros: [],
  };
  var list = Array.isArray(items) ? items : [];
  var soapSelected = list.filter(function (it) {
    return it && selMap[it.id] && !it.suspendido;
  });
  var pumpNmFrag = insulinPumpNmSoapFragment(list, soapSelected);
  var pumpNmAdded = false;
  var rescateNmFrag = insulinRescateNmSoapFragment(list, soapSelected);
  var rescateNmAdded = false;
  list.forEach(function (it) {
    if (!it || !selMap[it.id] || it.suspendido) return;
    if (skipRecetaItemForInsulinPumpCarrier(it, list)) return;
    if (!shouldIncludeMedicationInSoap(it, classifyFn)) return;
    var cat = effectiveSoapCategory(it, classifyFn);
    if (cat === 'otros') return;
    if (cat === 'nm' && skipRecetaItemForNmSoapBucket(it, list)) {
      if (pumpNmFrag && !pumpNmAdded) {
        arrays.nm.push(pumpNmFrag);
        pumpNmAdded = true;
      }
      return;
    }
    if (cat === 'nm' && skipRecetaItemForInsulinRescateBucket(it, list)) {
      if (rescateNmFrag && !rescateNmAdded) {
        arrays.nm.push(rescateNmFrag);
        rescateNmAdded = true;
      }
      return;
    }
    if (arrays[cat]) arrays[cat].push(medInstructionFragmentForSoap(it));
    else arrays.otros.push(medInstructionFragmentForSoap(it));
  });
  /** @type {Record<string, string>} */
  var buckets = {};
  for (var k of MED_FIELD_KEYS) {
    var srcKey = k === 'diureticos' ? 'diuretico' : k;
    buckets[k] = (arrays[srcKey] || []).join(' | ');
  }
  return buckets;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseMedFieldItemsLocal(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(' | ')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function serializeMedFieldItemsLocal(items) {
  return (items || [])
    .map(function (s) {
      return String(s).trim();
    })
    .filter(Boolean)
    .join(' | ');
}

/**
 * @param {string} text
 */
function normalizeMedSoapLine(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+DIA\s+\d+\s*$/i, '')
    .replace(/(\d+)\s+G\b/g, '$1G')
    .replace(/(\d+)\s+MG\b/g, '$1MG')
    .replace(/(\d+)\s+MCG\b/g, '$1MCG')
    .trim();
}

/**
 * @param {string} line
 * @param {string[]} allowedFrags
 */
function medSoapLineMatchesReceta(line, allowedFrags) {
  var norm = normalizeMedSoapLine(line);
  if (!norm) return false;
  return allowedFrags.some(function (frag) {
    var f = normalizeMedSoapLine(frag);
    return f && (norm === f || norm.indexOf(f) >= 0 || f.indexOf(norm) >= 0);
  });
}

/**
 * @param {unknown[]} items
 * @param {(nombreRaw: string, dosisRaw?: string) => string} classifyFn
 * @param {string} fechaActualizacion
 * @returns {Record<string, string[]>}
 */
export function allowedSoapFragmentsByCategory(items, classifyFn, fechaActualizacion) {
  /** @type {Record<string, string[]>} */
  var byCat = {};
  MED_FIELD_KEYS.forEach(function (k) {
    byCat[k] = [];
  });
  var list = Array.isArray(items) ? items : [];
  list.forEach(function (it) {
    if (!it || /** @type {{ suspendido?: boolean }} */ (it).suspendido) return;
    if (skipRecetaItemForInsulinPumpCarrier(it, list)) return;
    if (!shouldIncludeMedicationInSoap(
      /** @type {{ nombreRaw?: string, dosisRaw?: string, frecuenciaRaw?: string, suspendido?: boolean }} */ (it),
      classifyFn
    )) {
      return;
    }
    if (isInsulinRescateMedicationItem(it)) return;
    var cat = effectiveSoapCategory(
      /** @type {{ nombreRaw?: string, soapCatOverride?: string }} */ (it),
      classifyFn
    );
    if (cat === 'otros') return;
    var key = cat === 'diuretico' ? 'diureticos' : cat;
    if (key === 'nm' && skipRecetaItemForNmSoapBucket(it, list)) return;
    var frag = medInstructionFragmentForSoap(
      /** @type {Parameters<typeof medInstructionFragmentForSoap>[0]} */ (it)
    );
    if (key === 'abx' && fechaActualizacion) {
      frag = advanceAbxMedTextForManejoDate(frag, fechaActualizacion);
    }
    if (byCat[key]) byCat[key].push(frag);
  });
  // Propuesta/confirmación NM usa etiqueta de bomba, no el SOAP corto de insulina IV.
  // Sin esto, prune borra la línea confirmada y reabre la propuesta (igual que dieta).
  var pumpAlg = detectInsulinPumpAlgorithmFromRecetaItems(list);
  if (pumpAlg != null) {
    var pumpLabel = formatInsulinPumpAlgoritmoLabel(pumpAlg);
    if (pumpLabel && byCat.nm) byCat.nm.push(pumpLabel);
  }
  if (patientHasInsulinRescateMeds(list) && byCat.nm) {
    byCat.nm.push(INSULIN_RESCATE_NM_LABEL);
  }
  return byCat;
}

/**
 * Quita de EA medicamentos que ya no están en el manejo SOME pegado.
 * @param {Record<string, unknown>} monitoreo
 * @param {unknown[]} items
 * @param {(nombreRaw: string, dosisRaw?: string) => string} classifyFn
 * @param {string} [fechaActualizacion]
 * @returns {boolean}
 */
export function pruneEstadoClinicoMedsFromReceta(monitoreo, items, classifyFn, fechaActualizacion) {
  if (!monitoreo || typeof monitoreo !== 'object') return false;
  if (!monitoreo.estadoClinico || typeof monitoreo.estadoClinico !== 'object') {
    monitoreo.estadoClinico = {};
  }
  if (!monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') {
    monitoreo.pendienteReceta = {};
  }
  if (!monitoreo.confirmado || typeof monitoreo.confirmado !== 'object') {
    monitoreo.confirmado = {};
  }
  var allowed = allowedSoapFragmentsByCategory(items, classifyFn, fechaActualizacion || '');
  var changed = false;
  MED_FIELD_KEYS.forEach(function (key) {
    var allowedFrags = allowed[key] || [];
    var ecItems = parseMedFieldItemsLocal(monitoreo.estadoClinico[key]);
    var keptEc = ecItems.filter(function (line) {
      return medSoapLineMatchesReceta(line, allowedFrags);
    });
    if (keptEc.length !== ecItems.length) {
      /** @type {Record<string, string>} */ (monitoreo.estadoClinico)[key] = serializeMedFieldItemsLocal(keptEc);
      changed = true;
    }
    if (!keptEc.length && monitoreo.confirmado[key]) {
      /** @type {Record<string, boolean>} */ (monitoreo.confirmado)[key] = false;
      changed = true;
    }
    var pendVal = monitoreo.pendienteReceta[key];
    if (pendVal != null && String(pendVal).trim()) {
      var pendItems = parseMedFieldItemsLocal(pendVal);
      var keptPend = pendItems.filter(function (line) {
        return medSoapLineMatchesReceta(line, allowedFrags);
      });
      var nextPend = serializeMedFieldItemsLocal(keptPend);
      if (nextPend !== String(pendVal).trim()) {
        monitoreo.pendienteReceta[key] = nextPend;
        changed = true;
      }
    }
  });
  return changed;
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {Record<string, string>} buckets
 */
export function applyRecetaProposal(monitoreo, buckets) {
  if (!monitoreo || typeof monitoreo !== 'object') return;
  if (!monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') {
    monitoreo.pendienteReceta = {};
  }
  for (var k of MED_FIELD_KEYS) {
    if (monitoreo.confirmado && monitoreo.confirmado[k]) continue;
    var val = buckets && buckets[k];
    monitoreo.pendienteReceta[k] = val != null && String(val).trim() ? String(val).trim() : '';
  }
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {string} key
 */
export function confirmMedField(monitoreo, key) {
  if (!monitoreo || !MED_FIELD_KEYS.includes(/** @type {typeof MED_FIELD_KEYS[number]} */ (key))) return;
  if (!monitoreo.estadoClinico || typeof monitoreo.estadoClinico !== 'object') {
    monitoreo.estadoClinico = {};
  }
  var pending =
    monitoreo.pendienteReceta &&
    typeof monitoreo.pendienteReceta === 'object' &&
    monitoreo.pendienteReceta[key];
  if (pending != null && String(pending).trim()) {
    /** @type {Record<string, string>} */ (monitoreo.estadoClinico)[key] = String(pending).trim();
  }
  if (!monitoreo.confirmado || typeof monitoreo.confirmado !== 'object') {
    monitoreo.confirmado = {};
  }
  /** @type {Record<string, boolean>} */ (monitoreo.confirmado)[key] = true;
  if (monitoreo.pendienteReceta && typeof monitoreo.pendienteReceta === 'object') {
    monitoreo.pendienteReceta[key] = '';
  }
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {string} key
 */
export function discardMedProposal(monitoreo, key) {
  if (!monitoreo || !monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') return;
  if (MED_FIELD_KEYS.includes(/** @type {typeof MED_FIELD_KEYS[number]} */ (key))) {
    monitoreo.pendienteReceta[key] = '';
  }
}

/**
 * @param {Record<string, unknown>} monitoreo
 */
export function confirmDietProposal(monitoreo) {
  if (!monitoreo || typeof monitoreo !== 'object') return;
  if (!monitoreo.estadoClinico || typeof monitoreo.estadoClinico !== 'object') {
    monitoreo.estadoClinico = {};
  }
  if (!monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') return;
  DIET_PENDING_KEYS.forEach(function (k) {
    var pending = monitoreo.pendienteReceta[k];
    if (pending != null && String(pending).trim()) {
      /** @type {Record<string, string>} */ (monitoreo.estadoClinico)[k] = String(pending).trim();
      monitoreo.pendienteReceta[k] = '';
    }
  });
  applyDietaSuplementoPolicy(monitoreo.estadoClinico, monitoreo.pendienteReceta);
  if (monitoreo.estadoClinico.dieta) {
    var dietaClean = stripDietaMacroSuffixFromLabel(monitoreo.estadoClinico.dieta);
    if (dietaClean) monitoreo.estadoClinico.dieta = dietaClean;
  }
  if (!monitoreo.confirmado || typeof monitoreo.confirmado !== 'object') {
    monitoreo.confirmado = {};
  }
  /** @type {Record<string, boolean>} */ (monitoreo.confirmado).dieta = true;
  clearDietPending(monitoreo);
}

export function discardDietProposal(monitoreo) {
  if (!monitoreo || !monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') return;
  DIET_PENDING_KEYS.forEach(function (k) {
    monitoreo.pendienteReceta[k] = '';
  });
}

export function confirmAllMedProposals(monitoreo) {
  if (
    DIET_PENDING_KEYS.some(function (k) {
      return (
        monitoreo.pendienteReceta &&
        typeof monitoreo.pendienteReceta === 'object' &&
        monitoreo.pendienteReceta[k] &&
        String(monitoreo.pendienteReceta[k]).trim()
      );
    })
  ) {
    confirmDietProposal(monitoreo);
  }
  for (var k of MED_FIELD_KEYS) {
    if (
      monitoreo.pendienteReceta &&
      typeof monitoreo.pendienteReceta === 'object' &&
      monitoreo.pendienteReceta[k]
    ) {
      confirmMedField(monitoreo, k);
    }
  }
}

/**
 * @param {string | null | undefined} activeId
 * @param {string} category
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 * @param {(nombreRaw: string) => string} classifyFn
 * @param {Date} [refDate] — día efectivo para ABX en label (default: hoy)
 * @returns {Array<{ value: string, label: string }>}
 */
export function buildMedDropdownOptions(activeId, category, medRecetaByPatient, classifyFn, refDate) {
  /** @type {Array<{ value: string, label: string }>} */
  var options = [];
  var seen = Object.create(null);
  var block = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  var items = block && Array.isArray(block.items) ? block.items : [];
  var fecha = category === 'abx' ? resolveManejoFechaActualizacion(activeId, medRecetaByPatient) : '';

  var rescateAdded = false;
  items.forEach(function (it) {
    if (!it || /** @type {{ suspendido?: boolean }} */ (it).suspendido) return;
    if (skipRecetaItemForInsulinPumpCarrier(it, items)) return;
    if (!shouldIncludeMedicationInSoap(
      /** @type {{ nombreRaw?: string, dosisRaw?: string, frecuenciaRaw?: string, suspendido?: boolean }} */ (it),
      classifyFn
    )) {
      return;
    }
    if (category === 'nm' && isInsulinRescateMedicationItem(it)) {
      if (!rescateAdded) {
        options.push({ value: INSULIN_RESCATE_NM_LABEL, label: INSULIN_RESCATE_NM_LABEL });
        rescateAdded = true;
      }
      return;
    }
    var cat = effectiveSoapCategory(
      /** @type {{ nombreRaw?: string, soapCatOverride?: string }} */ (it),
      classifyFn
    );
    var matchCat = cat === category || (category === 'diureticos' && cat === 'diuretico');
    if (!matchCat) return;
    if (category === 'nm' && skipRecetaItemForNmSoapBucket(it, items)) return;
    var value = medInstructionFragmentForSoap(/** @type {Parameters<typeof medInstructionFragmentForSoap>[0]} */ (it));
    if (!value || seen[value]) return;
    seen[value] = 1;
    var label =
      category === 'abx' && fecha
        ? formatMedicationSoapShort(
            /** @type {Parameters<typeof formatMedicationSoapShort>[0]} */ (it),
            { fechaActualizacion: fecha, refDate: refDate }
          )
        : value;
    options.push({ value: value, label: label });
  });

  return options;
}
