/**
 * LAN invite / join UI — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import {
  buildPermanentMobileJoinUrl,
  parseLanInviteInput,
  parseLanJoinQuery,
} from '../../lan-join-link.mjs';
import {
  appendMobileSharerParamsToJoinUrl,
  mobileSharerDisplayLabel,
  resolveMobilePairingRoomId,
} from '../../mobile-sharer-sync.mjs';
import { normalizeLanHostBase } from '../../lan-host-subnet-discovery.mjs';
import {
  isLanSessionConfiguredForRest,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  promoteThisMacToLanHost,
  resolveLanShareBaseUrl,
  resolveLanTeamCodeForShare,
  ensureLanPairingForShare,
  buildShareJoinUrl,
  formatLanTicketExpiryLabel,
  mintLanPairingFromUi,
  updateLanPairingDisplay,
  exchangeLanJoinFromInvite,
  configureLanFromMobileJoin,
} from './transport.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import { bundledWardInviteUrl } from '../../clinical-settings.mjs';

export const LAN_INVITE_MOBILE_OPEN_KEY = 'rpc-lan-invite-mobile-open';
export const LAN_INVITE_SALA_OPEN_KEY = 'rpc-lan-invite-sala-open';

function canOfferMobileLanShare() {
  if (!isLanElectronDesktop()) return false;
  if (lanClient.connected) return true;
  return isLanSessionConfiguredForRest();
}

function resetLanToLocalHostFromUi(deps) {
  void promoteThisMacToLanHost({ skipToast: true }).then(function (ok) {
    if (!ok) return;
    deps.runtime().showToast('Esta Mac vuelve a ser el servidor del turno. Crea o únete a una sala.', 'success');
  });
}

function appendLanMobileSharerCard(deps, root) {
  if (!root || !deps.runtime().isMobileWeb()) return;
  var card = document.createElement('div');
  card.className = 'lan-connect-card lan-mobile-sharer-card';
  var who = deps.esc(mobileSharerDisplayLabel());
  card.innerHTML =
    '<div class="lan-connect-card-title">Turno compartido</div>' +
    '<p class="lan-connect-card-hint">Sincronizando con <strong>' +
    who +
    '</strong>. Este enlace copia su identidad en la red; no uses «Unirse» a sala como en el escritorio.</p>';
  root.appendChild(card);
}

function appendLanMobileJoinSection(deps, root) {
  if (!root || !deps.runtime().isMobileWeb()) return;
  var card = document.createElement('div');
  card.className = 'lan-connect-card lan-mobile-join-card';
  card.innerHTML =
    '<div class="lan-connect-card-title">Conectar al turno</div>' +
    '<p class="lan-connect-card-hint">Abre el <strong>enlace móvil</strong> que te compartieron (⇄ → invitación al turno) o pégalo aquí. Debe incluir el anfitrión y la identidad de quien lo compartió.</p>';
  var inputInvite = document.createElement('textarea');
  inputInvite.className = 'profile-input';
  inputInvite.setAttribute('data-lan-invite-input', '1');
  inputInvite.id = 'lan-input-invite-link';
  inputInvite.rows = 2;
  inputInvite.autocomplete = 'off';
  inputInvite.placeholder = 'http://192.168.x.x:3738/join/req_…';
  prefillBundledWardInviteInput(inputInvite);
  card.appendChild(inputInvite);
  var row = document.createElement('div');
  row.className = 'lan-connect-actions-row';
  row.style.marginTop = '8px';
  var btnJoin = document.createElement('button');
  btnJoin.type = 'button';
  btnJoin.className = 'btn-lan-primary';
  btnJoin.style.flex = '1';
  btnJoin.textContent = 'Conectar';
  btnJoin.setAttribute('data-lan-action', 'join-invite');
  row.appendChild(btnJoin);
  card.appendChild(row);
  root.insertBefore(card, root.firstChild);
}

function appendLanJoinOtherMacSection(root, opts) {
  opts = opts || {};
  if (!root || !isLanElectronDesktop()) return;

  var prominent = !isLanSessionConfiguredForRest();
  var container;
  if (prominent) {
    container = document.createElement('div');
    container.className =
      'lan-connect-card lan-connect-other-mac lan-connect-other-mac--prominent';
    var title = document.createElement('div');
    title.className = 'lan-connect-card-title';
    title.textContent = 'Conectar al anfitrión del turno';
    container.appendChild(title);
  } else {
    container = document.createElement('details');
    container.className = 'rpc-disclosure lan-connect-other-mac';
    if (opts.open) container.open = true;
    var sum = document.createElement('summary');
    sum.className =
      'rpc-disclosure__summary rpc-disclosure__summary--stacked lan-settings-card-summary';
    sum.innerHTML =
      '<span class="settings-card__title">Otra Mac del equipo</span>' +
      '<span class="settings-card__desc">Unirme con enlace de invitación</span>';
    container.appendChild(sum);
  }

  var inner = document.createElement('div');
  inner.className = prominent ? 'lan-connect-other-mac-body' : 'rpc-disclosure__body';
  var hint = document.createElement('p');
  hint.className = 'lan-connect-card-hint';
  hint.style.marginTop = prominent ? '4px' : '0';
  hint.innerHTML = prominent
    ? 'Pega el enlace <strong>Otra Mac del equipo</strong> que copiaste del anfitrión (<code>http://…/join/req_…</code>), luego pulsa <strong>Unirse con enlace</strong>.'
    : 'Pega el enlace que te compartieron. Esta R+ dejará de usar el servidor de <strong>esta</strong> Mac y se conectará a la otra.';
  inner.appendChild(hint);
  var inputInvite = document.createElement('textarea');
  inputInvite.className = 'profile-input';
  inputInvite.setAttribute('data-lan-invite-input', '1');
  inputInvite.id = 'lan-input-invite-link';
  inputInvite.rows = 2;
  inputInvite.autocomplete = 'off';
  inputInvite.placeholder = isLanSkipShiftPin()
    ? 'http://…/join/req_… o dirección http://10.0.57.65:3738'
    : 'http://…/join/req_…, PIN (6 dígitos), o dirección http://…:3738';
  inner.appendChild(inputInvite);
  var row = document.createElement('div');
  row.className = 'lan-connect-actions-row';
  row.style.marginTop = '8px';
  var btnJoin = document.createElement('button');
  btnJoin.type = 'button';
  btnJoin.className = prominent ? 'btn-lan-primary' : 'btn-lan-secondary';
  btnJoin.style.flex = '1';
  btnJoin.textContent = 'Unirse con enlace';
  btnJoin.setAttribute('data-lan-action', 'join-invite');
  row.appendChild(btnJoin);
  inner.appendChild(row);
  container.appendChild(inner);
  root.appendChild(container);
}

function appendLanBackToLocalHostSection(deps, root) {
  if (!root || !isLanElectronDesktop() || !isLanRemoteJoinMode() || !canLocalMacBeLanHost()) return;
  var row = document.createElement('div');
  row.className = 'lan-connect-actions-row';
  row.style.marginBottom = '12px';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-lan-secondary';
  btn.style.flex = '1';
  btn.textContent = 'Usar esta Mac como servidor del turno';
  btn.onclick = function () {
    resetLanToLocalHostFromUi(deps);
  };
  row.appendChild(btn);
  root.appendChild(row);
}

/**
 * @param {HTMLElement} root
 * @param {{ title: string, openKey: string, extraClass: string, fill: (body: HTMLElement) => void }} opts
 */
