/** Fundamentos (sala / interconsulta) tour step copy. */
import { stepRequiresUserAction } from '../../tour-targets.mjs';
import { getUiDensity } from '../chrome.mjs';
import { hideTourDock } from './tour-engine.mjs';
import { LIVESYNC_BTN_COPY, MOBILE_SCOPE_COPY } from './tour-flow-guardia-copy.mjs';
import { tourState } from './tour-state.mjs';

function showNext(nextBtn, label) {
  nextBtn.style.display = '';
  nextBtn.textContent = label || 'Siguiente';
}

function hideNext(nextBtn) {
  nextBtn.style.display = 'none';
}

function finishNext(nextBtn) {
  showNext(nextBtn, 'Finalizar');
  nextBtn.setAttribute('onclick', 'guidedTourFinish()');
}

function getMapTabsCopy() {
  if (getUiDensity() !== 'normal') {
    return (
      '<p style="margin:0;line-height:1.5;">En <strong>Pase</strong> el centro es un <strong>resumen</strong> del paciente. Pulsa un bloque o usa <strong>Ctrl/⌘ + 1…4</strong> para abrir el detalle en vista <strong>Normal</strong>.</p>'
    );
  }
  if (tourState.guidedTourBranch === 'interconsulta') {
    return (
      '<p style="margin:0;line-height:1.5;">Arriba: <strong>Laboratorio</strong>, <strong>Expediente</strong>, <strong>Medicamentos</strong> y <strong>Agenda</strong>. Las pestañas internas del expediente vienen en el siguiente paso.</p>'
    );
  }
  return (
    '<p style="margin:0;line-height:1.5;">Arriba: <strong>Laboratorio</strong>, <strong>Expediente</strong>, <strong>Medicamentos</strong> y <strong>Agenda</strong>. El mapa del expediente lo verás al entrar en esa pestaña.</p>'
  );
}

function getMapLabTeaserCopy() {
  if (tourState.guidedTourBranch === 'interconsulta') {
    return (
      '<p style="margin:0;line-height:1.5;">El cuadro ya trae <strong>DEMO PÉREZ</strong> (dos días) y <strong>DEMO GARCÍA</strong> con el separador <strong>--- PACIENTE ---</strong>. Revisa el texto detrás y pulsa <strong>Siguiente</strong>.</p>'
    );
  }
  return (
    '<p style="margin:0;line-height:1.5;">El cuadro ya trae <strong>DEMO PÉREZ</strong> (dos días) y <strong>DEMO GARCÍA</strong>. En el siguiente paso pulsa <strong>Procesar</strong>: verás la <strong>vista previa multi-paciente</strong> y podrás dar de alta a cada uno en el censo.</p>'
  );
}

function getIcExportsDesktopLine() {
  if (!window.electronAPI || typeof window.electronAPI.getAppVersion !== 'function') return '';
  return (
    '<p style="margin:10px 0 0;font-size:12px;color:var(--text-muted);">Escritorio: <strong>⇄</strong> junto a Ajustes abre LAN; sync entre equipos en <strong>Respaldos, sync y recuperación</strong>.</p>'
  );
}

function getWrapPaseShortcutKey() {
  return navigator.platform && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}

function renderMapSidebar(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">La <strong>columna izquierda</strong> es tu censo. En este tour <strong>no hay pacientes precargados</strong>: registrarás a <strong>DEMO PÉREZ</strong> al procesar el laboratorio de ejemplo.</p>';
  showNext(nextBtn);
}

function renderMapTabs(bodyEl, nextBtn) {
  bodyEl.innerHTML = getMapTabsCopy();
  showNext(nextBtn);
}

function renderMapLabTeaser(bodyEl, nextBtn) {
  bodyEl.innerHTML = getMapLabTeaserCopy();
  showNext(nextBtn);
}

