import { HC_INTERROGADO_NEGADO } from './defaults.mjs';
import { formatGeneroSection } from './genero-options.mjs';
import { summarizeApnpHabits } from './apnp-calculators.mjs';
import { summarizeToxicomanias } from './toxicomanias.mjs';
import { formatAppSection } from './compile-app.mjs';
import { formatAhfSection } from './compile-ahf.mjs';
import { resolveSignosVitalesIngresoBody } from './signos-vitales-ingreso.mjs';
import { trim } from './string-util.mjs';


function labelsFromCatalog(ids, catalog) {
  return (ids || [])
    .map(function (id) {
      return catalog && catalog[id] ? catalog[id] : id;
    })
    .filter(Boolean);
}

function formatChecklist(ids, catalog, descripcion, negado) {
  if (negado && (!ids || !ids.length)) {
    return trim(descripcion) || HC_INTERROGADO_NEGADO;
  }
  const parts = labelsFromCatalog(ids, catalog);
  const detail = trim(descripcion);
  if (parts.length && detail) return parts.join(', ') + '. ' + detail;
  if (parts.length) return parts.join(', ');
  return detail;
}

function pushSection(out, id, title, body) {
  const b = trim(body);
  if (!b) return;
  out.push({ id, title, body: b });
}

function formatApnp(apnp, ctx) {
  if (!apnp || typeof apnp !== 'object') return '';
  const habits = summarizeApnpHabits(apnp, ctx);
  const tox = summarizeToxicomanias(apnp);
  const lines = [
    ['Tabaquismo', apnp.tabaquismo || habits.tabaquismo.summary],
    ['Alcoholismo', apnp.alcoholismo || habits.alcoholismo.summary],
    ['Toxicomanías', apnp.toxicomanias || tox.summary],
    ['Tatuajes', apnp.tatuajes],
    ['Deportes/pasatiempos/mascotas', apnp.deportesPasatiemposMascotas],
    ['Dieta', apnp.dieta],
  ];
  return lines
    .filter(function (row) {
      return trim(row[1]);
    })
    .map(function (row) {
      return row[0] + ': ' + trim(row[1]);
    })
    .join('\n');
}

function formatIdentificacion(id) {
  if (!id || typeof id !== 'object') return '';
  const lines = [
    ['Informante', id.informante],
    ['Lugar de nacimiento', id.lugarNacimiento],
    ['Ocupación actual', id.ocupacionActual],
    ['Ocupación anterior', id.ocupacionAnterior],
    ['Escolaridad', id.escolaridad],
    ['Estado civil', id.estadoCivil],
    ['Religión', id.religion],
    ['Cama', id.cama],
    ['Registro', id.registro],
    ['DX', id.dx],
  ];
  return lines
    .filter(function (row) {
      return trim(row[1]);
    })
    .map(function (row) {
      return row[0] + ': ' + trim(row[1]);
    })
    .join('\n');
}

function formatSexual(s) {
  if (!s || typeof s !== 'object') return '';
  const lines = [];
  if (trim(s.ivsEdad)) lines.push('Inicio vida sexual: ' + trim(s.ivsEdad));
  if (trim(s.preferencias)) lines.push('Preferencias: ' + trim(s.preferencias));
  if (trim(s.parejas)) lines.push('Parejas: ' + trim(s.parejas));
  if (s.portadorVih) lines.push('Portador VIH: ' + s.portadorVih);
  if (trim(s.fechaDxVih)) lines.push('Fecha dx VIH: ' + trim(s.fechaDxVih));
  if (trim(s.ets)) lines.push('ETS: ' + trim(s.ets));
  return lines.join('\n');
}

function formatIpas(ipas, catalogs) {
  const systems = (catalogs && catalogs.ipasSystems) || {};
  const ids = Object.keys(systems);
  if (!ids.length) return '';

  const allNegado = ids.every(function (sid) {
    const block = ipas && ipas[sid];
    return block && block.negado && (!block.checks || !block.checks.length);
  });
  if (allNegado) {
    return 'IPAS: interrogado y negado en todos los sistemas.';
  }

  return ids
    .map(function (sid) {
      const block = (ipas && ipas[sid]) || {};
      const title = systems[sid] || sid;
      const body = formatChecklist(block.checks, {}, block.descripcion, block.negado);
      return title + ': ' + (body || HC_INTERROGADO_NEGADO);
    })
    .join('\n');
}

/**
 * @param {object} data
 * @param {{ appConditions?: Record<string,string>, ahfConditions?: Record<string,string>, ipasSystems?: Record<string,string> }} catalogs
 */
export function compileHistoriaClinicaNarrative(data, catalogs, ctx) {
  catalogs = catalogs || {};
  ctx = ctx || {};
  const out = [];
  const d = data || {};

  pushSection(out, 'identificacion', 'Identificación', formatIdentificacion(d.identificacion));
  pushSection(out, 'motivo', 'Motivo de consulta', d.motivoConsulta);
  pushSection(
    out,
    'apnp',
    'Antecedentes personales no patológicos',
    formatApnp(d.apnp, ctx)
  );

  const appBody = formatAppSection(d.app, catalogs.appConditions || {});
  pushSection(out, 'app', 'Antecedentes personales patológicos', appBody);

  pushSection(
    out,
    'ahf',
    'Antecedentes heredo-familiares',
    formatAhfSection(d.ahf, catalogs.ahfConditions || {})
  );

  pushSection(
    out,
    'genero',
    'Antecedentes por género',
    formatGeneroSection(d.genero, ctx.patientSex != null ? ctx.patientSex : ctx.sexo)
  );

  pushSection(out, 'sexual', 'Antecedentes sexuales', formatSexual(d.sexual));
  pushSection(out, 'padecimiento', 'Padecimiento actual', d.padecimientoActual);
  pushSection(out, 'negados', 'Datos relevantes negados', d.datosNegados);
  pushSection(out, 'ipas', 'Interrogatorio por aparatos y sistemas', formatIpas(d.ipas, catalogs));
  pushSection(
    out,
    'vitals',
    'Signos vitales al ingreso',
    resolveSignosVitalesIngresoBody(d, ctx)
  );

  const anchor = d.labAnchor;
  if (anchor) {
    let labLine = 'Laboratorios al ingreso';
    if (anchor.fecha) labLine += ' (' + anchor.fecha + ')';
    const parts = [];
    if (anchor.egfr != null) parts.push('eTFG ' + anchor.egfr);
    if (anchor.creatinineMgDl != null) parts.push('Cr ' + anchor.creatinineMgDl);
    if (parts.length) labLine += ': ' + parts.join(', ');
    if (d.labsAtAdmission && d.labsAtAdmission.qsSummary) {
      labLine += '\n' + trim(d.labsAtAdmission.qsSummary).slice(0, 2000);
    }
    pushSection(out, 'labs', 'Laboratorios', labLine);
  }

  return out;
}

/** @param {Array<{ title: string, body: string }>} sections */
export function compileHistoriaClinicaPlainText(sections) {
  return (sections || [])
    .map(function (s) {
      return s.title + ':\n' + s.body;
    })
    .join('\n\n');
}
