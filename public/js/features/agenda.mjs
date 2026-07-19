// Built from app.js refactor — Agenda semanal de procedimientos + modal editor
import { storage } from "../storage.js";
import {
  mondayStartLocal,
  addDaysLocal,
  weekBoundsFromMonday,
} from "../procedure-agenda-week.mjs";
import { patients } from "../app-state.mjs";
import { isPaseMode } from "./chrome.mjs";
import { closeModalAnimated } from "../ui-motion.mjs";
import { emitLiveSyncAgendaUpsert, emitLiveSyncAgendaDelete } from "./lan-sync.mjs";
import {
  buildAgendaBoardHead,
  buildAgendaTimesColumn,
  collectAgendaClipsByDay,
  buildAgendaDayColumn,
} from "./agenda-panel-render.mjs";
import {
  fillProcedureAgendaModalForEdit,
  fillProcedureAgendaModalForNew,
  syncProcedureAgendaModalDatetime,
  validateProcedureAgendaForm,
  buildProcedureAgendaEvent,
} from "./agenda-modal-helpers.mjs";

let rt = {
  getActiveId() {
    return null;
  },
  showToast() {},
  renderPaseBoard() {},
};

export function registerProcedureAgendaRuntime(ctx) {
  if (!ctx || typeof ctx !== "object") return;
  Object.assign(rt, ctx);
}

/** @type {number} -1 pasado, 0 actual, +1 siguiente (spec agenda semanal) */
var procedureAgendaWeekOffset = 0;

function agendaEligiblePatients() {
  return patients.filter(function (p) {
    if (!p) return false;
    if (p.isDemo) return false;
    if (String(p.id).indexOf("demo-") === 0) return false;
    return true;
  });
}

function getProcedureAgendaMondayAnchor() {
  var base = mondayStartLocal(new Date());
  var dt = addDaysLocal(base, procedureAgendaWeekOffset * 7);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function formatProcedureAgendaRangeLabel(monday) {
  try {
    var sun = addDaysLocal(monday, 6);
    var oDay = { day: "numeric" };
    var oWd = { weekday: "short" };
    var oMon = { month: "short" };
    var a =
      monday.toLocaleDateString("es", oWd).replace(".", "") +
      " " +
      monday.toLocaleDateString("es", oDay) +
      " " +
      monday.toLocaleDateString("es", oMon);
    var b =
      sun.toLocaleDateString("es", oWd).replace(".", "") +
      " " +
      sun.toLocaleDateString("es", oDay) +
      " " +
      sun.toLocaleDateString("es", oMon) +
      " " +
      sun.getFullYear();
    return a.charAt(0).toUpperCase() + a.slice(1) + " — " + b;
  } catch {
    return "";
  }
}

function syncProcedureAgendaNavButtons() {
  var prevBtn = document.getElementById("procedure-agenda-prev");
  var nextBtn = document.getElementById("procedure-agenda-next");
  if (prevBtn) prevBtn.disabled = procedureAgendaWeekOffset <= -1;
  if (nextBtn) nextBtn.disabled = procedureAgendaWeekOffset >= 1;
}

export function navigateProcedureAgendaWeek(delta) {
  procedureAgendaWeekOffset = Math.max(-1, Math.min(1, procedureAgendaWeekOffset + delta));
  renderProcedureAgendaPanel();
}

export function renderProcedureAgendaPanel() {
  var mount = document.getElementById("procedure-agenda-grid-mount");
  var rangeEl = document.getElementById("procedure-agenda-range");
  if (!mount || !rangeEl) return;
  syncProcedureAgendaNavButtons();
  var monday = getProcedureAgendaMondayAnchor();
  rangeEl.textContent = formatProcedureAgendaRangeLabel(monday);
  var week = weekBoundsFromMonday(monday);

  var elig = agendaEligiblePatients();
  var pmap = {};
  elig.forEach(function (p) {
    pmap[String(p.id)] = String(p.nombre || "").trim();
  });

  var newBtn = document.getElementById("procedure-agenda-new");
  if (newBtn) newBtn.disabled = elig.length === 0;

  var board = document.createElement("div");
  board.appendChild(buildAgendaBoardHead(monday));

  var bodyRow = document.createElement("div");
  bodyRow.className = "rpc-proc-agenda-board-body";
  bodyRow.appendChild(buildAgendaTimesColumn(monday));

  var clipsByDay = collectAgendaClipsByDay(monday, week, pmap);
  for (var iDay = 0; iDay < 7; iDay += 1) {
    bodyRow.appendChild(buildAgendaDayColumn(iDay, monday, clipsByDay[iDay], openProcedureAgendaModal));
  }

  board.appendChild(bodyRow);
  mount.innerHTML = "";
  mount.appendChild(board);
  if (isPaseMode()) rt.renderPaseBoard();
}

export function openProcedureAgendaModal(editEventId) {
  var bd = document.getElementById("procedure-agenda-modal");
  if (!bd) return;
  var errEl = document.getElementById("pa-modal-error");
  var delBtn = document.getElementById("pa-btn-delete");
  if (errEl) {
    errEl.style.display = "none";
    errEl.textContent = "";
  }

  document.getElementById("pa-edit-id").value = editEventId || "";
  var elig = agendaEligiblePatients();
  var sel = document.getElementById("pa-patient");
  if (sel) {
    sel.innerHTML = "";
    elig.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = String(p.id);
      opt.textContent = String(p.nombre || p.id);
      sel.appendChild(opt);
    });
  }

  if (delBtn) delBtn.style.display = editEventId ? "inline-flex" : "none";
  if (editEventId) fillProcedureAgendaModalForEdit(editEventId, elig);
  else fillProcedureAgendaModalForNew(elig, rt.getActiveId);

  syncProcedureAgendaModalDatetime();
  bd.classList.add("open");
  bd.setAttribute("aria-hidden", "false");
}

