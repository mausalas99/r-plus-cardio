'use strict';

const { esc, replaceT } = require('./shared.js');

/** Reference sentinels from templates/ic-seguimiento.docx (Ma. Elena Contreras Alvarado). */
const ORIG = {
  nombreLine: 'Nombre: Ma. Elena Contreras Alvarado ',
  registroLine: 'Registro: 0893295-0',
  edadLine: ':  79 años',
  ingresoLine: 'Ingreso: 13/03/2026',
  fechaLine: 'Fecha: 19/03/2026                                                          ',
  fenotipo: 'Fenotipo de HFpEF',
  etiologia: 'Etiología: IC FEVIpreservada',
  diasInternamiento: 'Días de internamiento 6',
  inicioDescongestion: 'Inicio de descongestión: 13/03/2026    ',
  diasDescongestion: 'Días en descongestión: 6',
  vitals: 'TA: 120/70 mmHg FC: 60 lpm  FR: 18 rpm SPO2: 93%  Temp: 36.5°C  ',
  diuresis24: ' 1780 CC',
  diuresisAcum: '17,245 ml',
  pvyDash: '-',
  rhy: ' RHY: - ',
  soplos: 'Soplos: No se auscultan soplos ',
  estertores: 'Estertores/derrame (especificar): No',
  ascitis: 'Ascitis/hepatomegalia: No',
  edemaMi: 'Edema de MI: No',
  llenado: 'Llenado capilar: 3',
  stevenson: 'Estado hemodinámico (Stevenson): A',
  vexus: 'VExUS Score (Especificar):  0',
  congestion: 'CONGESTION Score (Especificar): 0 ',
  usPulmonar: 'US pulmonar (Describir):  Patrón A pulmonar ',
  esquemaDiureticos:
    'Esquema de diuréticos actual: 80 mg IV DU / NaU: 119 Diuresis a las 5 horas: 1600 cc. Se continua: Furosemida 80 mg cada 12 horas ',
  furoAcum: '      800 mg ',
  ekg: 'Electrocardiograma: Ritmo de marcapasos, FC: 60 lpm, Morfología de bloqueo de rama izquierda   ',
  ritmo: 'Ritmo del paciente: Ritmo de marcapasos ',
  estrategiaFa: 'Estrategia de control (Si FA/Flutter): Si, betabloqueador ',
  residente: 'Dra. Daniela Paola Girón López',
  dx1: 'Insuficiencia Cardiaca FEVI preservada',
  dx2: 'Exacerbación de Enfermedad Pulmonar Obstructiva Crónica ',
  dx3: 'Portadora de Marcapasos St Jude secundario a Fibrilación Auricular + Bloqueo AV',
};

const ORIG_ANTECEDENTES = [
  'EPOC diagnosticado hace 15 años, en tratamiento con Trelegy inhalador, utilizar una inhalación cada 24 horas, última hospitalización en diciembre 2025 por exacerbación.',
  'Apnea Obstructiva del Sueño, en tratamiento con BIPAPA y usuaria de oxígeno suplementario en casa 2l/min. ',
  'Polisomnografía I A/H: 31,3, saturación promedio 87, menor saturación 69. SAOS grave, ronquido leve. ',
  'Mayo 2025, Colocación de marcapasos  (marca St. Jude) por Fibrilación Auricular + bloqueo AV. ',
  'Insuficiencia Cardiaca FEVI preservada, en tratamiento con Dapagliflozina 10 mg cada 24 horas + Finerrenona 20 mg cada 24 horas + Bisoprolol 2.5 mg cada 24 horas + Rivaroxaban 20 mg cada 24 horas + Bumetanida 1-1-0. Seguimiento en Clínica de Insuficiencia Cardiaca ',
];

const ORIG_PEEA = [
  'Inicia padecimiento actual 5 días previo a ingreso al presentar tos no productiva que genera disnea de grandes esfuerzos progresiva hasta ser en reposo. Por lo cual, suspende medicamento (bumetanida). Acude a cita de seguimiento para revisión de marcapasos y a clínica de falla cardiaca. Se identifica SatO2: 80% aa, disnea en reposo; se auscultan estertores bibasales. ',
  'Se realiza rastreo donde se identifica VCI: 2.8 no colapsa >50%, Patrón B pulmonar en ambos hemitórax 3-4 líneas B por campo, VExUS score: 2. Congestion score: 3 puntos (derrame pleural + edema de miembros inferiores). Sin defectos segmentarios, FEVI preservada. ',
  'Se determina llevar a área de urgencias para iniciar tratamiento con diurético IV. ',
  'Se indica dosis de furosemida 80 mg IV DU en bolo, obteniendo respuesta en diuresis 1600 cc en 5 horas y natriuresis 119NaU.  Por lo cual, se determina continuar con dosis cada 12 horas.  Uresis: 2900 cc en 24 hrs',
];

