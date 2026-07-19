/**
 * Team invites: short codes for Mi rotación (desktop DB), not Safari deep links.
 */

const INVITE_CODE_MIN_LEN = 6;

/**
 * @param {string} teamId
 */
export function teamInviteCode(teamId) {
  return String(teamId || '')
    .replace(/-/g, '')
    .slice(0, 8)
    .toLowerCase();
}

/**
 * @param {string} raw
 */
export function normalizeTeamInviteCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9-]/g, '')
    .replace(/-/g, '');
}

/**
 * @param {string} [search]
 */
/** LAN bearer tokens are 64 hex; clinical invite codes are short (≤8). */
export function isLikelyLanBearerToken(raw) {
  const norm = normalizeTeamInviteCode(raw);
  return norm.length >= 32;
}

export function parseClinicalTeamJoinQuery(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const codeParam = String(params.get('code') || '').trim();
  if (codeParam && isLikelyLanBearerToken(codeParam)) {
    return { teamId: '', inviteCode: '' };
  }
  const joinCode = normalizeTeamInviteCode(
    params.get('joinCode') || params.get('teamCode') || params.get('code') || ''
  );
  if (joinCode.length >= INVITE_CODE_MIN_LEN) {
    return { teamId: '', inviteCode: joinCode };
  }
  const teamId = String(params.get('joinTeam') || params.get('clinicalTeam') || '').trim();
  return {
    teamId,
    inviteCode: teamId ? teamInviteCode(teamId) : '',
  };
}

/**
 * @param {string} code
 * @param {Array<{ team_id?: string }>} teams
 */
export function resolveTeamIdFromInviteCode(code, teams) {
  const norm = normalizeTeamInviteCode(code);
  if (norm.length < INVITE_CODE_MIN_LEN) return '';
  const fullUuid = norm.length >= 32 ? norm.slice(0, 32) : norm;
  const list = Array.isArray(teams) ? teams : [];
  const matches = list.filter((t) => {
    const id = String(t?.team_id || '')
      .replace(/-/g, '')
      .toLowerCase();
    return id === fullUuid || id.startsWith(norm);
  });
  if (matches.length === 1) return String(matches[0].team_id || '');
  return '';
}

/**
 * @param {string} code
 * @param {Array<{ team_id?: string }>} teams
 * @returns {{ reason: 'empty'|'lan_bearer'|'too_short'|'ambiguous'|'not_in_db'|'ok', teamId?: string, matchCount?: number }}
 */
export function diagnoseInviteCodeFailure(code, teams) {
  const norm = normalizeTeamInviteCode(code);
  if (!norm) return { reason: 'empty' };
  if (isLikelyLanBearerToken(norm)) return { reason: 'lan_bearer' };
  if (norm.length < INVITE_CODE_MIN_LEN) return { reason: 'too_short' };
  const fullUuid = norm.length >= 32 ? norm.slice(0, 32) : norm;
  const list = Array.isArray(teams) ? teams : [];
  const matches = list.filter((t) => {
    const id = String(t?.team_id || '')
      .replace(/-/g, '')
      .toLowerCase();
    return id === fullUuid || id.startsWith(norm);
  });
  if (matches.length > 1) return { reason: 'ambiguous', matchCount: matches.length };
  if (matches.length === 1) return { reason: 'ok', teamId: String(matches[0].team_id || '') };
  return { reason: 'not_in_db' };
}

/** @param {{ reason: string, matchCount?: number }} diag */
export function inviteCodeFailureMessage(diag) {
  switch (diag?.reason) {
    case 'lan_bearer':
      return 'Ese valor es el código LAN de la sala (Wi‑Fi), no el código de equipo. En la invitación busca «Código de equipo» (8 caracteres, p. ej. 2017936e).';
    case 'too_short':
      return 'Código demasiado corto. Copia los 8 caracteres del recuadro «Código de equipo» en Mi rotación.';
    case 'ambiguous':
      return `Hay ${diag.matchCount || 2} equipos con ese prefijo en esta Mac. Pide al R2 el código completo o que te agregue desde el directorio LAN.`;
    case 'not_in_db':
      return 'Este equipo aún no está en tu base. Conéctate a la misma sala ⇄, abre Mi rotación de nuevo (sincroniza) y reintenta; o pide que te agreguen por @usuario.';
    case 'empty':
      return 'Escribe el código de equipo.';
    default:
      return 'Código no válido o equipo no está en esta base.';
  }
}

