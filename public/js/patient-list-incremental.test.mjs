import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  patientCardDisplayKey,
  buildPatientListZones,
  trySilentPatientListPatch,
  updatePatientListDomIncremental,
} from './patient-list-incremental.mjs';

describe('patient-list-incremental', () => {
  it('patientCardDisplayKey changes when visible fields change', () => {
    const ctx = { activeId: 'p1', isRonda: false };
    const a = patientCardDisplayKey({ id: 'p1', nombre: 'A', cuarto: '1', cama: '2', servicio: 'S' }, ctx);
    const b = patientCardDisplayKey({ id: 'p1', nombre: 'B', cuarto: '1', cama: '2', servicio: 'S' }, ctx);
    assert.notEqual(a, b);
  });

  it('buildPatientListZones buckets pinned, active, archived', () => {
    const zones = buildPatientListZones([
      { id: 'a', pinned: true, archived: false },
      { id: 'b', pinned: false, archived: false },
      { id: 'c', pinned: false, archived: true },
    ]);
    assert.equal(zones.pinned.length, 1);
    assert.equal(zones.active.length, 1);
    assert.equal(zones.archived.length, 1);
  });

  it('trySilentPatientListPatch updates only changed card text', () => {
    if (typeof document === 'undefined') return;
    const list = document.createElement('div');
    list.innerHTML =
      '<div class="patient-list-section-label patient-list-section-label--pinned" role="group"><span class="patient-list-section-count">1</span></div>' +
      '<div class="patient-sort-zone" data-patient-zone="pinned">' +
      '<div class="patient-card" data-patient-id="p1" data-display-key="old"><div class="p-name">Old</div></div>' +
      '</div>';

    const zones = buildPatientListZones([
      { id: 'p1', nombre: 'New', pinned: true, archived: false, cuarto: '1', cama: '2', servicio: 'S' },
    ]);
    const renderCard = (p) =>
      `<div class="patient-card" data-patient-id="${p.id}"><div class="p-name">${p.nombre}</div></div>`;

    const ok = trySilentPatientListPatch(list, {
      zones,
      archivedCollapsed: true,
      renderCard,
      ctx: { activeId: null, isRonda: false },
    });
    assert.equal(ok, true);
    assert.match(list.textContent || '', /New/);
    assert.doesNotMatch(list.textContent || '', /Old/);
  });

  it('updatePatientListDomIncremental adds a card without wiping unrelated zones', () => {
    if (typeof document === 'undefined') return;
    const list = document.createElement('div');
    list.innerHTML =
      '<div class="patient-list-section-label" role="group">Pacientes <span class="patient-list-section-count">1</span></div>' +
      '<div class="patient-sort-zone" data-patient-zone="active">' +
      '<div class="patient-card" data-patient-id="p1" data-display-key="k1"><div class="p-name">One</div></div>' +
      '</div>';

    const zones = buildPatientListZones([
      { id: 'p1', nombre: 'One', pinned: false, archived: false, cuarto: '1', cama: '1', servicio: 'S' },
      { id: 'p2', nombre: 'Two', pinned: false, archived: false, cuarto: '2', cama: '2', servicio: 'S' },
    ]);

    const ok = updatePatientListDomIncremental(list, {
      zones,
      archivedCollapsed: true,
      isRonda: false,
      renderCard: (p) =>
        `<div class="patient-card" data-patient-id="${p.id}"><div class="p-name">${p.nombre}</div></div>`,
      renderPinnedLabel: () => '<div class="patient-list-section-label patient-list-section-label--pinned"></div>',
      renderActiveLabel: () =>
        '<div class="patient-list-section-label" role="group">Pacientes <span class="patient-list-section-count">2</span></div>',
      renderArchivedToggle: () => '<button type="button" class="patient-list-section-toggle"></button>',
      ctx: { activeId: null, isRonda: false },
    });

    assert.equal(ok, true);
    assert.equal(list.querySelectorAll('.patient-card').length, 2);
    assert.match(list.textContent || '', /Two/);
  });
});
