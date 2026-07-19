import { normalizeOptionalTodoString } from './storage-lab.mjs';

/** @param {unknown} rawP @returns {'alta'|'media'|'baja'} */
export function normalizeTodoPriority(rawP) {
  return rawP === 'alta' || rawP === 'baja' || rawP === 'media' ? rawP : 'media';
}

function readTodoString(t, key, fallback) {
  return String(t && t[key] != null ? t[key] : fallback);
}

function readTodoOptionalFields(t) {
  return {
    dueDate: normalizeOptionalTodoString(t && t.dueDate),
    reminderAt: normalizeOptionalTodoString(t && t.reminderAt),
    createdBy: normalizeOptionalTodoString(t && t.createdBy),
    completedAt: normalizeOptionalTodoString(t && t.completedAt),
    completedBy: normalizeOptionalTodoString(t && t.completedBy),
    handoffAcknowledgedAt: normalizeOptionalTodoString(t && t.handoffAcknowledgedAt),
    handoffAcknowledgedBy: normalizeOptionalTodoString(t && t.handoffAcknowledgedBy),
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} t
 * @param {string} fallbackNow
 */
export function normalizeTodoRow(t, fallbackNow) {
  const createdAt = readTodoString(t, 'createdAt', fallbackNow);
  const updatedAt = readTodoString(t, 'updatedAt', createdAt || fallbackNow);
  return Object.assign(
    {
      id: readTodoString(t, 'id', ''),
      text: readTodoString(t, 'text', ''),
      completed: !!(t && t.completed),
      priority: normalizeTodoPriority(t && t.priority),
      createdAt,
      updatedAt,
    },
    readTodoOptionalFields(t)
  );
}

/** @param {Record<string, unknown> | null | undefined} st */
function normalizeSoapTokenArrays(st) {
  return {
    vasop: Array.isArray(st.vasop) ? st.vasop : [],
    abx: Array.isArray(st.abx) ? st.abx : [],
    analgesia: Array.isArray(st.analgesia) ? st.analgesia : [],
    antihta: Array.isArray(st.antihta) ? st.antihta : [],
  };
}

/** @param {Record<string, unknown> | null | undefined} catalog */
export function buildMedCatalogShape(catalog) {
  const c = catalog && typeof catalog === 'object' ? catalog : {};
  const st = c.soapTokens && typeof c.soapTokens === 'object' ? c.soapTokens : {};
  const sp = c.somePharm && typeof c.somePharm === 'object' ? c.somePharm : {};
  const spt = sp.tokens && typeof sp.tokens === 'object' ? sp.tokens : {};
  return {
    v: typeof c.v === 'number' ? c.v : 1,
    accents: c.accents && typeof c.accents === 'object' ? c.accents : {},
    soapTokens: normalizeSoapTokenArrays(st),
    somePharm: { tokens: spt },
  };
}

/** @param {Record<string, unknown> | null | undefined} catalog */
export function buildMedCatalogPayload(catalog) {
  const shaped = buildMedCatalogShape(catalog);
  return {
    v: 1,
    accents: shaped.accents,
    soapTokens: shaped.soapTokens,
    somePharm: shaped.somePharm,
  };
}