function renderLabParse(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Pulsa <strong>Procesar</strong>: verás la tabla con <strong>dos pacientes</strong> (PÉREZ y GARCÍA). En cada fila sin registrar usa <strong>Agregar paciente</strong>; el modal trae <strong>servicio</strong> y, en el tour, <strong>cuarto y cama</strong> sugeridos (revisa y ajusta si hace falta).</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">No hay <strong>Siguiente</strong> hasta que ambos tengan laboratorio en historial.</p>';
  hideNext(nextBtn);
}

function renderLabView(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Revisa diagramas y tabla de resultados. En <strong>Resultados</strong>, el menú <strong>⋯</strong> incluye <strong>Consolidar</strong> para juntar envíos del mismo día (mismo tipo de dato).</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa <strong>Siguiente</strong> para continuar el tour.</p>';
  showNext(nextBtn);
}

function renderIcExpedienteTabs(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En <strong>Interconsulta</strong>, el expediente se agrupa en cuatro pestañas: <strong>Paciente</strong> (datos colapsables + pendientes), <strong>Clínico</strong> (Nota, Indicaciones), <strong>Resultados</strong> (Tendencias, Cultivos) y <strong>Salida</strong> (Receta HU en PDF).</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);"><strong>Receta HU</strong> exporta el PDF oficial 000-061-R-06-12. <strong>Nota</strong> e <strong>Indicaciones</strong> van a Word (.docx).</p>';
  showNext(nextBtn);
}

function renderSalaExpedienteTabs(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En <strong>Sala</strong>, el expediente tiene cuatro pestañas: <strong>Paciente</strong>, <strong>Clínico</strong>, <strong>Resultados</strong> y <strong>Salida</strong>.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);"><strong>Clínico</strong>: Historia Clínica → <strong>Estado actual</strong> → Eventualidades. <strong>Resultados</strong>: tendencias. <strong>Salida</strong>: Listado, <strong>VPO</strong> y <strong>Receta HU</strong>. Peso/talla en <strong>Paciente</strong>.</p>';
  showNext(nextBtn);
}

function renderHistoriaClinica(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Expediente → Clínico → Historia Clínica</strong>: ingreso institucional en <strong>3 pasos</strong> (identificación, antecedentes APP/AHF/APNP/IPAS, padecimiento). Cambia a <strong>Lectura</strong> para ver el texto compilado y <strong>Copiar</strong>.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Solo en <strong>Sala</strong>. En sala en vivo (⇄) se sincroniza por paciente con el anfitrión.</p>';
  showNext(nextBtn);
}

function renderIcNota(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Genera la <strong>Nota (.docx)</strong> desde el botón correspondiente (motor nativo en Node; no requiere Python). Si el servidor local falla, puedes <strong>Omitir</strong> el tutorial.</p>';
  hideNext(nextBtn);
}

function renderIcIndica(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Exporta las <strong>Indicaciones (.docx)</strong> para entrega o impresión (mismo generador nativo que la Nota).</p>';
  hideNext(nextBtn);
}

function renderIcExports(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En <strong>Ajustes (⚙)</strong>: carpeta de documentos, formato de <strong>salida rápida</strong>, respaldos y sync. En <strong>Laboratorio → duplicados</strong> puedes revisar todos los pacientes.</p>' +
    getIcExportsDesktopLine();
  showNext(nextBtn);
}

function renderSalaTend(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En <strong>Expediente → Tendencias</strong> ves mini-gráficas cuando hay varios laboratorios en el tiempo.</p>';
  showNext(nextBtn);
}

function renderSalaTendChart(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Pulsa <strong>Gráfica</strong> en un estudio (p. ej. biometría) para ver tendencias agrupadas y una tabla copiable.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Cierra con clic fuera de la ventana o <strong>Esc</strong>. Es opcional en el demo: <strong>Siguiente</strong> para continuar.</p>';
  showNext(nextBtn);
}

function renderSalaSoap(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0 0 8px;line-height:1.5;"><strong>Expediente → Nota</strong>: en la tarjeta verde de evolución, el botón <strong>Plantilla SOAP</strong> está arriba a la derecha del encabezado verde (lleva resaltado).</p>' +
    '<p style="margin:0;font-size:13px;color:var(--text-muted);">Ábrelo e inserta en evolución cuando quieras.</p>';
  showNext(nextBtn);
}