function appendLanInviteCollapsible(root, opts) {
  var details = document.createElement('details');
  details.className =
    'rpc-disclosure lan-invite-collapsible lan-hub-invite-card ' +
    String(opts.extraClass || '');
  try {
    details.open = sessionStorage.getItem(opts.openKey) === '1';
  } catch (_e) { void _e; }
  details.addEventListener('toggle', function () {
    try {
      sessionStorage.setItem(opts.openKey, details.open ? '1' : '0');
    } catch (_e) { void _e; }
  });
  var sum = document.createElement('summary');
  sum.className =
    'rpc-disclosure__summary rpc-disclosure__summary--stacked lan-settings-card-summary';
  sum.innerHTML =
    '<span class="settings-card__title">' + opts.title + '</span>' +
    (opts.subtitle ? '<span class="settings-card__desc">' + opts.subtitle + '</span>' : '');
  details.appendChild(sum);
  var body = document.createElement('div');
  body.className = 'rpc-disclosure__body lan-invite-collapsible-body';
  opts.fill(body);
  details.appendChild(body);
  root.appendChild(details);
}

function appendLanMobileInviteCard(deps, root) {
  appendLanInviteCollapsible(root, {
    title: 'iPad / R+ Móvil',
    subtitle: 'Emparejar dispositivo',
    openKey: LAN_INVITE_MOBILE_OPEN_KEY,
    extraClass: 'lan-invite-collapsible--mobile lan-hub-invite-card--mobile',
    fill: function (body) {
      var hint = document.createElement('p');
      hint.className = 'lan-connect-card-hint';
      hint.style.margin = '0 0 8px';
      hint.innerHTML =
        'Para que alguien use <strong>tu turno</strong> en el iPad (tu @usuario y pacientes). Enlace <strong>permanente</strong> para favoritos en Safari. <strong>No</strong> lo uses si debe entrar con su propia cuenta.';
      body.appendChild(hint);
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-lan-primary';
      copyBtn.style.width = '100%';
      copyBtn.textContent = 'Copiar enlace móvil';
      copyBtn.onclick = function () {
        void copyMobileLanLinkFromUi(deps);
      };
      body.appendChild(copyBtn);
      var genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.className = 'btn-lan-secondary';
      genBtn.style.width = '100%';
      genBtn.style.marginTop = '6px';
      genBtn.textContent = 'Generar y mostrar';
      genBtn.setAttribute('data-lan-action', 'mint-pairing-mobile');
      body.appendChild(genBtn);
      var pairingBox = document.createElement('div');
      pairingBox.id = 'lan-pairing-display-mobile';
      pairingBox.hidden = true;
      pairingBox.style.marginTop = '8px';
      pairingBox.style.fontSize = '12px';
      body.appendChild(pairingBox);
    },
  });
}

