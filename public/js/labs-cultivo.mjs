// Cultivo barrel — parseCultivo_ + re-exports
import {
  detectTipoCultivoLine,
  detectMuestraDesdeProducto,
  buildCultivoTipoDisplay,
  parseMycobacteriasStudies_,
  findCultivoGermenRuns,
  detectMarcasResistenciaCultivoSlice,
  parseSensCrudasAntibiogramaSlice,
  compactarLineasAntibiograma,
  extractCuentaKassFromLineas,
} from './labs-cultivo-scan.mjs';
import { abreviarAbAtb_ } from './labs-cultivo-abbr.mjs';

function isCultivoReportText_(tUpper) {
  return (
    tUpper.indexOf('HEMOCULTIVO') !== -1 ||
    tUpper.indexOf('CULTIVO') !== -1 ||
    tUpper.indexOf('MICROORGANISMO') !== -1 ||
    tUpper.indexOf('MYCOBACTERIAS') !== -1 ||
    tUpper.indexOf('BACILOSCOPIA') !== -1
  );
}

function parseCultivoFecha_(tNorm) {
  var mFecha = tNorm.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return mFecha ? mFecha[1].padStart(2, '0') + '/' + mFecha[2].padStart(2, '0') : 'N/D';
}

function buildGermenChunk_(run, sliceLines, sitio, fechaC, reportePreliminar) {
  var subNorm = sliceLines.join('\n');
  var idxAbLoc = subNorm.toUpperCase().indexOf('ANTIBIOGRAMA');
  var head = sitio + ' ' + fechaC + ': ' + run.germen;
  var headTags = [];
  if (reportePreliminar) headTags.push('Preliminar');
  detectMarcasResistenciaCultivoSlice(sliceLines).forEach(function (m) {
    if (headTags.indexOf(m) === -1) headTags.push(m);
  });
  if (headTags.length) head += ' · ' + headTags.join(' · ');
  var chunk = head;
  if (idxAbLoc !== -1) {
    var lineasAb = subNorm
      .substring(idxAbLoc)
      .split('\n')
      .map(function (l) {
        return l.replace(/\r/g, '').replace(/\*/g, '').trim();
      });
    var abCompact = compactarLineasAntibiograma(parseSensCrudasAntibiogramaSlice(lineasAb), abreviarAbAtb_);
    if (abCompact) chunk += '\n' + abCompact;
  }
  var cuentaRun = extractCuentaKassFromLineas(sliceLines);
  if (cuentaRun) chunk += '\nCuenta: ' + cuentaRun;
  return chunk;
}

function parseCultivoGermenRuns_(germenRuns, lineasTexto, sitio, fechaC, reportePreliminar) {
  var chunks = [];
  for (var ri = 0; ri < germenRuns.length; ri++) {
    var run = germenRuns[ri];
    chunks.push(buildGermenChunk_(run, lineasTexto.slice(run.i0, run.i1), sitio, fechaC, reportePreliminar));
  }
  return chunks.join('\n\n');
}

function parseCultivoNegativo_(tNorm, tUpper, sitio, fechaC) {
  if (tNorm.toUpperCase().indexOf('BACILOSCOPIA') !== -1 && tNorm.toUpperCase().indexOf('POSITIVO') !== -1) {
    var mPos = tNorm.match(/BACILOSCOPIA[^.\n]*POSITIVO[^\n.]*/i);
    return 'BACILOSCOPIA ' + fechaC + ': ' + (mPos ? mPos[0].trim() : 'BACILOSCOPIA POSITIVA');
  }
  var estado = 'NEGATIVO';
  var pEst = tUpper.indexOf('ESTADO');
  if (pEst !== -1) {
    var fEst = tNorm.substring(pEst + 17, pEst + 80).split('*')[1] || tNorm.substring(pEst + 17, pEst + 80);
    estado = fEst.split('MICRO')[0].split('PRODUCTO')[0].trim().toUpperCase();
  }
  return sitio + ' ' + fechaC + ': ' + estado;
}

export function parseCultivo_(textoBruto, tNorm) {
  var tUpper = tNorm.toUpperCase();
  if (!isCultivoReportText_(tUpper)) return '';
  var fechaC = parseCultivoFecha_(tNorm);
  var lineasTexto = textoBruto.split('\n').map(function (l) {
    return l.replace(/\r/g, '');
  });
  var germenRuns = findCultivoGermenRuns(lineasTexto);
  var mycoOut = parseMycobacteriasStudies_(lineasTexto, fechaC);
  if (mycoOut && !germenRuns.length) return mycoOut;
  var sitio = buildCultivoTipoDisplay(detectTipoCultivoLine(lineasTexto), detectMuestraDesdeProducto(lineasTexto));
  var reportePreliminar = /REPORTE\s+PRELIMINAR/i.test(lineasTexto.join('\n'));
  if (germenRuns.length) {
    return parseCultivoGermenRuns_(germenRuns, lineasTexto, sitio, fechaC, reportePreliminar);
  }
  return parseCultivoNegativo_(tNorm, tUpper, sitio, fechaC);
}

export {
  formatCultivoCondensedForCopy,
  formatSensCrudasBlockForCopy,
  classifyAtbInterp,
  buildAtbChipsHtml,
  extractMicSortKey,
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
  isParsedCultivoHeaderLine,
} from './labs-cultivo-atb.mjs';

export {
  findCultivoGermenRuns,
  parseSensCrudasAntibiogramaSlice,
  parseCuentaFromCultivoChunkLines,
} from './labs-cultivo-scan.mjs';