function renderSalaMed(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Pulsa <strong>Importar SOME</strong>, pega el bloque TSV del hospital y procesa la receta. Marca filas para <strong>SOAP</strong> o <strong>Tratamiento</strong>; el demo ya trae dos fármacos de ejemplo.</p>';
  showNext(nextBtn);
}

function renderProfile(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Mi Perfil</strong> (nombre arriba): médico, plantillas y valores por defecto. <strong>Ajustes</strong>: carpeta, tema, respaldos y ayuda. <strong>Siguiente</strong>: sincronización en equipo (⇄) y versión móvil.</p>';
  showNext(nextBtn);
}

function renderServicioDefault(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Escribe tu <strong>Servicio (Sala)</strong> en Mi Perfil (nombre completo, sin abreviaturas) y sal del campo para guardar. Luego <strong>Siguiente</strong>.</p>';
  showNext(nextBtn);
}

function renderEstadoActual(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En <strong>Clínico → Estado actual</strong> el <strong>snapshot</strong> resume el turno (SV, glu, I/O, medicamentos). Abajo, las <strong>gráficas</strong> muestran tendencias por familia (hemodinámico, respiratorio, metabólico) con puntos alterados resaltados.</p>' +
    '<p style="margin:10px 0 0;line-height:1.5;">El historial de mediciones y el texto compilado para la nota están en esta misma pestaña. El demo trae tomas de <strong>hoy</strong> (TM, TV, TN).</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa <strong>Siguiente</strong> para practicar un <strong>registro manual</strong>.</p>';
  showNext(nextBtn);
}

function renderEstadoActualRegistro(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Modal <strong>Registrar medición</strong>: <strong>signos vitales</strong> (varias capas por turno), <strong>glucometrías</strong> y bomba de insulina, <strong>I/O</strong> y evacuaciones, más campos de soporte y dieta.</p>' +
    '<p style="margin:10px 0 0;line-height:1.5;">El ejemplo trae turno matutino precargado. Revisa y pulsa <strong>Registrar</strong>; el tour te guiará por el panel actualizado.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Sin <strong>Siguiente</strong> hasta registrar.</p>';
  hideNext(nextBtn);
}

function renderEstadoActualReview(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Tras registrar, revisa tres zonas en esta pestaña: el <strong>snapshot</strong> (resumen del turno), las <strong>gráficas</strong> por familia con alertas, y el <strong>historial</strong> con texto compilado copiable a la nota.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Desplázate si hace falta. <strong>Siguiente</strong>: <strong>Eventualidades</strong>.</p>';
  showNext(nextBtn);
}

function renderEventualidades(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Eventualidades</strong> es la línea de tiempo del ingreso: evolución subjetiva y procedimientos por día. El demo trae <strong>tres días</strong> de notas breves.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Puedes editar, agregar o borrar entradas. Pulsa <strong>Siguiente</strong>.</p>';
  showNext(nextBtn);
}

function renderListadoProblemas(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Expediente → Salida → Listado</strong>: exporta problemas activos e inactivos a Word (título + incisos <strong>A) CLÍNICA</strong>, <strong>B) EXPLORACIÓN</strong>, etc.).</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">El demo trae un ejemplo. Pulsa <strong>Generar Listado</strong> (resaltado) o <strong>Siguiente</strong>.</p>';
  showNext(nextBtn);
}

function renderSalaVpo(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Expediente → Salida → VPO</strong>: documenta escalas de riesgo (ASA, RCRI, Gupta, ARISCAT, Caprini) con el resultado que obtengas en tu calculadora; EKG/Rx editables y texto copiable. Solo en <strong>Sala</strong>.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Completa o revisa los campos resaltados y pulsa <strong>Siguiente</strong>.</p>';
  showNext(nextBtn);
}

