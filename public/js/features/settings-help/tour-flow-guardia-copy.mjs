/** Guardia 7.x tour step copy and HTML helpers. */
import { stepRequiresUserAction } from '../../tour-targets.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';

const rt = getSettingsHelpRuntime();

export const MOBILE_SCOPE_COPY =
  'La app móvil (iPad/Safari) muestra tablero de guardia y expediente esencial; no incluye Ajustes, exportaciones Word ni todas las pestañas de escritorio.';

export const LIVESYNC_BTN_COPY =
  '<strong>LiveSync</strong> (icono <strong>Wi‑Fi</strong> junto a Ajustes)';

function getClinicalRankForTour() {
  try {
    const st = rt.getSettings();
    return String(st?.clinicalRank || 'R1').trim().toUpperCase();
  } catch {
    return 'R1';
  }
}

const GV7_HELP_ARTICLE = {
  gv7_guardia_chip: 'modo-guardia',
  gv7_guardia_tab: 'modo-guardia',
  gv7_guardia_scope: 'modo-guardia',
  gv7_guardia_toggle: 'modo-guardia',
  gv7_guardia_exit: 'modo-guardia',
  gv7_censo_r1: 'modo-guardia',
  gv7_censo_r4: 'modo-guardia',
  gv7_censo_sync: 'modo-guardia',
  gv7_entrega_phase: 'modo-entrega',
  gv7_entrega_patient: 'modo-entrega',
  gv7_entrega_roster: 'modo-entrega',
  gv7_entrega_pendientes: 'modo-entrega',
  gv7_lan_wifi: 'lan-pin-turno',
  gv7_lan_pin: 'lan-pin-turno',
  gv7_lan_directorio: 'lan-pin-turno',
  gv7_lan_rotacion: 'lan-pin-turno',
  gv7_mobile_link: 'lan-pin-turno',
  gv7_mobile_scope: 'lan-pin-turno',
  gv7_mobile_vs_sala: 'lan-pin-turno',
};

const GV7_ACTION_HINT = {
  gv7_guardia_toggle:
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa el botón resaltado; aparece <strong>Siguiente</strong> al activar el filtro.</p>',
  gv7_lan_wifi:
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa el icono <strong>Wi‑Fi</strong> de LiveSync para continuar.</p>',
  gv7_mobile_link:
    '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Despliega <strong>iPad / R+ Móvil</strong> en el panel LiveSync.</p>',
};

function buildGv7CensoR1Copy(rank) {
  if (rank === 'R4') {
    return (
      '<p style="margin:0;line-height:1.5;">Como <strong>R4</strong>, el censo lateral puede mostrar toda la sala. ' +
      'En el siguiente paso verás la grilla agrupada por equipo.</p>'
    );
  }
  if (rank === 'R1') {
    return (
      '<p style="margin:0;line-height:1.5;">Como <strong>R1</strong>, el censo lateral lista pacientes de <strong>tu equipo</strong>. ' +
      'En guardia, <strong>Solo mis entregas</strong> puede acotar aún más.</p>'
    );
  }
  return (
    '<p style="margin:0;line-height:1.5;">Según tu rango (<strong>' +
    escapeTourHtml(rank) +
    '</strong>), el censo lateral muestra tu equipo o un subconjunto de la sala.</p>'
  );
}

function buildGv7CensoR4Copy(rank) {
  if (rank === 'R4') {
    return (
      '<p style="margin:0;line-height:1.5;">En la grilla de guardia, los <strong>divisores por equipo</strong> (colapsables) permiten ver toda la sala sin ruido.</p>'
    );
  }
  return (
    '<p style="margin:0;line-height:1.5;">En rangos <strong>R1–R3</strong> la grilla se acota a tu equipo. ' +
    'Los divisores colapsables por equipo son propios de <strong>R4</strong>.</p>'
  );
}

