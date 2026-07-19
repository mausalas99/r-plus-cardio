/**
 * Guardia LAN hub shell UI (status line + sala rooms). Extracted from lan-sync.mjs.
 */
import { bundledWardInviteUrl } from '../clinical-settings.mjs';

function prefillBundledWardInviteInput(input) {
  if (!input || String(input.value || '').trim()) return;
  var bundled = String(bundledWardInviteUrl() || '').trim();
  if (bundled) input.value = bundled;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   connected: boolean,
 *   isElectronDesktop: boolean,
 *   statusLine?: string,
 *   statusHint?: string,
 *   onBecomeHost?: () => void,
 *   showBecomeHost?: boolean,
 *   showInvitePaste?: boolean,
 * }} opts
 */
function removeHeroPrimaryCtas(hero) {
  hero.querySelectorAll('[data-lan-hero-cta]').forEach(function (el) {
    el.remove();
  });
}

function appendBecomeHostButton(hero, opts, connected) {
  if (connected || !opts.isElectronDesktop || opts.showBecomeHost === false) return;
  var becomeHostBtn = document.createElement('button');
  becomeHostBtn.type = 'button';
  becomeHostBtn.className = 'btn-lan-primary';
  becomeHostBtn.style.marginTop = '8px';
  becomeHostBtn.style.width = '100%';
  becomeHostBtn.textContent = 'Convertirse en host';
  becomeHostBtn.setAttribute('data-lan-action', 'become-host');
  becomeHostBtn.setAttribute('data-lan-hero-cta', '1');
  hero.appendChild(becomeHostBtn);
}

function appendConnectTurnButton(hero, opts, connected) {
  if (connected || !opts.showConnectTurn) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-lan-primary';
  btn.style.marginTop = '8px';
  btn.style.width = '100%';
  btn.textContent = 'Conectar al turno';
  btn.setAttribute('data-lan-action', 'connect-turn');
  btn.setAttribute('data-lan-hero-cta', '1');
  hero.appendChild(btn);
}

function appendInvitePasteBlock(hero) {
  var inviteHint = document.createElement('p');
  inviteHint.className = 'lan-connect-card-hint lan-hub-invite-paste-hint';
  inviteHint.style.marginTop = '10px';
  inviteHint.innerHTML =
    'Pega aqu\u00e9 el enlace <strong>Otra Mac del equipo</strong> del anfitri\u00f3n (<code>http://\u2026/join/req_\u2026</code>).';
  hero.appendChild(inviteHint);
  var inputInvite = document.createElement('textarea');
  inputInvite.className = 'profile-input';
  inputInvite.setAttribute('data-lan-invite-input', '1');
  inputInvite.id = 'lan-input-invite-link';
  inputInvite.rows = 2;
  inputInvite.autocomplete = 'off';
  inputInvite.placeholder = 'http://10.x.x.x:3738/join/req_…';
  inputInvite.style.marginTop = '6px';
  prefillBundledWardInviteInput(inputInvite);
  hero.appendChild(inputInvite);
  var row = document.createElement('div');
  row.className = 'lan-connect-actions-row';
  row.style.marginTop = '8px';
  var btnJoin = document.createElement('button');
  btnJoin.type = 'button';
  btnJoin.className = 'btn-lan-primary';
  btnJoin.style.flex = '1';
  btnJoin.textContent = 'Unirse con enlace';
  btnJoin.setAttribute('data-lan-action', 'join-invite');
  row.appendChild(btnJoin);
  hero.appendChild(row);
}

