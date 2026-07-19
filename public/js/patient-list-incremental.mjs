/**
 * Incremental sidebar patient list updates (LAN sync — no full list flash).
 */

import { patientCardDisplayKey } from './patient-list-display-key.mjs';

export { patientCardDisplayKey };

/** @param {object[]} filtered */
export function buildPatientListZones(filtered) {
  return {
    pinned: filtered.filter((p) => p.pinned && !p.archived),
    active: filtered.filter((p) => !p.pinned && !p.archived),
    archived: filtered.filter((p) => !!p.archived),
  };
}

/** @param {{ pinned: object[], active: object[], archived: object[] }} zones @param {boolean} archivedCollapsed */
export function buildRondaNavIds(zones) {
  const out = [];
  zones.pinned.forEach((p) => out.push(String(p.id)));
  zones.active.forEach((p) => out.push(String(p.id)));
  zones.archived.forEach((p) => out.push(String(p.id)));
  return out;
}

function structureSignature(zones, archivedCollapsed) {
  const parts = [];
  if (zones.pinned.length) parts.push(`p:${zoneIds(zones.pinned)}`);
  if (zones.active.length) parts.push(`a:${zoneIds(zones.active)}`);
  if (zones.archived.length) parts.push(`at:${archivedCollapsed ? 1 : 0}:${zoneIds(zones.archived)}`);
  return parts.join('|');
}

function zoneIds(rows) {
  return rows.map((p) => String(p.id || '')).join(',');
}

/** @param {HTMLElement} zoneEl */
function cardIds(zoneEl) {
  return Array.from(zoneEl.querySelectorAll('.patient-card[data-patient-id]')).map((el) =>
    String(el.getAttribute('data-patient-id') || '')
  );
}

/** @param {HTMLElement} list @param {boolean} archivedCollapsed */
export function readVirtualPatientListStructure(list, _archivedCollapsed) {
  const parts = [];
  const pinned = list.querySelector('.patient-sort-zone[data-patient-zone="pinned"]');
  if (pinned) parts.push(`p:${cardIds(pinned).join(',')}`);
  const active = list.querySelector('.patient-sort-zone--virtual-active[data-patient-zone="active"]');
  if (active) parts.push(`a:${active.getAttribute('data-active-ids') || ''}`);
  const archived = list.querySelector('.patient-sort-zone[data-patient-zone="archived"]');
  const toggle = list.querySelector('.patient-list-section-toggle');
  if (toggle || archived) {
    const collapsed = toggle && !archived ? 1 : 0;
    parts.push(`at:${collapsed}:${archived ? cardIds(archived).join(',') : ''}`);
  }
  return parts.join('|');
}

/** @param {HTMLElement} list */
function readStructureSignature(list) {
  const parts = [];
  const pinned = list.querySelector('.patient-sort-zone[data-patient-zone="pinned"]');
  if (pinned) parts.push(`p:${cardIds(pinned).join(',')}`);
  const active = list.querySelector('.patient-sort-zone[data-patient-zone="active"]');
  if (active) parts.push(`a:${cardIds(active).join(',')}`);
  const archived = list.querySelector('.patient-sort-zone[data-patient-zone="archived"]');
  const toggle = list.querySelector('.patient-list-section-toggle');
  if (toggle || archived) {
    const collapsed = toggle && !archived ? 1 : 0;
    parts.push(`at:${collapsed}:${archived ? cardIds(archived).join(',') : ''}`);
  }
  return parts.join('|');
}

function htmlToElement(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  return wrap.firstElementChild;
}

/** @param {{ pinned: object[], active: object[], archived: object[] }} zones @param {boolean} archivedCollapsed */
export function virtualPatientListStructureSignature(zones, archivedCollapsed) {
  return structureSignature(zones, archivedCollapsed);
}

/** @param {HTMLElement} zoneEl @param {object[]} rows @param {(p: object) => string} renderCard @param {object} ctx */
export function syncZoneCards(zoneEl, rows, renderCard, ctx) {
  const existing = new Map();
  zoneEl.querySelectorAll('.patient-card[data-patient-id]').forEach((el) => {
    existing.set(String(el.getAttribute('data-patient-id') || ''), el);
  });
  const frag = document.createDocumentFragment();
  rows.forEach((p) => {
    const id = String(p.id || '');
    const key = patientCardDisplayKey(p, ctx);
    let el = existing.get(id);
    if (el && el.getAttribute('data-display-key') === key) {
      existing.delete(id);
      frag.appendChild(el);
      return;
    }
    if (el) el.remove();
    const next = htmlToElement(renderCard(p));
    if (!next) return;
    next.setAttribute('data-display-key', key);
    frag.appendChild(next);
  });
  zoneEl.replaceChildren(frag);
}

