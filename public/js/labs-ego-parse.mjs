// EGO (examen general de orina) parser — extracted from labs.js parseEGO_.
import {
  valorTrasEtiqueta,
  collectEgoFieldValues_,
  buildEgoSections_,
} from './labs-ego-parse-helpers.mjs';

function extraerQuimicaOrinaParaEGO_(textoBruto) {
  var out = { na: null, k: null, cl: null, cr: null };
  if (!textoBruto) return out;
  var lineas = textoBruto.split(/\r?\n/).map(function (l) {
    return l.replace(/\*/g, '').trim();
  });
  out.k = valorTrasEtiqueta(lineas, ['POTASIO EN ORINA']);
  out.na = valorTrasEtiqueta(lineas, ['SODIO EN ORINA']);
  out.cr = valorTrasEtiqueta(lineas, ['CREATININA EN ORINA']);
  var mCl = textoBruto.match(/CLORO\s+EN\s+ORINA\s*:?\s*(\d+[.,]?\d*)/i);
  if (mCl) out.cl = mCl[1].replace(',', '.');
  return out;
}

function egoBlockLineas_(textoBruto) {
  var tUp = textoBruto.toUpperCase();
  var pos =
    tUp.indexOf('EXAMEN GENERAL DE ORINA') !== -1
      ? tUp.indexOf('EXAMEN GENERAL DE ORINA')
      : tUp.indexOf('ANALISIS DE ORINA') !== -1
        ? tUp.indexOf('ANALISIS DE ORINA')
        : tUp.indexOf('URIANALISIS') !== -1
          ? tUp.indexOf('URIANALISIS')
          : -1;
  if (pos === -1) return [];
  var fin = tUp.search(/BACTERIOLOGIA|CULTIVO|COMENTARIO DE MUESTRA/);
  var bloque = fin !== -1 && fin > pos ? textoBruto.substring(pos, fin) : textoBruto.substring(pos);
  return bloque.split(/\r?\n/).map(function (l) {
    return l.replace(/\*/g, '').trim();
  });
}

function egoHasMinimalFields_(f) {
  return f.color !== '---' || f.aspecto !== '---' || f.ph !== '---' || f.leu !== '---' || f.eri !== '---';
}

export function parseEGO_(textoBruto) {
  var qOrina = extraerQuimicaOrinaParaEGO_(textoBruto);
  var hasQO = !!(qOrina.na || qOrina.k || qOrina.cl || qOrina.cr);
  var lineas = egoBlockLineas_(textoBruto);
  if (!lineas.length && !hasQO) return '';

  var f = collectEgoFieldValues_(lineas);
  if (!hasQO && !egoHasMinimalFields_(f)) return '';

  var sections = buildEgoSections_(f, qOrina);
  if (!sections.fisico.length && !sections.quimico.length && !sections.sedimento.length) return '';

  var sub = ['EGO:'];
  if (sections.fisico.length) sub.push('  ' + sections.fisico.join('  '));
  if (sections.quimico.length) sub.push('  ' + sections.quimico.join('  '));
  if (sections.sedimento.length) sub.push('  ' + sections.sedimento.join('  '));
  return sub.join('\n');
}