export function appendLanHubStatusHero(root, opts) {
  var hero = root.classList.contains('lan-connection-hero')
    ? root
    : root.querySelector('.lan-connection-hero');
  if (!hero) {
    hero = document.createElement('div');
    hero.className = 'lan-connection-hero';
    root.prepend(hero);
  }

  var existingStatus = hero.querySelector('.lan-connection-hero__status');
  if (existingStatus) existingStatus.remove();

  var connected = !!opts.connected;
  var line =
    String(opts.statusLine || '').trim() ||
    (connected
      ? 'Conectado a la red del hospital'
      : 'Sin red \u2014 buscando anfitri\u00f3n en la Wi\u2011Fi del hospital\u2026');

  var status = document.createElement('div');
  status.className = 'lan-connection-hero__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.innerHTML =
    '<div class="lan-hub-status-line">' +
    (connected
      ? '<span class="lan-hub-status-dot lan-hub-status-dot--online"></span> '
      : '<span class="lan-hub-status-dot lan-hub-status-dot--offline"></span> ') +
    line +
    '</div>';
  hero.appendChild(status);

  var hint = String(opts.statusHint || '').trim();
  var showStatusHint = hint && opts.showStatusHint !== false;
  if (showStatusHint) {
    var hintEl = document.createElement('p');
    hintEl.className = 'lan-connection-hero__hint lan-connect-card-hint';
    hintEl.textContent = hint;
    var pinBlock = hero.querySelector('.lan-connection-hero__pin');
    if (pinBlock) hero.insertBefore(hintEl, pinBlock);
    else hero.appendChild(hintEl);
  }

  removeHeroPrimaryCtas(hero);
  appendConnectTurnButton(hero, opts, connected);
  appendBecomeHostButton(hero, opts, connected);

  if (opts.showInvitePaste) {
    appendInvitePasteBlock(hero);
  }
}

/** @param {HTMLElement} root @param {Parameters<typeof appendLanHubStatusHero>[1]} opts */
export function appendLanHubStatusCard(root, opts) {
  appendLanHubStatusHero(root, opts);
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   visibleSalaDefs: { id: string, label: string, key: string }[],
 *   activeRoomId: string,
 * }} opts
 */
export function appendLanHubRoomsCard(root, opts) {
  const defs = opts.visibleSalaDefs || [];
  const activeRoomId = String(opts.activeRoomId || '');
  const activeDef = defs.find((d) => d.id === activeRoomId);
  const summaryHint = activeDef
    ? `En sala: ${activeDef.label}`
    : defs.length
      ? `${defs.length} sala${defs.length === 1 ? '' : 's'} disponible${defs.length === 1 ? '' : 's'}`
      : 'Sin salas visibles';

  const roomsCard = document.createElement('details');
  roomsCard.className = 'rpc-disclosure lan-rooms-panel';
  roomsCard.open = !activeDef && defs.length > 0;

  const summary = document.createElement('summary');
  summary.className = 'rpc-disclosure__summary rpc-disclosure__summary--stacked lan-settings-card-summary';
  summary.innerHTML =
    '<span class="lan-connect-card-title">Salas de guardia</span>' +
    `<span class="lan-connect-card-hint lan-rooms-summary-hint">${summaryHint}</span>`;
  roomsCard.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'rpc-disclosure__body lan-rooms-panel-body';

  if (defs.length) {
    const list = document.createElement('ul');
    list.className = 'lan-rooms-list';
    defs.forEach(function (d) {
      const li = document.createElement('li');
      li.className = 'lan-rooms-list-item';

      const name = document.createElement('span');
      name.className = 'lan-rooms-list-label';
      name.textContent = d.label;

      const joinBtn = document.createElement('button');
      joinBtn.type = 'button';
      joinBtn.className = 'btn-lan-secondary';
      const inRoom = activeRoomId === d.id;
      joinBtn.textContent = inRoom ? 'En sala' : 'Unirse';
      joinBtn.disabled = inRoom;
      joinBtn.setAttribute('data-lan-action', 'join-room');
      joinBtn.setAttribute('data-room-id', d.id);
      joinBtn.setAttribute('data-room-label', d.label);

      li.appendChild(name);
      li.appendChild(joinBtn);
      list.appendChild(li);
    });
    body.appendChild(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'lan-connect-card-hint';
    empty.textContent = 'No hay salas visibles para tu rango o sala asignada.';
    body.appendChild(empty);
  }

  roomsCard.appendChild(body);
  root.appendChild(roomsCard);
}