function appendLanSalaInviteCard(deps, root) {
  appendLanInviteCollapsible(root, {
    title: 'Otra Mac del equipo',
    openKey: LAN_INVITE_SALA_OPEN_KEY,
    extraClass: 'lan-invite-collapsible--sala lan-hub-invite-card--sala',
    fill: function (body) {
      var hint = document.createElement('p');
      hint.className = 'lan-connect-card-hint';
      hint.style.margin = '0 0 8px';
      hint.innerHTML =
        'Para que un compañero se conecte a la red y entre a la sala con <strong>su</strong> @usuario. El enlace <strong>no</strong> lleva tu identidad; después debe pulsar «Unirse» en su sala.';
      body.appendChild(hint);
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-lan-secondary';
      copyBtn.style.width = '100%';
      copyBtn.textContent = 'Copiar enlace de sala';
      copyBtn.onclick = function () {
        void copyLanInviteLinkFromUi(deps);
      };
      body.appendChild(copyBtn);
      var genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.className = 'btn-lan-secondary';
      genBtn.style.width = '100%';
      genBtn.style.marginTop = '6px';
      genBtn.textContent = 'Generar y mostrar';
      genBtn.setAttribute('data-lan-action', 'mint-pairing-sala');
      body.appendChild(genBtn);
      var pairingBox = document.createElement('div');
      pairingBox.id = 'lan-pairing-display-sala';
      pairingBox.hidden = true;
      pairingBox.style.marginTop = '8px';
      pairingBox.style.fontSize = '12px';
      body.appendChild(pairingBox);
    },
  });
}

function appendLanInviteShareCards(deps, root) {
  if (!root || !canOfferMobileLanShare()) return;
  appendLanMobileInviteCard(deps, root);
  appendLanSalaInviteCard(deps, root);
}