const ORIG_POCUS = [
  '13.03.26 Se realiza rastreo donde se identifica VCI: 2.8 no colapsa >50%, Patrón B pulmonar en ambos hemitórax 3-4 líneas B por campo, VExUS score: 2. Congestion score: 3 puntos (derrame pleural + edema de miembros inferiores). Sin defectos segmentarios, FEVI preservada. ',
  '14.03.26 Parámetros de congestión: VCI: 1.96 VExUS score: 0, congestion score: 3 por edema de miembros inferiores + derrame pleural derecho, Patrón B pulmonar, 3-4 líneas B por campo ',
  '15.03.26 Parámetros de congestión: VCI: 2.2 VExUS score: 1, congestion score: 2 derrame pleural derecho no puncionable, Patrón B pulmonar, 2-3 líneas B por campo ',
  '16.03.26 Parámetros de congestión: VCI: 1.8 VExUS score: 0, congestion score: 2 derrame pleural derecho no puncionable, Patrón A pulmonar, 1-2 líneas B por campo ',
  '17.03.26 Parámetros de congestión: VCI: 1.76 VExUS score: 0, congestion score: 2 derrame pleural derecho no puncionable, Patrón A pulmonar, 1-2 líneas B por campo ',
  '18.03.26 Parámetros de congestión: VCI: 1.5 VExUS score: 0, congestion score: 0, Patrón A pulmonar',
  '19.03.26 Parámetros de congestión: VCI: 1.63 VExUS score: 0, congestion score: 0, Patrón A pulmonar',
];

const ORIG_DIURETIC_STRAT = [
  '13.03.26 Furosemida 80 mg DU bolo ',
  '14.03.26 Furosemida 80 mg IV cada 12 horas ',
  '15.03.26 Furosemida 80 mg IV cada 12 horas',
  '16.03.26 Furosemida 80 mg IV cada 12 horas',
  '17.03.26 Furosemida 40 mg IV cada 12 horas',
  '18.03.26 Furosemida 40 mg VO cada 12 horas   ',
  '19.03.26 Furosemida 40 mg VO cada 12 horas',
];

const ORIG_EVENTOS = [
  '14.03.26 Paciente con adecuada respuesta a dosis de diurético, se determina continuar con dosis cada 12 horas. Se realiza interconsulta con servicio de Neumología quienes sugieren agregar manejo para paciente con criterios compatibles con exacerbación de EPOC, por lo cual, se agrega Prednisona 40 mg cada 24 horas + Levofloxacino 750 mg cada 24 horas. ',
  '15.03.26 Paciente con adecuada respuesta a diurético, se determina continuar con misma dosis para mejorar parámetros de congestión. Pendiente traer de casa inhalador + BIPAP. ',
  '16.03.26 Continua en etapa de descongestión con adecuada respuesta, sin requerimiento de oxígeno suplementario y uso de BIPAP por las noches. Continua cumpliendo antibioticoterapia. ',
  '17.03.26 Paciente con mejoría en sintomatología. Se titula diurético hacia la baja, permanecemos en vigilancia. ',
  '18.03.26 Presenta un episodio de tos que requirió uso de MNB con combivent de rescate; se comenta con servicio de Neumología quien indica tratamiento con horario y se solicita Trellegy (medicamento previamente usado). ',
  '19.03.26 Paciente con adecuada evolución clínica, por lo cual, se comenta con servicio de Neumología y Medicina Interna, por nuestro servicios sin datos clínicos de continuar hospitalizada, se entrega receta de alta y se cita en consulta de Insuficiencia Cardiaca en 7 días con paraclínicos. ',
];