/** @param {HTMLElement} list @param {{ pinned: object[], active: object[], archived: object[] }} zones */
export function syncSectionCounts(list, zones) {
  const pinnedCount = list.querySelector(
    '.patient-list-section-label--pinned .patient-list-section-count'
  );
  if (pinnedCount) pinnedCount.textContent = String(zones.pinned.length);
  const activeLabel = list.querySelector(
    '.patient-list-section-label:not(.patient-list-section-label--pinned) .patient-list-section-count'
  );
  if (activeLabel) activeLabel.textContent = String(zones.active.length);
  const archivedToggle = list.querySelector('.patient-list-section-toggle');
  if (archivedToggle && zones.archived.length) {
    archivedToggle.innerHTML = `Archivados <span>(${zones.archived.length})</span> <span>${archivedToggle.getAttribute('aria-expanded') === 'true' ? '▼' : '▶'}</span>`;
  }
}

/**
 * Patch cards in place when list structure is unchanged.
 * @param {HTMLElement} list
 * @param {{ zones: object, archivedCollapsed: boolean, patientSearchFilter?: string, renderCard: (p: object) => string, ctx: object, onRondaNav?: (zones: object) => void }} options
 * @returns {boolean}
 */
export function trySilentPatientListPatch(list, options) {
  if (!list || options.patientSearchFilter) return false;
  if (!list.querySelector('.patient-card[data-patient-id]')) return false;

  const zones = options.zones;
  const desired = structureSignature(zones, options.archivedCollapsed);
  const current = readStructureSignature(list);
  if (desired !== current) return false;

  syncSectionCounts(list, zones);
  const ctx = options.ctx || {};
  for (const zoneName of ['pinned', 'active', 'archived']) {
    const zoneEl = list.querySelector(`.patient-sort-zone[data-patient-zone="${zoneName}"]`);
    if (!zoneEl || !zones[zoneName].length) continue;
    syncZoneCards(zoneEl, zones[zoneName], options.renderCard, ctx);
  }
  if (typeof options.onRondaNav === 'function') options.onRondaNav(zones);
  return true;
}

/**
 * Incremental DOM sync when structure changed (add/remove/reorder) without wiping the whole list.
 * @param {HTMLElement} list
 * @param {{ zones: object, archivedCollapsed: boolean, isRonda: boolean, virtualizeActive?: boolean, renderCard: (p: object) => string, renderPinnedLabel: () => string, renderActiveLabel: () => string, renderArchivedToggle: (collapsed: boolean, count: number) => string, ctx: object, onRondaNav?: (zones: object) => void }} options
 * @returns {boolean}
 */
function removeNonStructuralPatientListNodes(list) {
  list.querySelectorAll(':scope > *').forEach((node) => {
    if (
      node instanceof HTMLElement &&
      (node.classList.contains('patient-list-section-label') ||
        node.classList.contains('patient-sort-zone') ||
        node.classList.contains('patient-list-section-toggle'))
    ) {
      return;
    }
    node.remove();
  });
}

function appendPatientZoneSection(frag, labelHtml, zoneName, zoneClass) {
  frag.appendChild(htmlToElement(labelHtml));
  const zone = document.createElement('div');
  zone.className = zoneClass || 'patient-sort-zone';
  zone.setAttribute('data-patient-zone', zoneName);
  frag.appendChild(zone);
}

function buildIncrementalPatientListFragment(zones, options) {
  const frag = document.createDocumentFragment();
  if (zones.pinned.length) {
    appendPatientZoneSection(frag, options.renderPinnedLabel(), 'pinned');
  }
  if (zones.active.length) {
    const zoneClass = options.virtualizeActive
      ? 'patient-sort-zone patient-sort-zone--virtual-active'
      : 'patient-sort-zone';
    appendPatientZoneSection(frag, options.renderActiveLabel(), 'active', zoneClass);
  }
  if (zones.archived.length) {
    frag.appendChild(
      htmlToElement(options.renderArchivedToggle(options.archivedCollapsed, zones.archived.length))
    );
    if (!options.archivedCollapsed) {
      appendPatientZoneSection(frag, '', 'archived');
    }
  }
  return frag;
}

export function updatePatientListDomIncremental(list, options) {
  if (!list) return false;
  const zones = options.zones;
  const hasPatients = zones.pinned.length || zones.active.length || zones.archived.length;
  if (!hasPatients) return false;

  removeNonStructuralPatientListNodes(list);

  const ctx = options.ctx || {};
  const frag = buildIncrementalPatientListFragment(zones, options);

  const keep = Array.from(
    list.querySelectorAll(
      '.patient-list-section-label, .patient-sort-zone, .patient-list-section-toggle'
    )
  );
  keep.forEach((el) => el.remove());
  list.appendChild(frag);

  for (const zoneName of ['pinned', 'active', 'archived']) {
    const zoneEl = list.querySelector(`.patient-sort-zone[data-patient-zone="${zoneName}"]`);
    if (!zoneEl || !zones[zoneName].length) continue;
    if (zoneName === 'active' && options.virtualizeActive) continue;
    syncZoneCards(zoneEl, zones[zoneName], options.renderCard, ctx);
  }

  list.classList.toggle('patient-list--ronda', !!options.isRonda);
  if (typeof options.onRondaNav === 'function') options.onRondaNav(zones);
  return true;
}
