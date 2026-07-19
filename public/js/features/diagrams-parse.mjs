// Parsed resLabs sections → valores numéricos (diagramas SVG + tendencias por estudio)
import { parseBhTrendValuesFromResLab } from "../labs.js";
import { tendEligibleSectionKey } from "../tend-core.mjs";
import { normalizeTropTrendFields_ } from "../labs-troponin.mjs";

export function parsearSecciones(resLabs) {
  var secs = {};
  resLabs.forEach(function (linea) {
    var primera = linea.split("\n")[0].trim().replace("\t", " ");
    var tokens = primera.split(" ");
    var key = tokens[0].replace(":", "");
    var vals = {};
    var i = 1;
    while (i < tokens.length) {
      var tok = tokens[i];
      if (!tok || tok === "-") {
        i++;
        continue;
      }
      var next = tokens[i + 1];
      if (next !== undefined && !isNaN(parseFloat(next.replace("*", "")))) {
        vals[tok] = { val: next.replace("*", ""), ab: next.endsWith("*") };
        i += 2;
      } else {
        i++;
      }
    }
    secs[key] = vals;
  });
  return secs;
}

function g(secs, sec, key) {
  var s = secs[sec];
  if (!s) return null;
  var v = s[key];
  if (!v || v.val === "---") return null;
  return v;
}

export function extractParsedValues(resLabs) {
  var secs = parsearSecciones(resLabs);
  function num(sec, key) {
    var v = g(secs, sec, key);
    return v ? parseFloat(v.val) : null;
  }
  return {
    Hb: num("BH", "Hb"),
    Hto: num("BH", "Hto"),
    Leu: num("BH", "Leu"),
    Plt: num("BH", "Plt"),
    Glu: num("QS", "Glu"),
    Cr: num("QS", "Cr"),
    eTFG: num("QS", "eTFG"),
    BUN: num("QS", "BUN"),
    PCR: num("QS", "PCR"),
    AU: num("QS", "AU"),
    TGL: num("QS", "TGL"),
    COL: num("QS", "COL"),
    Na: num("ESC", "Na"),
    K: num("ESC", "K"),
    Cl: num("ESC", "Cl"),
    HCO3: num("ESC", "HCO3"),
    Ca: num("ESC", "Ca"),
    AST: num("PFHs", "AST"),
    ALT: num("PFHs", "ALT"),
    FA: num("PFHs", "FA"),
    BT: num("PFHs", "BT"),
  };
}

/** Mapa sectionKey → fieldKey → número (tendencias por estudio). */
export function buildParsedBySectionFromResLabs(resLabs, bhExtras) {
  var secs = parsearSecciones(resLabs || []);
  var out = {};
  Object.keys(secs).forEach(function (sec) {
    if (!tendEligibleSectionKey(sec)) return;
    var row = {};
    var tbl = secs[sec];
    Object.keys(tbl).forEach(function (k) {
      var cell = tbl[k];
      if (!cell || cell.val == null || cell.val === "---") return;
      var n = parseFloat(String(cell.val).replace(/\*/g, "").replace(",", "."));
      if (!isFinite(n)) return;
      row[k] = n;
    });
    if (Object.keys(row).length) {
      if (sec === 'TROP') normalizeTropTrendFields_(row);
      out[sec] = row;
    }
  });
  (resLabs || []).forEach(function (entry) {
    var head = String(entry).split("\n")[0].trim();
    if (!/^BH/i.test(head) && !/^COAG/i.test(head)) return;
    var bhCells = parseBhTrendValuesFromResLab(entry);
    Object.keys(bhCells).forEach(function (k) {
      var cell = bhCells[k];
      if (!cell || cell.val == null || cell.val === "---") return;
      var n = parseFloat(String(cell.val).replace(/\*/g, "").replace(",", "."));
      if (!isFinite(n)) return;
      if (!out.BH) out.BH = {};
      if (out.BH[k] == null) out.BH[k] = n;
    });
  });
  if (bhExtras && typeof bhExtras === "object") {
    if (!out.BH) out.BH = {};
    Object.keys(bhExtras).forEach(function (k) {
      var n = parseFloat(String(bhExtras[k]).replace(/\*/g, "").replace(",", "."));
      if (isFinite(n) && out.BH[k] == null) out.BH[k] = n;
    });
  }
  return out;
}