async function resolvePermanentMobileShareUrl() {
  var hostUrl = await resolveLanShareBaseUrl();
  var teamCode = String(await resolveLanTeamCodeForShare()).trim();
  if (!hostUrl || !teamCode) return '';
  return appendMobileSharerParamsToJoinUrl(
    await buildPermanentMobileJoinUrl(hostUrl, teamCode),
    activeLiveSyncRoomId
  );
}

async function mintMobileLanPairingFromUi(deps) {
  var link = await resolvePermanentMobileShareUrl();
  if (!link) {
    deps.runtime().showToast(
      'No hay anfitrión o código del equipo. Conéctate a la red del turno e inténtalo de nuevo.',
      'error'
    );
    return;
  }
  var root = document.getElementById('lan-connection-panel-root');
  updateLanPairingDisplay(root, {
    boxId: 'lan-pairing-display-mobile',
    displayUrl: link,
    permanent: true,
  });
  deps.runtime().showToast(
    'Enlace listo abajo. En el iPad ábrelo en Safari (verás la app cargar) y luego Añadir a pantalla de inicio. Si el acceso directo no sincroniza, borra el icono y repite desde este enlace.',
    'success'
  );
}

function mintSalaLanPairingFromUi() {
  return mintLanPairingFromUi({
    mobileHints: false,
    boxId: 'lan-pairing-display-sala',
    toastMsg: 'Enlace de sala listo abajo. También puedes usar «Copiar enlace de sala».',
  });
}

async function copyMobileLanLinkFromUi(deps, opts) {
  opts = opts || {};
  var silent = !!opts.silent;
  var link = await resolvePermanentMobileShareUrl();
  if (!link) {
    if (!silent) {
      deps.runtime().showToast(
        'Falta la dirección del anfitrión o el código del equipo. Conéctate al turno en ⇄ primero.',
        'error'
      );
    }
    return false;
  }
  var copied = await copyToClipboardSafe(link);
  if (copied) {
    if (!silent) {
      var roomHint = resolveMobilePairingRoomId(activeLiveSyncRoomId);
      var roomMsg = roomHint
        ? ''
        : ' Primero únete tú a una sala en ⇄ (Unirse) para que el iPad reciba pacientes.';
      deps.runtime().showToast(
        'Enlace móvil copiado. Abre /mobile/?token=… en Safari y luego Añadir a pantalla de inicio (así no se pierde el token).' +
          roomMsg,
        roomHint ? 'success' : 'warn'
      );
    }
    return true;
  }
  if (!silent) deps.runtime().showToast('No se pudo copiar al portapapeles.', 'error');
  return false;
}

async function copyLanInviteLinkFromUi(deps, opts) {
  opts = opts || {};
  var silent = !!opts.silent;
  var share;
  try {
    share = await ensureLanPairingForShare({ forceNew: true });
  } catch (e) {
    if (!silent) {
      if (e && e.code === 'no_host_url') {
        deps.runtime().showToast(
          'Falta la dirección del servidor (o no pudimos detectar la IP en esta computadora).',
          'error'
        );
      } else {
        deps.runtime().showToast('Genera primero un enlace / PIN o revisa el token del anfitrión.', 'error');
      }
    }
    return false;
  }
  var teamCode = String(await resolveLanTeamCodeForShare()).trim();
  var link = await buildShareJoinUrl(share.hostUrl, share.pairing.ticketId, teamCode);
  var copied = await copyToClipboardSafe(link);
  if (copied) {
    if (!silent) {
      var pinHint = share.pairing.pin ? ' PIN: ' + share.pairing.pin + '.' : '';
      var inviteExpiry = formatLanTicketExpiryLabel(share.pairing.expiresAt);
      deps.runtime().showToast(
        'Enlace de sala copiado (sin tu identidad).' +
          pinHint +
          (inviteExpiry ? ' Válido hasta ' + inviteExpiry + '.' : ''),
        'success'
      );
    }
    return true;
  }
  if (!silent) deps.runtime().showToast('No se pudo copiar al portapapeles.', 'error');
  return false;
}

