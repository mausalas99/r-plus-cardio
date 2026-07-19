// Built from app.js refactor — Plantilla SOAP (modal) + Estado Actual (Sala)
import { patients, notes, saveState } from "../app-state.mjs";
import { isModeSala } from "../mode-features.mjs";
import { closeModalAnimated } from "../ui-motion.mjs";
import { ensureMonitoreo, migratePatientMonitoreo } from "./estado-actual-data.mjs";
import { formatNmDietClause } from "./estado-actual-diet-text.mjs";
import { SOAP_LEGACY_MED_FIELD_IDS } from "./soap-legacy-field-map.mjs";

let rt = {
  getActiveId() {
    return null;
  },
  showToast() {},
  getSettings() {
    return {};
  },
};

export function registerSoapEstadoRuntime(ctx) {
  if (!ctx || typeof ctx !== "object") return;
  Object.assign(rt, ctx);
}

/** Volcado medicinal → campos SOAP (desde pestaña Medicamentos). */
export function mergeSoapMedField(fieldId, fragment) {
  var el = document.getElementById(fieldId);
  if (!el || !fragment) return;
  var f = String(fragment).trim();
  if (!f) return;
  var cur = el.value.trim();
  el.value = cur ? cur + " | " + f : f;
}

export function openSOAPModalDirect() {
  var bd = document.getElementById("soap-modal-backdrop");
  if (bd) bd.classList.add("open");
}

