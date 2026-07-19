/**
 * procesarLabs pipeline — header parse, block segmentation, section collection.
 * Wired from labs.js via createProcesarLabs(deps) to avoid circular imports with parse*.
 */
import { buildEgfrPatientCtx } from './labs-egfr.mjs';
import { lcrBlocksNormText_ } from './labs-lcr-parse.mjs';

/** Expediente del encabezado SOME (para enlazar con el paciente en R+). */
export function extractLabExpedienteFromReport(textoBruto) {
  var mExp = String(textoBruto || '').match(/Expediente:\s*([^\n\r]+)/i);
  if (!mExp) return '';
  return mExp[1]
    .split(/\s+(?:Solicitud|Medico|Médico|Fecha|Sexo|Edad|Ubicaci)/i)[0]
    .trim();
}

/** Normaliza Sexo: a 'M' / 'F' (o '' si no se reconoce). */
function parseLabSexoNorm_(mSexo) {
  if (!mSexo) return '';
  var sm = mSexo[1].match(/^(MASCULINO|FEMENINO|HOMBRE|MUJER|MALE|FEMALE|M\b|F\b)/i);
  if (!sm) return '';
  var sv = sm[1].toUpperCase();
  return sv === 'MASCULINO' || sv === 'HOMBRE' || sv === 'MALE' || sv === 'M' ? 'M' : 'F';
}

/** Edad: primer número + unidad normalizada (días con acento). */
function parseLabEdadParts_(mEdad) {
  var edadRaw = mEdad ? (mEdad[1].match(/^\d+/) || [''])[0] : '';
  var edadUnidad = mEdad
    ? (mEdad[1].match(/\b(años|meses|dias|días|semanas)\b/i) || ['años'])[0].toLowerCase()
    : 'años';
  if (edadUnidad === 'dias' || edadUnidad === 'días') edadUnidad = 'días';
  return { edadRaw: edadRaw, edadUnidad: edadUnidad };
}

function parseLabUbicacion_(textoBruto) {
  var mUbic = textoBruto.match(/Ubicaci[oó]n:\s*([^\n\r]+)/i);
  if (!mUbic) return '';
  var uRaw = mUbic[1].trim();
  var uTok = uRaw
    .split(/\t+/)
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean);
  return (uTok[0] || uRaw.split(/\s+(?:Medico|Médico|Edad)\s*:/i)[0] || uRaw).trim();
}

function segmentLabReportBlocks_(deps, textoBruto, tNorm) {
  var mGaso = tNorm.match(
    /GASOMETRIA.*?(?=BIOMETRIA|CITOLOGIA|QUIMICA|ELECTROLITOS|PFH|COAGULACION|CITOQUIMICO|$)/i
  );
  var bloqueGaso = mGaso ? mGaso[0] : '';
  var lcrNormChunks = lcrBlocksNormText_(textoBruto);
  var bloqueCitoLC = deps.bloqueCitoquimicoLiquidosFull(textoBruto);
  var mEGO = tNorm.match(
    /(?:URIANALISIS|EXAMEN GENERAL DE ORINA|ANALISIS DE ORINA).*?(?=BACTERIOLOGIA|CULTIVO|COMENTARIO DE MUESTRA|$)/i
  );
  var bloqueEGO = mEGO ? mEGO[0] : '';
  var tSinLiqCorp = tNorm;
  if (bloqueCitoLC) {
    tSinLiqCorp = tNorm.replace(bloqueCitoLC.replace(/\r/g, '').replace(/\s+/g, ' '), ' ');
  }
  var textoQS = tSinLiqCorp.replace(bloqueGaso, ' ').replace(bloqueEGO, ' ');
  for (var li = 0; li < lcrNormChunks.length; li++) {
    textoQS = textoQS.replace(lcrNormChunks[li], ' ');
  }
  var textoParaBh = tSinLiqCorp;
  if (bloqueEGO) textoParaBh = textoParaBh.replace(bloqueEGO, ' ');
  var esSoloGaso =
    /GASOMETRIA/i.test(tNorm) &&
    !/BIOMETRIA|QUIMICA|ELECTROLITOS|PFH|COAGULACION|CULTIVO/i.test(tNorm);
  return { bloqueGaso: bloqueGaso, textoQS: textoQS, textoParaBh: textoParaBh, esSoloGaso: esSoloGaso };
}

function pushLabSection_(resLabs, value) {
  if (value) resLabs.push(value);
}

function collectCoreLabSections_(deps, resLabs, blocks, demograf, textoBruto, tNorm) {
  var bhRes = deps.parseBH_(blocks.textoParaBh);
  if (bhRes && bhRes.visible) resLabs.push(bhRes.visible);
  if (bhRes && bhRes.coagVisible) resLabs.push(bhRes.coagVisible);
  pushLabSection_(resLabs, deps.parseQS_(blocks.textoQS, demograf));
  pushLabSection_(resLabs, deps.parseESC_(blocks.textoQS));
  pushLabSection_(resLabs, deps.parsePFH_(blocks.textoParaBh));
  pushLabSection_(resLabs, deps.parseLipasa_(blocks.textoQS));
  pushLabSection_(resLabs, deps.parsePlaquetasCitrato_(textoBruto, tNorm));
  return bhRes && bhRes.extras ? bhRes.extras : {};
}

function appendFrotisLines_(deps, resLabs, textoBruto) {
  var fro = deps.parseFrotisSangre_(textoBruto);
  if (!fro) return;
  fro.split('\n').forEach(function (line) {
    if (line) resLabs.push(line);
  });
}