/** Read invite paste from the field the user actually used (avoids duplicate-id mismatch). */
function readLanInviteInputValue(nearEl) {
  if (nearEl && nearEl.closest) {
    var card = nearEl.closest(
      '.lan-connect-card, .lan-connect-other-mac, .lan-hub-status-card, .lan-mobile-join-card'
    );
    if (card) {
      var local = card.querySelector('[data-lan-invite-input]');
      if (local) return String(local.value || '').trim();
    }
  }
  var root = document.getElementById('lan-connection-panel-root');
  if (!root) {
    var legacy = document.getElementById('lan-input-invite-link');
    return String(legacy && legacy.value ? legacy.value : '').trim();
  }
  var inputs = root.querySelectorAll('[data-lan-invite-input]');
  for (var i = 0; i < inputs.length; i += 1) {
    var filled = String(inputs[i].value || '').trim();
    if (filled) return filled;
  }
  return inputs.length ? String(inputs[0].value || '').trim() : '';
}

function runShiftPinConnectFromUi(deps, fromBtn, opts) {
  if (fromBtn instanceof HTMLButtonElement) {
    fromBtn.disabled = true;
    fromBtn.textContent = 'Conectando…';
  }
  void import('../../lan-shift-pin-connect.mjs')
    .then(function (m) {
      return m.tryEasyLanShiftPinConnect(
        Object.assign({ force: true }, opts || {})
      );
    })
    .then(function (result) {
      if (result && result.ok) {
        deps.renderLanPanel({ force: true });
        return;
      }
      var msg =
        result && result.reason === 'invalid_pin'
          ? 'PIN incorrecto para esa dirección. Pide el PIN actual al anfitrión.'
          : result && result.reason === 'host_unreachable'
            ? 'No hay R+ en esa dirección. Verifica la URL y que el anfitrión tenga R+ abierto.'
            : 'No encontramos el turno con ese PIN. Revisa el Wi‑Fi clínico o pide otro PIN.';
      deps.runtime().showToast(msg, 'error');
    })
    .finally(function () {
      if (fromBtn instanceof HTMLButtonElement) {
        fromBtn.disabled = false;
        fromBtn.textContent = 'Unirse con enlace';
      }
    });
}

function joinFromBareHost(deps, fromBtn, parsed) {
  prefillLanShiftPinHostUrl(parsed.hostUrl);
  var wardPin =
    String(parsed.shiftPin || '').trim() ||
    (typeof storage.getLanShiftPin === 'function' ? storage.getLanShiftPin() : '');
  if (isLanSkipShiftPin()) {
    runShiftPinConnectFromUi(deps, fromBtn, {
      shiftPin: wardPin || undefined,
      hostUrl: parsed.hostUrl,
    });
    return true;
  }
  if (!/^\d{6}$/.test(wardPin)) {
    deps.runtime().showToast(
      'Dirección del anfitrión reconocida. Ingresa el PIN del turno (6 dígitos) y pulsa Conectar.',
      'info'
    );
    focusLanShiftPinInput();
    return true;
  }
  runShiftPinConnectFromUi(deps, fromBtn, { shiftPin: wardPin, hostUrl: parsed.hostUrl });
  return true;
}

function joinFromMobileTeamCode(raw, parsed) {
  var mobileJoin = parseLanJoinQuery(raw.includes('?') ? raw.slice(raw.indexOf('?')) : '', parsed.hostUrl);
  configureLanFromMobileJoin(parsed.hostUrl, String(parsed.teamCode || '').trim(), mobileJoin.roomId || parsed.roomId);
  return true;
}

