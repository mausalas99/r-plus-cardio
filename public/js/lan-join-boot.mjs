/** Mobile /join/:ticketId — exchange ticket, persist Bearer, clean URL. */

import { resolveLanJoinHostUrl } from './lan-join-link.mjs';

const BEARER_KEY = 'rplus.lan.bearer';
const HOST_KEY = 'rplus.lan.hostUrl';
const LAN_CONFIG_KEY = 'rpc-lan-config';

function ticketIdFromPath() {
  const m = String(location.pathname || '').match(/\/join\/(req_[a-f0-9]{12})\/?$/i);
  return m ? m[1] : '';
}

export function persistLanJoinCredentials(hostUrl, token) {
  const url = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const bearer = String(token || '').trim();
  if (bearer) {
    try {
      localStorage.setItem(BEARER_KEY, bearer);
    } catch (_e) { void _e; }
  }
  if (url) {
    try {
      localStorage.setItem(HOST_KEY, url);
    } catch (_e) { void _e; }
  }
  if (url && bearer) {
    try {
      localStorage.setItem(LAN_CONFIG_KEY, JSON.stringify({ hostUrl: url, teamCode: bearer }));
    } catch (_e) { void _e; }
  }
}

const EXCHANGE_TIMEOUT_MS = 12000;

export async function runJoinTicketExchange(ticketId) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXCHANGE_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('/api/lan/v1/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: ticketId }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('join_failed');
  const data = await res.json();
  const hostUrl =
    resolveLanJoinHostUrl(data.hostUrl, location.origin) ||
    `${location.protocol}//${location.host}`;
  persistLanJoinCredentials(hostUrl, data.token);
  const params = new URLSearchParams(location.search);
  params.set('rpc-mobile', '1');
  history.replaceState({}, '', '/mobile');
  location.replace('/mobile/?' + params.toString());
}

const ticketId = ticketIdFromPath();
if (ticketId) {
  runJoinTicketExchange(ticketId).catch(() => {
    document.body.innerHTML =
      '<p style="font-family:system-ui,sans-serif;padding:1rem;">No pudimos unirte. Pide al anfitrión un enlace o PIN nuevo.</p>';
  });
}
