/** Antibiograma abbreviation rules — extracted from parseCultivo_. */

var ATB_ABBR_RULES = [
  [/PIPERACILINA|PIP\/TAZ/, 'PIP/TAZO'],
  [/TRIMET|TMP\/SMX|TRIMET\/SULFA/, 'TMP/SMX'],
  [/AMP\S*\/\s*SULB|AMPICILINA.*SULBACTAM|AMP\/SULB/, 'AMP-SULB'],
  [/GENT\.?\s*SINERG|SINERG/, 'GENT-SIN'],
  [/GENTAMICINA/, 'GENT'],
  [/AMIKACINA/, 'AMIK'],
  [/TOBRAMICINA/, 'TOBRA'],
  [/TETRACICLINA/, 'TETRA'],
  [/NITROFURANTOINA/, 'NITRO'],
  [/CIPROFLOXACINA/, 'CIPRO'],
  [/LEVOFLOXACINA/, 'LVX'],
  [/MEROPENEM/, 'MERO'],
  [/ERTAPENEM/, 'ERTA'],
  [/IMIPENEM/, 'IMI'],
  [/CEFTRIAXONA/, 'CFTX'],
  [/CEFOTAXIMA/, 'CTX'],
  [/CEFOXITINA/, 'CFXN'],
  [/CEFAZOLINA/, 'CFZ'],
  [/CEFEPIMA/, 'FEP'],
  [/CEFTAZIDIM.*AVIBACT|AVIBACTAM/, 'CAZ-AVI'],
  [/CEFTAZIDIM|CEFTAZIDIMA/, 'CAZ'],
  [/DAPTOMICINA/, 'DAPTO'],
  [/LINEZOLID/, 'LINEZ'],
  [/VANCOMICINA/, 'VANCO'],
  [/PENICILINA|BENZILPENICILINA/, 'PEN'],
  [/AMPICILINA/, 'AMP'],
  [/CLINDAMICINA/, 'CLINDA'],
];

export function abreviarAbAtb_(n) {
  n = String(n || '').toUpperCase().trim();
  for (var i = 0; i < ATB_ABBR_RULES.length; i++) {
    if (ATB_ABBR_RULES[i][0].test(n)) return ATB_ABBR_RULES[i][1];
  }
  if (/AMPICILINA/.test(n) && !/SULB/.test(n)) return 'AMP';
  var base = n
    .replace(/\bSODICO\b|\bSODIUM\b|\bDISODICO\b/g, '')
    .trim()
    .split('(')[0]
    .trim()
    .split(/\s+/)[0];
  return base.length > 10 ? base.substring(0, 10) : base;
}