const ORIG_LAB_BODIES = [
  'PH: 7.30 PCO2: 60 HCO3: 29.5 LACTATO: 2.8 ',
  'HB: 12.60 HTO: 40.8 LEU: 13.2 NEU: 10.10 PLT: 257 ',
  'CR: 0.6 BUN: 14 GLU: 141 AU: 5.0 PT: 6.9 ',
  'ALB: 3.9 AST: 11 ALT: 17 FA: 89 BT: 0.5 BD: 0.2 BI: 0.3 LDH: 151 AMILSA: 24 CT: 117 TG: 120 ',
  'CL: 96.7 NA: 138.6 K: 4.0 CA: 8.9 P:3.5 ',
  'KU: 11 NAU: 119 CRU: 11.28 ',
  'Hb 10.9 Hto 36 VCM 85 HCM 25.8 Leu 10.6 Neu 9.4 Eos 0.014 Plt 201   Glu 133 Cr 0.6 BUN 14 PCR    AU 5.6 TGL 63 COL 95 Na 140.3 Cl 98 K 3.9 Ca 8.5 F 3.5 Alb 3.2 AST 9 ALT 15 FA 76 BT 0.4 BD 0.2 BI 0.2 LDH 134 Amil 37 pH 7.33 pCO2 61 pO2 64 Lactato 0.9 Bica 32.2',
  'HB: 10.9 HTO: 36 HCM: 25.8 VCM: 85 LEU: 10.6 NEU: 9.40 MON: 0.541 EOS: 0.014 BAS: 0.048 PLT: 201 ',
  'CR: 0.6 BUN: 14 GLU: 133 AU: 5.6',
  'PT: 6.1 ALB: 3.2 AST: 9 ALT: 15 FA: 76 AMILASA: 37 CT: 95 TG: 63 ',
  'NA: 140.3 K: 3.9 CA: 8.5 P: 3.5 ',
  'PH: 7.33 PCO2: 61 HCO3: 32.3 SATO2: 90% PO2: 64',
  'HB: 11.3 HTO: 37.5 LEU: 9.91 NEU: 7.98 PLT: 232 ',
  'CR: 0.7 BUN: 21 GLU: 84 AU: 5.9 ',
  'ALB: 3.2 AST: 9 ALT: 13 BT: 0.5 BD: 0.1 BI: 0.4 LDH: 147 CT: 120 TG: 91 ',
  'CL: 90.4 NA: 141.2 K: 3.7 CA: 8.1 P: 2.2 ',
  'PH: 7.56 PCO2: 40 HCO3: 35.9 LACTATO: 1.7 ',
  'PH: 7.49 PCO2: 51 HCO3: 38.9 LACTATO: 0.9 ',
  'PCR: 5.40',
  'HB: 12.2 HTO: 40.4 LEU: 8.42 NEU: 6.89 PLT: 241 ',
  'CR: 0.8 BUN: 21 GLU: 108 AU: 6.8 ',
  'ALB: 3.3 PT: 6.6 AST: 10 ALT: 15 FA: 73 BT: 0.5 BD: 0.1 BI: 0.4 LDH: 119 AMILASA: 36 TG: 86 CT: 124 ',
  'CL: 88 NA: 142.4 K: 4.0 CA: 8.0 P: 3.5 ',
  'PH: 7.54 PCO2: 51 HCO3: 43.6 LACTATO. 2.5 ',
  'PH: 7.50 PCO2: 53 HCO3: 41.2 LACTATO: 1.6 ',
  'HB: 13.10 HTO: 42.4 LEU: 7.97 NEU: 7.30 PLT: 298 LINF: 0.45 ',
  'CR: 0.7 BUN: 26 GLU: 158 AU: 6.4 ',
  'ALB: 3.7 AST: 27 ALT: 21 FA: 73 LDH: 481 AMILSAS: 36 CT: 165 TG: 100 ',
  'CL: 89.2 NA: 135.5 K: 3.5 CA: 8.8 P: 3.7 ',
  'PH: 7.39 PCO2: 40 HCO3: 24.2 LACTATO: 1.8 ',
];

const ORIG_LAB_DATES = [
  '13.03.26 ',
  '14.03.26',
  '15.03.26',
  '16.03.26 ',
  '17.03.26 ',
  '18.03.26 ',
  '19.03.26 ',
];

/** Unique med-table sample cells (avoid generic dates / "Furosemida" shared with strategy lines). */
const ORIG_MED_CELLS = [
  'Neparvis',
  'Dapagliflozina',
  'Bisoprolol',
  'Finerrenona',
  ' Enoxaparina',
  'Prednisona  ',
  'Levofloxacino',
  'Polietilenglicol ',
  'Ipratropio-Salbutamol',
  '10 mg c/24h',
  '2.5 mg c/24h',
  '20 mg c/24h',
  '40 mg cada 12h',
  '100 mg cada 12h',
  '40 mg cada 24h',
  '750 mg cada 24h',
  '17 g cada 24 horas',
  '2.5 ml en 3 cc de NaCl 0.9% cada 6h',
  ' Anticoagulación  ',
  'Estreñimiento ',
];