export function closeProcedureAgendaModal() {
  var bd = document.getElementById("procedure-agenda-modal");
  if (!bd) return;
  closeModalAnimated(bd);
}

export function saveProcedureAgendaFromModal() {
  var errEl = document.getElementById("pa-modal-error");
  function showPaErr(msg) {
    errEl.style.display = "block";
    errEl.textContent = msg;
    rt.showToast(msg, "error");
  }
  if (errEl) {
    errEl.style.display = "none";
    errEl.textContent = "";
  }

  var elig = agendaEligiblePatients();
  var validated = validateProcedureAgendaForm(elig);
  if (!validated.ok) {
    showPaErr(validated.msg);
    return;
  }

  var eventObj = buildProcedureAgendaEvent(validated);
  var arr = storage.getScheduledProcedures();
  var next;
  if (validated.editId) {
    next = arr.map(function (e) {
      return e.id === validated.editId ? eventObj : e;
    });
    if (!next.some(function (e) { return e.id === validated.editId; })) next.push(eventObj);
  } else {
    next = arr.concat([eventObj]);
  }
  storage.saveScheduledProcedures(next);
  emitLiveSyncAgendaUpsert(eventObj);
  closeProcedureAgendaModal();
  rt.showToast("Procedimiento guardado", "success");
  renderProcedureAgendaPanel();
}

export function deleteProcedureAgendaFromModal() {
  var editId = (document.getElementById("pa-edit-id").value || "").trim();
  if (!editId) return;
  if (
    !confirm(
      "¿Eliminar este procedimiento de la agenda? No se puede deshacer desde aquí."
    )
  )
    return;
  var delAt = new Date().toISOString();
  var arr = storage.getScheduledProcedures().filter(function (e) {
    return e.id !== editId;
  });
  storage.saveScheduledProcedures(arr);
  emitLiveSyncAgendaDelete(editId, delAt);
  closeProcedureAgendaModal();
  rt.showToast("Eliminado de la agenda", "success");
  renderProcedureAgendaPanel();
}

export const windowHandlers = {
  navigateProcedureAgendaWeek,
  openProcedureAgendaModal,
  closeProcedureAgendaModal,
  saveProcedureAgendaFromModal,
  deleteProcedureAgendaFromModal,
};