function collectLabSections_(deps, textoBruto, tNorm, blocks, demograf) {
  var resLabs = [];
  var bhExtras = blocks.esSoloGaso
    ? {}
    : collectCoreLabSections_(deps, resLabs, blocks, demograf, textoBruto, tNorm);
  pushLabSection_(resLabs, deps.parseGaso_(blocks.bloqueGaso, blocks.textoQS));
  pushLabSection_(resLabs, deps.parsePIE_(tNorm));
  pushLabSection_(resLabs, deps.parsearLCR(textoBruto));
  pushLabSection_(resLabs, deps.parsearCitoquimicoLiquidos(textoBruto));
  pushLabSection_(
    resLabs,
    deps.formatCitoquimicoInterpretacionLine_(deps.buildCitoquimicoInterpretAlerts_(textoBruto))
  );
  pushLabSection_(resLabs, deps.parseFisicoquimicoHeces_(textoBruto));
  appendFrotisLines_(deps, resLabs, textoBruto);
  pushLabSection_(resLabs, deps.parseEGO_(textoBruto));
  pushLabSection_(resLabs, deps.parseCuantOrina_(textoBruto));
  pushLabSection_(resLabs, deps.parseCultivo_(textoBruto, tNorm));
  pushLabSection_(resLabs, deps.parseSerologiaBancoSangre_(textoBruto));
  pushLabSection_(resLabs, deps.parseTroponina_(textoBruto));
  return { resLabs: resLabs, bhExtras: bhExtras };
}

function parseLabPatientHeader_(deps, textoBruto) {
  var mNombre = textoBruto.match(/Nombre:\s*([^\n\r]+)/i);
  var mExp = textoBruto.match(/Expediente:\s*([^\n\r]+)/i);
  var mSexo = textoBruto.match(/Sexo:\s*([^\n\r]+)/i);
  var mEdad = textoBruto.match(/Edad:\s*([^\n\r]+)/i);
  var expRaw = mExp
    ? mExp[1].split(/\s+(?:Solicitud|Medico|Médico|Fecha|Sexo|Edad|Ubicaci)/i)[0].trim()
    : '';
  var edadParts = parseLabEdadParts_(mEdad);
  var sexoRaw = parseLabSexoNorm_(mSexo);
  var patient = {
    name: mNombre ? mNombre[1].split(/Fecha|Sexo|Edad/i)[0].trim() : '',
    expediente: expRaw,
    sexo: sexoRaw,
    edad: edadParts.edadRaw ? edadParts.edadRaw + ' ' + edadParts.edadUnidad : '',
    fecha: deps.extractLabReportFechaDMY(textoBruto),
    hora: deps.extractLabReportHora(textoBruto),
    ubicacion: parseLabUbicacion_(textoBruto),
  };
  return {
    patient: patient,
    edadRaw: edadParts.edadRaw,
    edadUnidad: edadParts.edadUnidad,
    sexoRaw: sexoRaw,
  };
}

/**
 * @param {object} deps
 * @param {(texto: string) => string} deps.bloqueCitoquimicoLiquidosFull
 * @param {(rows: string[]) => string[]} deps.dedupeSingletonSections_
 * @param {(texto: string) => object} deps.buildRefsBySectionFromReport
 * @param {(texto: string) => string} deps.extractLabReportFechaDMY
 * @param {(texto: string) => string} deps.extractLabReportHora
 * @param {(texto: string, tNorm: string) => object | null} deps.parseBH_
 * @param {(texto: string, demograf: object) => object | null} deps.parseQS_
 * @param {(texto: string) => object | null} deps.parseESC_
 * @param {(texto: string) => object | null} deps.parsePFH_
 * @param {(texto: string) => object | null} deps.parseLipasa_
 * @param {(texto: string, tNorm: string) => object | null} deps.parsePlaquetasCitrato_
 * @param {(bloque: string, textoQS: string) => object | null} deps.parseGaso_
 * @param {(tNorm: string) => object | null} deps.parsePIE_
 * @param {(texto: string) => object | null} deps.parsearLCR
 * @param {(texto: string) => object | null} deps.parsearCitoquimicoLiquidos
 * @param {(texto: string) => string} deps.formatCitoquimicoInterpretacionLine_
 * @param {(texto: string) => object} deps.buildCitoquimicoInterpretAlerts_
 * @param {(texto: string) => object | null} deps.parseFisicoquimicoHeces_
 * @param {(texto: string) => string | null} deps.parseFrotisSangre_
 * @param {(texto: string) => object | null} deps.parseEGO_
 * @param {(texto: string) => object | null} deps.parseCuantOrina_
 * @param {(texto: string, tNorm: string) => object | null} deps.parseCultivo_
 * @param {(texto: string) => object | null} deps.parseSerologiaBancoSangre_
 * @param {(texto: string) => string} deps.parseTroponina_
 */
export function createProcesarLabs(deps) {
  /**
   * @param {string} textoBruto
   * @param {{ patient?: { sexo?: string, edad?: string } }} [options]
   */
  return function procesarLabs(textoBruto, options) {
    var tNorm = textoBruto.replace(/\s+/g, ' ');
    var hdr = parseLabPatientHeader_(deps, textoBruto);
    var blocks = segmentLabReportBlocks_(deps, textoBruto, tNorm);
    var chartPatient = options && options.patient ? options.patient : null;
    var egfrCtx = buildEgfrPatientCtx(hdr.edadRaw, hdr.edadUnidad, chartPatient);
    var sections = collectLabSections_(deps, textoBruto, tNorm, blocks, egfrCtx);
    return {
      patient: hdr.patient,
      resLabs: deps.dedupeSingletonSections_(sections.resLabs),
      bhExtras: sections.bhExtras,
      refsBySection: deps.buildRefsBySectionFromReport(textoBruto),
    };
  };
}