function renderSalaRecetaHu(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;"><strong>Expediente → Salida → Receta HU</strong>: receta médica en formato oficial <strong>000-061-R-06-12</strong> (PDF). Medicamentos, estudios y cuidados; botón <strong>Exportar PDF</strong> cuando esté listo.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">En el tutorial no hace falta exportar; <strong>Siguiente</strong> para la <strong>Agenda</strong>.</p>';
  showNext(nextBtn);
}

function renderSalaAgenda(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">La pestaña <strong>Agenda</strong> (arriba) concentra <strong>procedimientos programados</strong> del servicio: cirugías, estudios y pendientes del turno, enlazados al paciente cuando aplica.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Con <strong>⇄ LiveSync</strong> la agenda se comparte en la sala. <strong>Siguiente</strong>: sincronización en equipo.</p>';
  showNext(nextBtn);
}

function renderLivesyncDesktop(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">' +
    LIVESYNC_BTN_COPY +
    ' abre la sala en vivo: activa la red del turno y luego <strong>creas una sala</strong> o <strong>te unes</strong> a una existente. En iPad u otra Mac pegas el enlace de invitación.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa el icono Wi‑Fi para abrir el panel; aparece <strong>Siguiente</strong> cuando esté visible.</p>';
  if (stepRequiresUserAction('livesync_desktop')) hideNext(nextBtn);
}

function renderLivesyncMobile(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">En LiveSync usa <strong>Copiar enlace móvil</strong> y ábrelo en Safari (misma Wi‑Fi). ' +
    MOBILE_SCOPE_COPY +
    '</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">El Mac anfitrión debe tener R+ abierto y la <strong>misma sala LiveSync</strong> que el equipo de escritorio.</p>';
  showNext(nextBtn);
}

function renderWrap(bodyEl, nextBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Listo. Repite el tutorial desde <strong>Mi Perfil</strong> o <strong>Ajustes</strong>. Para el equipo en vivo usa <strong>LiveSync</strong> y, si hace falta, el enlace móvil.</p>' +
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);"><strong>Modo Pase</strong> (resumen de ronda): prueba el atajo <strong>' +
    getWrapPaseShortcutKey() +
    '+P</strong> o <strong>Ajustes → Modo de vista → Pase</strong> cuando quieras ver pendientes, labs y meds en una sola columna.</p>';
  finishNext(nextBtn);
}

const FUNDAMENTOS_STEP_HANDLERS = {
  map_sidebar: renderMapSidebar,
  map_tabs: renderMapTabs,
  map_lab_teaser: renderMapLabTeaser,
  lab_parse: renderLabParse,
  lab_view: renderLabView,
  ic_expediente_tabs: renderIcExpedienteTabs,
  sala_expediente_tabs: renderSalaExpedienteTabs,
  historia_clinica: renderHistoriaClinica,
  ic_nota: renderIcNota,
  ic_indica: renderIcIndica,
  ic_exports: renderIcExports,
  sala_tend: renderSalaTend,
  sala_tend_chart: renderSalaTendChart,
  sala_soap: renderSalaSoap,
  sala_med: renderSalaMed,
  profile: renderProfile,
  servicio_default: renderServicioDefault,
  estado_actual: renderEstadoActual,
  estado_actual_registro: renderEstadoActualRegistro,
  estado_actual_review: renderEstadoActualReview,
  eventualidades: renderEventualidades,
  listado_problemas: renderListadoProblemas,
  sala_vpo: renderSalaVpo,
  sala_receta_hu: renderSalaRecetaHu,
  sala_agenda: renderSalaAgenda,
  livesync_desktop: renderLivesyncDesktop,
  livesync_mobile: renderLivesyncMobile,
  wrap: renderWrap,
};

function renderFundamentosStep(stepId, bodyEl, nextBtn) {
  var handler = FUNDAMENTOS_STEP_HANDLERS[stepId];
  if (!handler) {
    hideTourDock();
    return;
  }
  handler(bodyEl, nextBtn);
}

export { renderFundamentosStep };