function dash(v) {
  if (v == null || v === '') return '—';
  return String(v);
}

function yesNo(v, yesText, noText) {
  if (v === true) return yesText || 'Sí';
  if (v === false) return noText || 'No';
  return '—';
}

function fillLineSlots(xml, origLines, nextLines) {
  let out = xml;
  const next = Array.isArray(nextLines) ? nextLines : [];
  for (let i = 0; i < origLines.length; i += 1) {
    const val = i < next.length ? String(next[i] || '') : '';
    out = replaceT(out, origLines[i], val);
  }
  return out;
}

function padFechaLine(fechaDisplay) {
  const base = `Fecha: ${fechaDisplay || ''}`;
  const targetLen = ORIG.fechaLine.length;
  if (base.length >= targetLen) return base;
  return base + ' '.repeat(targetLen - base.length);
}

function fillHeader(xml, payload) {
  let out = xml;
  out = replaceT(out, ORIG.nombreLine, `Nombre: ${payload.nombre || ''} `);
  out = replaceT(out, ORIG.registroLine, `Registro: ${payload.registro || ''}`);
  const edad = payload.edad != null && payload.edad !== '' ? String(payload.edad) : '—';
  out = replaceT(out, ORIG.edadLine, `:  ${edad} años`);
  out = replaceT(out, ORIG.ingresoLine, `Ingreso: ${payload.ingresoDisplay || '—'}`);
  out = replaceT(out, ORIG.fechaLine, padFechaLine(payload.fechaDisplay));
  out = replaceT(
    out,
    ORIG.fenotipo,
    payload.fenotipo ? String(payload.fenotipo) : '—',
  );
  out = replaceT(
    out,
    ORIG.etiologia,
    payload.etiologia ? `Etiología: ${payload.etiologia}` : 'Etiología: —',
  );
  return out;
}

function fillDescongestion(xml, payload) {
  let out = xml;
  const diasInt =
    payload.diasInternamiento != null && payload.diasInternamiento !== ''
      ? String(payload.diasInternamiento)
      : '—';
  out = replaceT(out, ORIG.diasInternamiento, `Días de internamiento ${diasInt}`);
  out = replaceT(
    out,
    ORIG.inicioDescongestion,
    `Inicio de descongestión: ${payload.inicioDescongestionDisplay || '—'}    `,
  );
  const diasDes =
    payload.diasDescongestion != null && payload.diasDescongestion !== ''
      ? String(payload.diasDescongestion)
      : '—';
  out = replaceT(out, ORIG.diasDescongestion, `Días en descongestión: ${diasDes}`);
  out = replaceT(out, ORIG.vitals, payload.vitalsLine || '');
  out = replaceT(out, ORIG.diuresis24, payload.diuresis24hDisplay || '');
  out = replaceT(out, ORIG.diuresisAcum, payload.diuresisAcumuladaDisplay || '—');
  return out;
}

function fillChecklistAndScores(xml, payload) {
  const c = payload.checklist || {};
  let out = xml;
  out = replaceT(out, ORIG.pvyDash, yesNo(c.pvy, 'Sí', '-'));
  out = replaceT(out, ORIG.rhy, ` RHY: ${yesNo(c.rhy, 'Sí', '-')} `);
  out = replaceT(
    out,
    ORIG.soplos,
    `Soplos: ${c.soploNota || '—'} `,
  );
  out = replaceT(
    out,
    ORIG.estertores,
    `Estertores/derrame (especificar): ${c.estertoresNota || '—'}`,
  );
  out = replaceT(
    out,
    ORIG.ascitis,
    `Ascitis/hepatomegalia: ${yesNo(c.ascitisHepatomegalia)}`,
  );
  out = replaceT(out, ORIG.edemaMi, `Edema de MI: ${yesNo(c.edemaMi)}`);
  out = replaceT(
    out,
    ORIG.llenado,
    `Llenado capilar: ${c.llenadoCapilar || '—'}`,
  );
  out = replaceT(
    out,
    ORIG.stevenson,
    `Estado hemodinámico (Stevenson): ${payload.stevenson || '—'}`,
  );
  out = replaceT(
    out,
    ORIG.vexus,
    `VExUS Score (Especificar):  ${dash(payload.vexus)}`,
  );
  out = replaceT(
    out,
    ORIG.congestion,
    `CONGESTION Score (Especificar): ${dash(payload.congestionScore)} `,
  );
  out = replaceT(
    out,
    ORIG.usPulmonar,
    `US pulmonar (Describir):  ${payload.usPulmonar || '—'} `,
  );
  return out;
}