/**
 * LAN host URL for optional hint (never localhost).
 */
export function resolveClinicalInviteLanHostUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const cfg = JSON.parse(localStorage.getItem('rpc-lan-config') || '{}');
    const host = String(cfg?.hostUrl || '')
      .trim()
      .replace(/\/+$/, '');
    if (!host) return '';
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return '';
    return host;
  } catch {
    return '';
  }
}

export function isClinicalTeamJoinDesktopApp() {
  if (typeof window === 'undefined') return false;
  return !!(window.electronAPI || window.rplusDb);
}

/**
 * @param {{ team_id?: string, name?: string, sala?: string }} team
 */
export function buildClinicalTeamInviteMessage(team) {
  const name = String(team?.name || 'Equipo').trim();
  const sala = String(team?.sala || '').trim();
  const code = teamInviteCode(team?.team_id);
  const lanHost = resolveClinicalInviteLanHostUrl();
  const lines = [
    `Invitación al equipo «${name}»${sala ? ` · ${sala}` : ''} en R+`,
    '',
    `Código de equipo: ${code}`,
    '',
    'En la app R+ del Mac (no Safari):',
    '1. Abre Mi rotación',
    '2. «Unirte con código de equipo» → pega el código',
    '3. Elige tu subciclo (R1) o letra (R2) y confirma',
    '',
    'El enlace web no une al equipo clínico; Safari/iPad solo sirve para censo LAN.',
  ];
  if (lanHost) {
    lines.push('', `Sala en vivo (opcional): ${lanHost}`);
  }
  return lines.join('\n');
}

/**
 * @param {{ team_id?: string }} team
 */
export function buildClinicalTeamInviteUrl(team) {
  void team;
  return '';
}

const BROWSER_GATE_ID = 'clinical-team-invite-browser-gate';

/**
 * Safari / browser: explain desktop app + code (do not boot mobile LAN join).
 * @param {string} code
 */
export function mountClinicalTeamInviteBrowserGate(code) {
  if (typeof document === 'undefined') return;
  const normalized = normalizeTeamInviteCode(code);
  if (!normalized || isClinicalTeamJoinDesktopApp()) return;
  if (document.getElementById(BROWSER_GATE_ID)) return;

  const wrap = document.createElement('div');
  wrap.id = BROWSER_GATE_ID;
  wrap.className = 'clinical-team-invite-browser-gate';
  wrap.setAttribute('role', 'alertdialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `
    <div class="clinical-team-invite-browser-gate-card">
      <h2>Únete desde la app R+ en Mac</h2>
      <p>Los enlaces en Safari no agregan al equipo clínico (solo la app de escritorio con tu base de datos).</p>
      <p class="clinical-team-invite-browser-gate-code">Código: <strong>${normalized}</strong></p>
      <ol>
        <li>Abre la aplicación <strong>R+</strong> en tu Mac (no el navegador).</li>
        <li>Ve a <strong>Mi rotación</strong>.</li>
        <li>En <strong>Unirte con código de equipo</strong>, pega: <code>${normalized}</code></li>
      </ol>
      <button type="button" class="btn-save" id="clinical-team-invite-browser-gate-dismiss">Entendido</button>
    </div>`;
  document.body.appendChild(wrap);
  const btn = document.getElementById('clinical-team-invite-browser-gate-dismiss');
  if (btn) {
    btn.addEventListener('click', () => {
      wrap.remove();
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('joinTeam');
        url.searchParams.delete('joinCode');
        url.searchParams.delete('clinicalTeam');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (_e) { void _e; }
    });
  }
}

/**
 * @param {string} [search]
 */
export function tryMountClinicalTeamInviteBrowserGate(search) {
  const parsed = parseClinicalTeamJoinQuery(search || (typeof location !== 'undefined' ? location.search : ''));
  const code = parsed.inviteCode || (parsed.teamId ? teamInviteCode(parsed.teamId) : '');
  if (code) mountClinicalTeamInviteBrowserGate(code);
}
