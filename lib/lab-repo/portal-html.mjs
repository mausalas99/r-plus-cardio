import {
  LAB_REPO_SEARCH_MODE_REGISTRO,
} from './constants.mjs';

const DO_POST_BACK_RE =
  /__doPostBack\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/;

function stripTags(fragment) {
  return String(fragment || '').replace(/<[^>]+>/g, '').trim();
}

function pickHiddenFieldValue(html, name) {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i');
  const m = String(html || '').match(re);
  return m ? m[1] : '';
}

function parseSelectedOptionValue(selectInner) {
  const selectedFirst = String(selectInner || '').match(
    /<option[^>]*selected[^>]*value="([^"]*)"/i
  );
  if (selectedFirst) return selectedFirst[1];

  const valueFirst = String(selectInner || '').match(
    /<option[^>]*value="([^"]*)"[^>]*selected/i
  );
  return valueFirst ? valueFirst[1] : '';
}

function parseTableRows(tableInner) {
  return [...String(tableInner || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
}

function parseHeaderCells(headerRowHtml) {
  return [...String(headerRowHtml || '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((match) => stripTags(match[1]));
}

function parseDataCells(rowHtml) {
  return [...String(rowHtml || '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => match[1].trim());
}

function buildColumnIndex(headerCells) {
  const colIndex = {};
  headerCells.forEach((label, index) => {
    colIndex[label] = index;
  });
  return colIndex;
}

function cellAt(cells, colIndex, label, fallbackIndex) {
  const index = Object.prototype.hasOwnProperty.call(colIndex, label)
    ? colIndex[label]
    : fallbackIndex;
  return stripTags(cells[index]);
}

function parseSelectPostBack(cells) {
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const match = String(cells[i] || '').match(DO_POST_BACK_RE);
    if (match) {
      return { target: match[1], argument: match[2] };
    }
  }
  return { target: '', argument: '' };
}

export function parseAspNetHiddenFields(html) {
  return {
    __VIEWSTATE: pickHiddenFieldValue(html, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: pickHiddenFieldValue(html, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: pickHiddenFieldValue(html, '__EVENTVALIDATION'),
    __VIEWSTATEENCRYPTED: pickHiddenFieldValue(html, '__VIEWSTATEENCRYPTED'),
    __LASTFOCUS: pickHiddenFieldValue(html, '__LASTFOCUS'),
    __EVENTTARGET: pickHiddenFieldValue(html, '__EVENTTARGET'),
    __EVENTARGUMENT: pickHiddenFieldValue(html, '__EVENTARGUMENT'),
  };
}

/** @returns {{ fechaSolicitud: string, nombre: string, registro: string, departamento: string, tipo: string, folio: string, selectEventTarget: string, selectEventArgument: string }[]} */
export function parseLabResultRows(html) {
  const tableMatch = String(html || '').match(
    /<table[^>]*id="GridView1"[^>]*>([\s\S]*?)<\/table>/i
  );
  if (!tableMatch) return [];

  const rowMatches = parseTableRows(tableMatch[1]);
  if (rowMatches.length < 2) return [];

  const headerCells = parseHeaderCells(rowMatches[0][1]);
  const colIndex = buildColumnIndex(headerCells);
  const rows = [];

  for (let rowIndex = 1; rowIndex < rowMatches.length; rowIndex += 1) {
    const cells = parseDataCells(rowMatches[rowIndex][1]);
    if (cells.length === 0) continue;

    const postBack = parseSelectPostBack(cells);
    rows.push({
      fechaSolicitud: cellAt(cells, colIndex, 'Fecha Solicitud', 0),
      nombre: cellAt(cells, colIndex, 'Nombre', 1),
      registro: cellAt(cells, colIndex, 'Registro', 2),
      departamento: cellAt(cells, colIndex, 'Departamento', 3),
      tipo: cellAt(cells, colIndex, 'Tipo de Estudio', 4),
      folio: cellAt(cells, colIndex, 'Folio', 5),
      selectEventTarget: postBack.target,
      selectEventArgument: postBack.argument,
    });
  }

  return rows;
}

export function parseFechaSolicitudMs(fechaSolicitud) {
  const match = String(fechaSolicitud || '').match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/
  );
  if (!match) return NaN;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  ).getTime();
}

export function filterRowsByDateRange(rows, desde, hasta) {
  const lo = desde instanceof Date ? desde.getTime() : NaN;
  const hi = hasta instanceof Date ? hasta.getTime() : NaN;
  return (rows || []).filter((row) => {
    const ms = parseFechaSolicitudMs(row.fechaSolicitud);
    return Number.isFinite(ms) && ms >= lo && ms <= hi;
  });
}

/** Discover search controls from initial HTML — names filled from fixture README. */
export function parseSearchFormControls(html) {
  const source = String(html || '');
  const dropMatch = source.match(
    /<select[^>]*name="Drop1"[^>]*>([\s\S]*?)<\/select>/i
  );

  return {
    modeFieldName: 'Drop1',
    searchFieldName: 'TextBox2',
    searchButtonName: 'Button1',
    currentMode: dropMatch ? parseSelectedOptionValue(dropMatch[1]) : '',
  };
}

export function isRegistroSearchMode(controls) {
  return String(controls?.currentMode || '').toUpperCase()
    === LAB_REPO_SEARCH_MODE_REGISTRO;
}

/** Portal shows this label when REGISTRO/NOMBRE search returned zero rows. */
export function pageIndicatesNoSearchResults(html) {
  return /SIN\s+COINCIDENCIAS/i.test(String(html || ''));
}