export async function copyToClipboardSafe(text) {
  var t = text == null ? "" : String(text);
  if (
    typeof window !== "undefined" &&
    window.electronAPI &&
    typeof window.electronAPI.writeClipboardText === "function"
  ) {
    try {
      if (await window.electronAPI.writeClipboardText(t)) return true;
    } catch (_e) { void _e; }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch (_e) { void _e; }
  try {
    var ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function openSOAPModal() {
  var activeId = rt.getActiveId();
  if (!activeId) {
    rt.showToast("Selecciona un paciente primero", "error");
    return;
  }
  var existing =
    notes[activeId] && notes[activeId].evolucion ? notes[activeId].evolucion.trim() : "";
  if (existing) {
    var backdrop = document.createElement("div");
    backdrop.className = "lab-conflict-backdrop";
    backdrop.id = "soap-confirm-backdrop";
    backdrop.innerHTML =
      '<div class="lab-conflict-modal">' +
      "<h3>¿Reemplazar evolución?</h3>" +
      "<p>La evolución ya tiene contenido. ¿Reemplazarlo con la plantilla?</p>" +
      '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
      '<button onclick="document.getElementById(\'soap-confirm-backdrop\').remove()" style="background:#F3F4F6;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Cancelar</button>' +
      '<button onclick="document.getElementById(\'soap-confirm-backdrop\').remove();document.getElementById(\'soap-modal-backdrop\').classList.add(\'open\')" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Reemplazar</button>' +
      "</div></div>";
    document.body.appendChild(backdrop);
  } else {
    document.getElementById("soap-modal-backdrop").classList.add("open");
  }
}

export function closeSOAPModal() {
  closeModalAnimated(document.getElementById("soap-modal-backdrop"));
  [
    "soap-s",
    "soap-four",
    "soap-esferas",
    "soap-fr",
    "soap-sat",
    "soap-tas",
    "soap-tad",
    "soap-fc",
    "soap-temp",
    "soap-dieta",
    "soap-kcalkg",
    "soap-kcal",
    "soap-peso",
    "soap-ing",
    "soap-egr",
    "soap-balance",
    "soap-glu1",
    "soap-glu2",
    "soap-glu3",
    "soap-insulina",
    "soap-rescates-insulina",
  ]
    .concat(SOAP_LEGACY_MED_FIELD_IDS)
    .forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  var sel = document.getElementById("soap-soporte");
  if (sel) sel.selectedIndex = 0;
  document.body.removeAttribute("data-estado-actual-mode");
  var title = document.getElementById("soap-modal-title-text");
  if (title) title.textContent = "Plantilla de Evolución";
}

export function openEstadoActualModal() {
  var activeId = rt.getActiveId();
  if (!activeId) {
    rt.showToast("Selecciona un paciente primero", "error");
    return;
  }
  if (isModeSala(rt.getSettings())) {
    if (typeof rt.navigateToEstadoActualPanel === "function") {
      rt.navigateToEstadoActualPanel();
    }
    return;
  }
  document.body.setAttribute("data-estado-actual-mode", "true");
  var title = document.getElementById("soap-modal-title-text");
  if (title) title.textContent = "Estado Actual";
  var s = document.getElementById("soap-s");
  if (s) s.value = "";
  document.getElementById("soap-modal-backdrop").classList.add("open");
}

function estadoActualTextForCopy() {
  var s = document.getElementById("soap-s");
  if (s) s.value = "";
  return buildSOAPText().replace(/^\s*\n+/, "");
}

export async function estadoActualOnlyGuardar() {
  if (!rt.getActiveId()) return;
  if (isModeSala(rt.getSettings())) {
    /** @type {any} */
    var gSave = typeof globalThis !== "undefined" ? globalThis : {};
    if (typeof gSave.estadoActualGuardar === "function") {
      gSave.estadoActualGuardar();
      closeSOAPModal();
      return;
    }
  }
  var activeId = rt.getActiveId();
  var patient = patients.find(function (p) {
    return p.id === activeId;
  });
  if (!patient) return;
  var text = estadoActualTextForCopy();
  if (!text.trim()) {
    rt.showToast("No hay texto para guardar", "error");
    return;
  }
  migratePatientMonitoreo(patient);
  ensureMonitoreo(patient);
  patient.monitoreo.textoGuardado = {
    text: text,
    savedAt: new Date().toISOString(),
  };
  saveState();
  renderEstadoActualBar();
  rt.showToast("Estado Actual guardado ✓", "success");
  closeSOAPModal();
}

export async function estadoActualSaveAndCopy() {
  var activeId = rt.getActiveId();
  if (!activeId) return;
  if (isModeSala(rt.getSettings())) {
    /** @type {any} */
    var gSave = typeof globalThis !== "undefined" ? globalThis : {};
    if (typeof gSave.estadoActualGuardarCopiar === "function") {
      await gSave.estadoActualGuardarCopiar();
      closeSOAPModal();
      return;
    }
  }
  var patient = patients.find(function (p) {
    return p.id === activeId;
  });
  if (!patient) return;
  var text = estadoActualTextForCopy();
  migratePatientMonitoreo(patient);
  ensureMonitoreo(patient);
  patient.monitoreo.textoGuardado = {
    text: text,
    savedAt: new Date().toISOString(),
  };
  saveState();
  renderEstadoActualBar();
  var ok = await copyToClipboardSafe(text);
  rt.showToast(
    ok ? "Estado Actual guardado y copiado ✓" : "Guardado, pero no se pudo copiar",
    ok ? "success" : "error"
  );
  closeSOAPModal();
}

export function renderEstadoActualBar() {
  var meta = document.getElementById("estado-actual-meta");
  if (!meta) return;
  var sala = isModeSala(rt.getSettings());
  var activeId = rt.getActiveId();
  if (!sala || !activeId) {
    meta.textContent = "";
    return;
  }
  var patient = patients.find(function (p) {
    return p.id === activeId;
  });
  if (patient) {
    migratePatientMonitoreo(patient);
  }
  var tg = patient && patient.monitoreo && patient.monitoreo.textoGuardado;
  if (tg && tg.savedAt) {
    var d = new Date(tg.savedAt);
    if (!isNaN(d.getTime())) {
      var label =
        String(d.getDate()).padStart(2, "0") +
        "/" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "/" +
        d.getFullYear() +
        " · " +
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0");
      meta.textContent = "Guardado " + label;
      return;
    }
  }
  meta.textContent = "";
}

export function updateSOAPBalance() {
  var ing = parseFloat(document.getElementById("soap-ing").value);
  var egr = parseFloat(document.getElementById("soap-egr").value);
  var bal = document.getElementById("soap-balance");
  if (!isNaN(ing) && !isNaN(egr)) {
    var diff = ing - egr;
    bal.value = (diff > 0 ? "+" : "") + diff;
  } else {
    bal.value = "";
  }
}

function soapFieldValue(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function soapUpperOrBlank(v) {
  return v ? v.toUpperCase() : '___';
}

function soapNumOrBlank(v) {
  return v !== '' ? v : '___';
}

function soapBalanceText(ing, egr) {
  if (!ing || !egr) return '___';
  var d = parseFloat(ing) - parseFloat(egr);
  return (d > 0 ? '+' : '') + d;
}

var SOAP_SOPORTE_MAP = {
  'Aire ambiente': 'AL AIRE AMBIENTE',
  'Puntillas nasales': 'POR PUNTILLAS NASALES',
  'Alto flujo': 'POR ALTO FLUJO',
  'VM no invasiva': 'CON VENTILACIÓN MECÁNICA NO INVASIVA',
  Traqueostomía: 'CON TRAQUEOSTOMÍA',
};

function legacyMedsClause(fieldId, g) {
  var v = g(fieldId);
  return v ? v.toUpperCase() : "";
}

function buildSoapObjectiveLines(g, val, num, soporte, ing, egr, balance) {
  var analgesia = legacyMedsClause("soap-analgesia", g);
  var antiemeticos = legacyMedsClause("soap-antiemeticos", g);
  var sedacion = legacyMedsClause("soap-sedacion", g);
  var antiepilepticos = legacyMedsClause("soap-antiepilepticos", g);
  var antiparkinsonianos = legacyMedsClause("soap-antiparkinsonianos", g);
  var antidotos = legacyMedsClause("soap-antidotos", g);
  var viaAerea = legacyMedsClause("soap-via-aerea", g);
  var vasop = legacyMedsClause("soap-vasop", g);
  var antihta = legacyMedsClause("soap-antihta", g);
  var antitromboticos = legacyMedsClause("soap-antitromboticos", g);
  var anticoagulacion = legacyMedsClause("soap-anticoagulacion", g);
  var antiarritmicos = legacyMedsClause("soap-antiarritmicos", g);
  var diureticos = legacyMedsClause("soap-diureticos", g);
  var estatinas = legacyMedsClause("soap-estatinas", g);
  var abx = legacyMedsClause("soap-abx", g);
  var transfusiones = legacyMedsClause("soap-transfusiones", g);
  var nmSoporte = legacyMedsClause("soap-nm-soporte", g);
  var insulina = legacyMedsClause("soap-insulina", g);
  var rescatesInsulina = legacyMedsClause("soap-rescates-insulina", g);
  /** @type {string[]} */
  var nmParts = [
    formatNmDietClause({ dieta: g("soap-dieta"), kcalKg: g("soap-kcalkg") }, g("soap-kcal"), {
      includeProtein: false,
    }),
  ];
  if (nmSoporte) nmParts.push(nmSoporte);
  nmParts.push(
    "INGRESOS " + num(ing) + " CC, DIURESIS " + num(egr) + " CC, BALANCE " + balance + " CC"
  );
  var glu1 = g("soap-glu1");
  var glu2 = g("soap-glu2");
  var glu3 = g("soap-glu3");
  if (glu1 || glu2 || glu3) {
    nmParts.push(
      "GLUCOMETRÍAS CAPILARES (" + num(glu1) + ", " + num(glu2) + ", " + num(glu3) + " MG/DL)"
    );
  }
  if (rescatesInsulina) nmParts.push(rescatesInsulina);
  if (insulina) nmParts.push("INSULINA: " + insulina);
  return [
    "N: FOUR " +
      num(g("soap-four")) +
      "/16 PUNTOS, SIN DATOS DE FOCALIZACIÓN, ORIENTADO EN " +
      num(g("soap-esferas")) +
      " ESFERAS, ALERTA || ANALGESIA: " +
      analgesia +
      " | ANTIEMETICOS: " +
      antiemeticos +
      " | SEDACION: " +
      sedacion +
      " | ANTIEPILEPTICOS: " +
      antiepilepticos +
      " | ANTIPARKINSONIANOS: " +
      antiparkinsonianos +
      " | ANTIDOTOS: " +
      antidotos,
    "V: FR " +
      num(g("soap-fr")) +
      " RPM, SATO2 " +
      num(g("soap-sat")) +
      "% " +
      soporte +
      " | SIN DATOS DE DIFICULTAD RESPIRATORIA || CAMPOS PULMONARES BIEN VENTILADOS" +
      (viaAerea ? " || VIA AEREA: " + viaAerea : ""),
    "HD: ESTABLE, TA " +
      num(g("soap-tas")) +
      "/" +
      num(g("soap-tad")) +
      " MMHG, FC " +
      num(g("soap-fc")) +
      " LPM || VASOPRESORES: " +
      vasop +
      " | ANTIHIPERTENSIVOS: " +
      antihta +
      " | TROMBOPROFILAXIS: " +
      antitromboticos +
      " | ANTICOAGULACION: " +
      anticoagulacion +
      " | ANTIARRITMICOS: " +
      antiarritmicos +
      " | DIURÉTICOS: " +
      diureticos +
      " | ESTATINAS: " +
      estatinas,
    "HI: AFEBRIL, TEMPERATURA " +
      num(g("soap-temp")) +
      " °C || ANTIBIOTICOTERAPIA: " +
      abx +
      (transfusiones ? " | TRANSFUSIONES: " + transfusiones : ""),
    "NM: " + nmParts.join(" || "),
  ];
}

export function buildSOAPText() {
  var g = soapFieldValue;
  var val = soapUpperOrBlank;
  var num = soapNumOrBlank;
  var soporte = SOAP_SOPORTE_MAP[g('soap-soporte')] || 'AL AIRE AMBIENTE';
  var ing = g('soap-ing');
  var egr = g('soap-egr');
  var balance = soapBalanceText(ing, egr);
  var lines = [];
  var subj = g('soap-s');
  if (subj) {
    lines.push('S: ' + subj);
    lines.push('');
  }
  lines.push.apply(lines, buildSoapObjectiveLines(g, val, num, soporte, ing, egr, balance));
  return lines.join('\n');
}

export function insertSOAPText() {
  var activeId = rt.getActiveId();
  if (!activeId) {
    rt.showToast("Selecciona un paciente primero", "error");
    return;
  }
  var text = buildSOAPText();
  if (!notes[activeId]) notes[activeId] = {};
  notes[activeId].evolucion = text;
  saveState();
  var el = document.querySelector('#note-form textarea[oninput*="evolucion"]');
  if (el) el.value = text;
  closeSOAPModal();
  rt.showToast("Plantilla insertada ✓", "success");
}

/** Task 9 — chrome del botón compacto Estado Actual */
export function renderEstadoActualButton() {
  /* Task 9 */
}

export const windowHandlers = {
  closeSOAPModal,
  insertSOAPText,
  updateSOAPBalance,
  openSOAPModal,
  openEstadoActualModal,
  estadoActualOnlyGuardar,
  estadoActualSaveAndCopy,
};