function clearLabsAndMedSamples(xml, labsLines) {
  let out = xml;
  // Clear reference lab dates/bodies while they still match ORIG (before series fills).
  for (const d of ORIG_LAB_DATES) {
    out = replaceT(out, d, '');
  }
  const next = Array.isArray(labsLines) ? labsLines : [];
  for (let i = 0; i < ORIG_LAB_BODIES.length; i += 1) {
    const val = i < next.length ? String(next[i] || '') : '';
    out = replaceT(out, ORIG_LAB_BODIES[i], val);
  }
  for (const cell of ORIG_MED_CELLS) {
    out = replaceT(out, cell, '');
  }
  return out;
}

function fillMedsAndMisc(xml, payload) {
  let out = xml;
  out = replaceT(
    out,
    ORIG.esquemaDiureticos,
    payload.esquemaDiureticosActual
      ? `Esquema de diuréticos actual: ${payload.esquemaDiureticosActual} `
      : 'Esquema de diuréticos actual: — ',
  );
  out = replaceT(out, ORIG.furoAcum, payload.furosemidaAcumuladaDisplay || '      — ');
  out = replaceT(
    out,
    ORIG.ekg,
    payload.ekg ? `Electrocardiograma: ${payload.ekg}   ` : 'Electrocardiograma: —   ',
  );
  out = replaceT(
    out,
    ORIG.ritmo,
    payload.ritmo ? `Ritmo del paciente: ${payload.ritmo} ` : 'Ritmo del paciente: — ',
  );
  out = replaceT(
    out,
    ORIG.estrategiaFa,
    payload.estrategiaControlFa
      ? `Estrategia de control (Si FA/Flutter): ${payload.estrategiaControlFa} `
      : 'Estrategia de control (Si FA/Flutter): — ',
  );
  out = replaceT(out, ORIG.residente, payload.residente || '—');

  const dx = Array.isArray(payload.diagnosticos) ? payload.diagnosticos : [];
  out = replaceT(out, ORIG.dx1, dx[0] || '—');
  out = replaceT(out, ORIG.dx2, dx[1] ? `${dx[1]} ` : '');
  out = replaceT(out, ORIG.dx3, dx[2] || '');
  return out;
}

/**
 * Replace known Ma. Elena sentinel strings in word/document.xml.
 * Never reorders OOXML sections; empty → blank or —.
 *
 * @param {string} xml
 * @param {Record<string, unknown>} payload from buildIcExportPayload
 * @returns {string}
 */
function fillIcHojaXml(xml, payload) {
  const p = payload || {};
  // Labs + med samples first so date/drug clears cannot wipe filled series text.
  let out = clearLabsAndMedSamples(xml, p.labsLines);
  out = fillHeader(out, p);
  out = fillLineSlots(out, ORIG_ANTECEDENTES, p.antecedentesLines);
  out = fillLineSlots(out, ORIG_PEEA, p.peeaLines);
  out = fillDescongestion(out, p);
  out = fillChecklistAndScores(out, p);
  out = fillLineSlots(out, ORIG_POCUS, p.pocusLines);
  out = fillLineSlots(out, ORIG_DIURETIC_STRAT, p.diureticStrategyLines);
  out = fillLineSlots(out, ORIG_EVENTOS, p.eventosLines);
  out = fillMedsAndMisc(out, p);

  // Safety: any leftover identity sentinel must not remain for a different patient.
  if (p.registro && String(p.registro) !== '0893295-0') {
    out = out.split('0893295-0').join(esc(String(p.registro)));
  }
  if (p.nombre && !/Ma\. Elena Contreras Alvarado/i.test(String(p.nombre))) {
    out = out.split('Ma. Elena Contreras Alvarado').join(esc(String(p.nombre)));
  }
  return out;
}

module.exports = {
  fillIcHojaXml,
  ORIG,
  ORIG_POCUS,
  ORIG_EVENTOS,
  ORIG_ANTECEDENTES,
};