function getGuardiaV7StepBody(stepId) {
  const rank = getClinicalRankForTour();
  const bodies = {
    gv7_guardia_chip:
      '<p style="margin:0;line-height:1.5;">El botón <strong>Guardia</strong> en la barra superior abre el tablero de turno: censo, entrega y monitoreo. No bloquea el resto de R+.</p>',
    gv7_guardia_tab:
      '<p style="margin:0;line-height:1.5;">En <strong>Modo Guardia</strong> el centro muestra el panel de guardia: fases del turno, métricas y grilla de pacientes.</p>',
    gv7_guardia_scope:
      '<p style="margin:0;line-height:1.5;">La <strong>barra de contexto</strong> resume sala y fase del turno. Quién ves en el censo depende de tu rango — lo revisamos en el módulo <strong>Censo y alcance</strong>.</p>',
    gv7_guardia_toggle:
      '<p style="margin:0;line-height:1.5;"><strong>Solo mis entregas</strong> filtra la grilla a pacientes que te entregaron en este turno, sin cambiar el modo Entrega.</p>',
    gv7_guardia_exit:
      '<p style="margin:0;line-height:1.5;">Pulsa de nuevo <strong>Guardia</strong> para volver a la vista Normal (Laboratorio, Expediente, etc.).</p>',
    gv7_entrega_phase:
      '<p style="margin:0;line-height:1.5;">Pulsa <strong>Entrega</strong> en la barra del censo para abrir el listado de handoff por paciente antes del turno activo.</p>',
    gv7_entrega_patient:
      '<p style="margin:0;line-height:1.5;">En cada paciente, <strong>Entrega</strong> documenta handoff, equipo entrante y pendientes. La grilla resalta críticos y entrantes.</p>',
    gv7_entrega_roster:
      '<p style="margin:0;line-height:1.5;">El <strong>roster de entrega</strong> lista pacientes pendientes de documentar antes de pasar al turno activo.</p>',
    gv7_entrega_pendientes:
      '<p style="margin:0;line-height:1.5;"><strong>Pendientes de entrega</strong>: plantillas por servicio, handoff estructurado y seguimiento entre turnos.</p>',
    gv7_lan_wifi:
      '<p style="margin:0;line-height:1.5;">' +
      LIVESYNC_BTN_COPY +
      ': estado de red local, sala y sincronización del turno en la Wi‑Fi del hospital.</p>',
    gv7_lan_pin:
      '<p style="margin:0;line-height:1.5;">El <strong>PIN del turno</strong> (válido ~12 h) permite reconectar otras Mac en otra red del hospital sin reconfigurar la sala.</p>',
    gv7_lan_directorio:
      '<p style="margin:0;line-height:1.5;">El <strong>directorio LAN</strong> muestra quién está en la sala. El anfitrión conserva el roster aunque un cliente aún no haya sincronizado.</p>',
    gv7_lan_rotacion:
      '<p style="margin:0;line-height:1.5;"><strong>Mi rotación</strong> (barra superior): @usuario, equipos persistentes, sala y entregas. Distinto del censo del sidebar.</p>',
    gv7_mobile_link:
      '<p style="margin:0;line-height:1.5;">Copia el <strong>enlace permanente para iPad/móvil</strong> desde el panel LiveSync. Sirve para guardar en Safari; no caduca como el ticket de otra Mac.</p>',
    gv7_mobile_scope:
      '<p style="margin:0;line-height:1.5;">' + MOBILE_SCOPE_COPY + '</p>',
    gv7_mobile_vs_sala:
      '<p style="margin:0;line-height:1.5;">En LiveSync, <strong>iPad/móvil</strong> (identidad) vs <strong>otra Mac/sala</strong> (ticket de un solo uso) son invitaciones distintas.</p>',
    gv7_censo_r1: buildGv7CensoR1Copy(rank),
    gv7_censo_r4: buildGv7CensoR4Copy(rank),
    gv7_censo_sync:
      '<p style="margin:0;line-height:1.5;">La sincronización LAN es más silenciosa en 7.x: avisos discretos en el encabezado; el directorio se actualiza en segundo plano.</p>',
  };
  return bodies[stepId] || '<p style="margin:0;line-height:1.5;">Sigue el resaltado en pantalla.</p>';
}

export function getGuardiaV7StepHtml(stepId) {
  let base = getGuardiaV7StepBody(stepId);
  if (GV7_ACTION_HINT[stepId] && stepRequiresUserAction(stepId)) {
    base += GV7_ACTION_HINT[stepId];
  }
  const articleId = GV7_HELP_ARTICLE[stepId];
  if (!articleId) return base;
  return (
    base +
    '<p style="margin:10px 0 0;">' +
    '<button type="button" class="help-tour-btn" onclick="openQuickHelp(\'' +
    articleId +
    "')\">Más en ayuda</button></p>"
  );
}

export function escapeTourHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
