import {
  LAB_REPO_BASE_URL,
  LAB_REPO_SEARCH_MODE_REGISTRO,
} from './constants.mjs';
import {
  parseAspNetHiddenFields,
  parseSearchFormControls,
} from './portal-html.mjs';
import { extractSomeTextFromImpresionHtml, impresionUrlFromSelectHtml } from './impresion-html.mjs';
import { extractSomeTextFromPdfBuffer } from './pdf-text.mjs';

function pickFormFieldValue(html, name) {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i');
  const match = String(html || '').match(re);
  return match ? match[1] : '';
}

function buildAspNetHiddenFields(html) {
  return { ...parseAspNetHiddenFields(html) };
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer.slice(0, 4).toString() === '%PDF';
}

function resolvePortalUrl(relativeUrl) {
  return new URL(relativeUrl, LAB_REPO_BASE_URL).href;
}

function buildSelectPostFields(pageHtml, row) {
  const hidden = buildAspNetHiddenFields(pageHtml);
  const controls = parseSearchFormControls(pageHtml);
  return {
    ...hidden,
    __EVENTTARGET: row.selectEventTarget,
    __EVENTARGUMENT: row.selectEventArgument,
    [controls.modeFieldName]:
      controls.currentMode || LAB_REPO_SEARCH_MODE_REGISTRO,
    [controls.searchFieldName]: pickFormFieldValue(
      pageHtml,
      controls.searchFieldName
    ),
  };
}

async function fetchImpresionText(client, selectResponseHtml) {
  const relative = impresionUrlFromSelectHtml(selectResponseHtml);
  const url = resolvePortalUrl(relative);
  const { contentType, body } = await client.getBinary(url);
  if (contentType.includes('application/pdf') || isPdfBuffer(body)) {
    return extractSomeTextFromPdfBuffer(body);
  }
  return extractSomeTextFromImpresionHtml(body.toString('utf8'));
}

/**
 * GridView Select → report text (Impresion.aspx HTML or rare PDF).
 * @returns {Promise<string>}
 */
export async function fetchReportTextForRow(client, row, pageHtml) {
  if (!row?.selectEventTarget) {
    throw new Error('lab-repo-missing-select-target');
  }

  const fields = buildSelectPostFields(pageHtml, row);
  const { contentType, body } = await client.postBinary(LAB_REPO_BASE_URL, fields);

  if (contentType.includes('application/pdf') || isPdfBuffer(body)) {
    return extractSomeTextFromPdfBuffer(body);
  }

  const selectHtml = body.toString('utf8');
  if (/Impresion\.aspx/i.test(selectHtml) || /window\.open/i.test(selectHtml)) {
    return fetchImpresionText(client, selectHtml);
  }

  const embedded = extractSomeTextFromImpresionHtml(selectHtml);
  if (/Expediente\s*:/i.test(embedded) && /Nombre\s*:/i.test(embedded)) {
    return embedded;
  }

  throw new Error('lab-repo-report-not-found');
}

/** @deprecated alias — returns report bytes only when response is PDF. */
export async function downloadPdfForRow(client, row, pageHtml) {
  const text = await fetchReportTextForRow(client, row, pageHtml);
  return Buffer.from(text, 'utf8');
}
