import {
  LAB_REPO_BASE_URL,
  LAB_REPO_SEARCH_MODE_REGISTRO,
} from './constants.mjs';
import {
  parseAspNetHiddenFields,
  parseLabResultRows,
  parseSearchFormControls,
  isRegistroSearchMode,
} from './portal-html.mjs';

function formBody(fields) {
  return new URLSearchParams(fields).toString();
}

function buildAspNetHiddenFields(html) {
  return { ...parseAspNetHiddenFields(html) };
}

function mergeSetCookie(cookieJar, res) {
  const setCookies = res.headers.getSetCookie?.();
  if (setCookies?.length) {
    return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  const single = res.headers.get('set-cookie');
  if (!single) return cookieJar;

  const parts = single.split(/,(?=\s*\w+=)/);
  const merged = parts.map((cookie) => cookie.split(';')[0].trim()).join('; ');
  return merged || cookieJar;
}

async function readBinaryResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const ab = await res.arrayBuffer();
  return { contentType, body: Buffer.from(ab) };
}

function createSessionTransport(fetchFn, cookieRef) {
  const cookieHeaders = () => (cookieRef.value ? { Cookie: cookieRef.value } : {});

  function storeCookies(res) {
    cookieRef.value = mergeSetCookie(cookieRef.value, res);
  }

  async function get(url) {
    const res = await fetchFn(url, { headers: cookieHeaders() });
    storeCookies(res);
    if (!res.ok) throw new Error(`lab-repo-http-${res.status}`);
    return res.text();
  }

  async function post(url, fields) {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...cookieHeaders(),
      },
      body: formBody(fields),
    });
    storeCookies(res);
    if (!res.ok) throw new Error(`lab-repo-http-${res.status}`);
    return res.text();
  }

  async function postBinary(url, fields) {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...cookieHeaders(),
      },
      body: formBody(fields),
    });
    storeCookies(res);
    if (!res.ok) throw new Error(`lab-repo-http-${res.status}`);
    return readBinaryResponse(res);
  }

  async function getBinary(url) {
    const res = await fetchFn(url, { headers: cookieHeaders() });
    storeCookies(res);
    if (!res.ok) throw new Error(`lab-repo-http-${res.status}`);
    return readBinaryResponse(res);
  }

  return { get, post, postBinary, getBinary };
}

export function createLabRepoPortalClient(deps = {}) {
  const fetchFn = deps.fetch || globalThis.fetch;
  const cookieRef = { value: deps.initialCookie || '' };
  const { get, post, postBinary, getBinary } = createSessionTransport(fetchFn, cookieRef);

  async function ensureRegistroMode(html) {
    const controls = parseSearchFormControls(html);
    if (isRegistroSearchMode(controls)) return html;

    const hidden = buildAspNetHiddenFields(html);
    return post(LAB_REPO_BASE_URL, {
      ...hidden,
      __EVENTTARGET: controls.modeFieldName,
      __EVENTARGUMENT: '',
      [controls.modeFieldName]: LAB_REPO_SEARCH_MODE_REGISTRO,
    });
  }

  async function searchByRegistro(registro) {
    const first = await get(LAB_REPO_BASE_URL);
    const modeHtml = await ensureRegistroMode(first);
    const hidden = buildAspNetHiddenFields(modeHtml);
    const controls = parseSearchFormControls(modeHtml);
    const resultHtml = await post(LAB_REPO_BASE_URL, {
      ...hidden,
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      [controls.modeFieldName]: LAB_REPO_SEARCH_MODE_REGISTRO,
      [controls.searchFieldName]: String(registro || '').trim(),
      [controls.searchButtonName]: 'Buscar',
    });
    return {
      rows: parseLabResultRows(resultHtml),
      pageHtml: resultHtml,
    };
  }

  return {
    searchByRegistro,
    get,
    post,
    postBinary,
    getBinary,
    ensureRegistroMode,
    getCookieJar: () => cookieRef.value,
  };
}
