import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLabRepoPortalClient } from './portal-client.mjs';
import {
  LAB_REPO_BASE_URL,
  LAB_REPO_SEARCH_MODE_REGISTRO,
} from './constants.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIX = (name) => fs.readFileSync(path.join(__dir, 'fixtures', name), 'utf8');

const initialHtml = FIX('index-initial.html');
const registroModeHtml = FIX('index-registro-mode.html');
const resultsHtml = FIX('search-results-registro.html');

test('searchByRegistro GETs index, POSTs Drop1 REGISTRO, then POSTs Buscar', async () => {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || 'GET',
      body: init.body || '',
      headers: init.headers || {},
    });
    if (calls.length === 1) {
      return {
        ok: true,
        headers: {
          getSetCookie: () => ['ASP.NET_SessionId=fixture-session; path=/'],
          get: (name) => (name === 'set-cookie' ? null : ''),
        },
        text: async () => initialHtml,
      };
    }
    if (calls.length === 2) {
      return {
        ok: true,
        headers: { getSetCookie: () => [], get: () => null },
        text: async () => registroModeHtml,
      };
    }
    return {
      ok: true,
      headers: { getSetCookie: () => [], get: () => null },
      text: async () => resultsHtml,
    };
  };

  const client = createLabRepoPortalClient({ fetch: fetchFn });
  const { rows } = await client.searchByRegistro('2203912-1');

  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url, LAB_REPO_BASE_URL);

  const dropParams = new URLSearchParams(calls[1].body);
  assert.equal(dropParams.get('Drop1'), LAB_REPO_SEARCH_MODE_REGISTRO);
  assert.equal(dropParams.get('__EVENTTARGET'), 'Drop1');

  const searchParams = new URLSearchParams(calls[2].body);
  assert.equal(searchParams.get('Drop1'), LAB_REPO_SEARCH_MODE_REGISTRO);
  assert.equal(searchParams.get('TextBox2'), '2203912-1');
  assert.equal(searchParams.get('Button1'), 'Buscar');
  assert.equal(searchParams.get('__VIEWSTATE'), 'fixture-after-drop1');

  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.registro === '2203912-1'));
  assert.equal(rows[0].folio, '2606270295');
  assert.equal(client.getCookieJar(), 'ASP.NET_SessionId=fixture-session');
});

test('ensureRegistroMode POSTs dropdown change when page defaults to NOMBRE', async () => {
  const calls = [];
  const fetchFn = async (_url, init = {}) => {
    calls.push({ method: init.method || 'GET', body: init.body || '' });
    return {
      ok: true,
      headers: { getSetCookie: () => [], get: () => null },
      text: async () => FIX('search-results-registro.html'),
    };
  };

  const client = createLabRepoPortalClient({ fetch: fetchFn });
  const nextHtml = await client.ensureRegistroMode(initialHtml);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  const postParams = new URLSearchParams(calls[0].body);
  assert.equal(postParams.get('Drop1'), LAB_REPO_SEARCH_MODE_REGISTRO);
  assert.equal(postParams.get('__EVENTTARGET'), 'Drop1');
  assert.ok(nextHtml.includes('GridView1'));
});

test(
  'live searchByRegistro against hospital portal',
  { skip: process.env.R_PLUS_LAB_REPO_LIVE !== '1' },
  async () => {
    // Requires hospital LAN access to LAB_REPO_BASE_URL.
    // Run: R_PLUS_LAB_REPO_LIVE=1 node --test lib/lab-repo/portal-client.test.mjs
    const client = createLabRepoPortalClient({});
    const registro = process.env.R_PLUS_LAB_REPO_REGISTRO || '2203912-1';
    const { rows } = await client.searchByRegistro(registro);
    assert.ok(Array.isArray(rows));
    if (rows.length > 0) {
      assert.ok(rows.every((row) => row.registro));
      assert.ok(rows.every((row) => row.folio));
    }
  }
);