function resolveInviteHostUrl(parsed) {
  var hostUrl = String(parsed.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (hostUrl) return hostUrl;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  return String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
}

function joinFromTicket(deps, fromBtn, parsed, raw) {
  var hostUrl = resolveInviteHostUrl(parsed);
  if (!hostUrl) {
    deps.runtime().showToast(
      'Pega el enlace completo (http://…/join/req_…) con la dirección del anfitrión.',
      'error'
    );
    return true;
  }
  if (fromBtn instanceof HTMLButtonElement) {
    fromBtn.disabled = true;
    fromBtn.textContent = 'Conectando…';
  }
  void exchangeLanJoinFromInvite(hostUrl, String(parsed.ticketId || '').trim(), parsed.roomId, raw).finally(
    function () {
      if (fromBtn instanceof HTMLButtonElement) {
        fromBtn.disabled = false;
        fromBtn.textContent = 'Unirse con enlace';
      }
    }
  );
  return true;
}

function joinLanFromInviteUi(deps, fromBtn) {
  var raw = readLanInviteInputValue(fromBtn);
  if (!raw) {
    deps.runtime().showToast('Pega el enlace de invitación que te envió el anfitrión.', 'error');
    return;
  }
  if (/^\d{6}$/.test(raw)) {
    runShiftPinConnectFromUi(deps, fromBtn, { shiftPin: raw });
    return;
  }
  var parsed = parseLanInviteInput(raw);
  if (parsed.bareHost && parsed.hostUrl && joinFromBareHost(deps, fromBtn, parsed)) return;
  if (parsed.legacyInvite) {
    deps.runtime().showToast(
      'Este enlace ya no es válido. Pide al anfitrión un nuevo enlace o PIN.',
      'error'
    );
    return;
  }
  if (parsed.teamCode && parsed.hostUrl && joinFromMobileTeamCode(raw, parsed)) return;
  if (parsed.ticketId && joinFromTicket(deps, fromBtn, parsed, raw)) return;
  deps.runtime().showToast(
    'No reconocimos un enlace válido. Pide al anfitrión un enlace /join/req_… o el PIN del turno.',
    'error'
  );
}

function focusLanShiftPinInput() {
  function tryFocus(attempt) {
    var input = document.getElementById('lan-input-shift-pin');
    if (input) {
      input.focus();
      if (typeof input.select === 'function') input.select();
      return true;
    }
    if (attempt < 10) {
      window.setTimeout(function () {
        tryFocus(attempt + 1);
      }, 80);
    }
    return false;
  }
  return tryFocus(0);
}

function prefillBundledWardInviteInput(input) {
  if (!input || String(input.value || '').trim()) return;
  var bundled = String(bundledWardInviteUrl() || '').trim();
  if (bundled) input.value = bundled;
}

function prefillLanShiftPinHostUrl(hostUrl) {
  var url = normalizeLanHostBase(String(hostUrl || '').trim());
  if (!url) return false;
  var input = document.getElementById('lan-input-host-url-ward');
  if (input) {
    input.value = url;
    return true;
  }
  return false;
}

/** @param {{ runtime: () => object, esc: (s: string) => string, renderLanPanel: (opts?: object) => void }} deps */
export function createPanelInviteJoin(deps) {
  return {
    canOfferMobileLanShare,
    appendLanMobileSharerCard: function (root) {
      return appendLanMobileSharerCard(deps, root);
    },
    appendLanMobileJoinSection: function (root) {
      return appendLanMobileJoinSection(deps, root);
    },
    appendLanJoinOtherMacSection,
    appendLanBackToLocalHostSection: function (root) {
      return appendLanBackToLocalHostSection(deps, root);
    },
    appendLanInviteShareCards: function (root) {
      return appendLanInviteShareCards(deps, root);
    },
    mintMobileLanPairingFromUi: function () {
      return mintMobileLanPairingFromUi(deps);
    },
    mintSalaLanPairingFromUi,
    copyMobileLanLinkFromUi: function (opts) {
      return copyMobileLanLinkFromUi(deps, opts);
    },
    copyLanInviteLinkFromUi: function (opts) {
      return copyLanInviteLinkFromUi(deps, opts);
    },
    readLanInviteInputValue,
    joinLanFromInviteUi: function (fromBtn) {
      return joinLanFromInviteUi(deps, fromBtn);
    },
    focusLanShiftPinInput,
    prefillLanShiftPinHostUrl,
    prefillBundledWardInviteInput,
  };
}
