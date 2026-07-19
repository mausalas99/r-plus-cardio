import { copyInternoQrImage, downloadInternoQrPng } from '../interno-qr-render.mjs';
import { CLINICAL_SALA_VALUES, clinicalSalaRoomSlug } from '../../../lib/clinical-salas.mjs';

const SALA_DEFS = CLINICAL_SALA_VALUES.map((key) => ({
  key,
  slug: clinicalSalaRoomSlug(key),
}));

/** @param {string} hostBase */
export function normalizeInternoHostBase(hostBase) {
  const base = String(hostBase || '').trim().replace(/\/+$/, '');
  return base || 'http://127.0.0.1:3738';
}

export function isLocalOnlyInternoHost(base) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(String(base || '').trim());
}

/** @param {string} sala @param {string} slug @param {string} token @param {string} hostBase */
export function buildInternoQrUrl(sala, slug, token, hostBase) {
  const host = normalizeInternoHostBase(hostBase);
  return `${host}/interno/${slug}?t=${encodeURIComponent(token)}&sala=${encodeURIComponent(sala)}`;
}

/** @param {HTMLElement} card @param {string} hostBase @param {() => void} onRefresh */
export function renderInternoQrLanBanner(card, hostBase, onRefresh) {
  card.querySelectorAll('.interno-sala-block, .lan-connect-card-hint, .interno-qr-lan-warn').forEach((el) => el.remove());
  if (isLocalOnlyInternoHost(hostBase)) {
    const warn = document.createElement('div');
    warn.className = 'interno-qr-lan-warn lan-connect-card-hint';
    warn.style.cssText = 'margin:0 0 10px;padding:8px 10px;border-radius:8px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;';
    warn.innerHTML =
      '<strong>Sin IP de red local.</strong> Conecta la Mac a Wi‑Fi/Ethernet y pulsa «Actualizar IP». ' +
      'El celular no puede usar 127.0.0.1.';
    card.appendChild(warn);
    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'btn-lan-secondary';
    refreshBtn.style.cssText = 'font-size:12px;margin-bottom:8px;';
    refreshBtn.textContent = 'Actualizar IP';
    refreshBtn.onclick = onRefresh;
    card.appendChild(refreshBtn);
    return;
  }
  const ok = document.createElement('p');
  ok.className = 'lan-connect-card-hint interno-qr-lan-warn';
  ok.textContent = `Host LAN: ${hostBase}`;
  card.appendChild(ok);
}

/**
 * @param {object} def
 * @param {object} row
 * @param {string} hostBase
 * @param {object} api
 * @param {string} userId
 * @param {(msg: string, kind?: string) => void} showToast
 * @param {() => Promise<void>} rerender
 */
export function buildInternoSalaBlock(def, row, hostBase, api, userId, showToast, rerender) {
  const active = row.is_active === 1;
  const token = String(row.access_token || '');
  const url = token ? buildInternoQrUrl(def.key, def.slug, token, hostBase) : '';
  const block = document.createElement('div');
  block.className = 'interno-sala-block';
  block.style.marginTop = '12px';
  block.style.paddingTop = '12px';
  block.style.borderTop = '1px solid var(--border, rgba(128,128,128,0.25))';
  block.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <strong>${def.key}</strong>
    <span class="lan-connect-card-hint" style="margin:0">${active ? 'Activo' : 'Inactivo'}</span>
  </div>`;
  if (url) {
    const link = document.createElement('p');
    link.className = 'lan-connect-card-hint';
    link.style.wordBreak = 'break-all';
    link.style.fontSize = '11px';
    link.textContent = url;
    block.appendChild(link);
  }
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.flexWrap = 'wrap';
  btnRow.style.gap = '6px';
  btnRow.style.marginTop = '6px';
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-lan-secondary';
    b.style.fontSize = '12px';
    b.textContent = label;
    b.onclick = () => void fn();
    return b;
  };
  btnRow.appendChild(mkBtn(active ? 'Desactivar' : 'Activar', async () => {
    const r = await api.dbInternoAccessSetActive({ userId, sala: def.key, active: !active });
    if (r?.ok) {
      showToast(active ? 'Acceso interno desactivado' : 'Acceso interno activado', 'success');
      await rerender();
    } else showToast(r?.error || 'Error', 'error');
  }));
  btnRow.appendChild(mkBtn('Regenerar token', async () => {
    if (!confirm(`¿Regenerar QR de ${def.key}? El enlace anterior dejará de funcionar.`)) return;
    const r = await api.dbInternoAccessRotate({ userId, sala: def.key });
    if (r?.ok) {
      showToast('Token regenerado — copia el QR de nuevo', 'success');
      await rerender();
    } else showToast(r?.error || 'Error', 'error');
  }));
  if (url) {
    btnRow.appendChild(mkBtn('Copiar enlace', async () => {
      if (isLocalOnlyInternoHost(hostBase)) {
        showToast('Primero obtén la IP LAN (Actualizar IP)', 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace copiado', 'success');
      } catch {
        showToast('No se pudo copiar', 'error');
      }
    }));
    btnRow.appendChild(mkBtn('Copiar QR', () => {
      if (isLocalOnlyInternoHost(hostBase)) {
        showToast('Primero obtén la IP LAN (Actualizar IP)', 'error');
        return;
      }
      void copyInternoQrImage(url, showToast);
    }));
    btnRow.appendChild(mkBtn('Descargar QR', () => {
      if (isLocalOnlyInternoHost(hostBase)) {
        showToast('Primero obtén la IP LAN (Actualizar IP)', 'error');
        return;
      }
      const slug = def.slug || def.key.toLowerCase().replace(/\s+/g, '-');
      downloadInternoQrPng(url, `qr-interno-${slug}.png`);
      showToast('QR descargado en alta resolución.', 'success');
    }));
  }
  block.appendChild(btnRow);
  return block;
}

export { SALA_DEFS };
