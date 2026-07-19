import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { serializePendientesJson } from '../../../lib/entrega/entrega-pendientes.mjs';
import { defaultHandoffContext } from '../../../lib/entrega/entrega-handoff-context.mjs';
import {
  calcVitalsBanner,
  filterR4FollowUpPinPatients,
  R4_FOLLOWUP_PIN_LABEL,
  UnifiedPatientGridBoard,
} from './unified-patient-grid-board.mjs';

describe('calcVitalsBanner', () => {
  it('returns Sin signos for None frequency', () => {
    const r = calcVitalsBanner(new Date().toISOString(), 'None');
    assert.match(r.str, /Sin signos/);
    assert.equal(r.cls, 'nominal-gray');
  });

  it('returns RETRASADO when interval elapsed', () => {
    const past = new Date(Date.now() - 5 * 3600000).toISOString();
    const r = calcVitalsBanner(past, '4h');
    assert.equal(r.str, 'Signos vencidos');
    assert.equal(r.cls, 'breached');
  });

  it('returns warning when within 15 minutes of due', () => {
    const last = new Date(Date.now() - (3600000 - 10 * 60000)).toISOString();
    const r = calcVitalsBanner(last, '1h');
    assert.equal(r.cls, 'warning');
  });
});

describe('UnifiedPatientGridBoard', () => {
  /** @type {HTMLElement|null} */
  let host;

  beforeEach(() => {
    if (typeof document === 'undefined') return;
    host = document.createElement('div');
    host.id = 'test-guardia-grid';
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
  });

  it('sorts critical patients first', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    const guardias = new Map([
      ['p1', { is_critical: 0 }],
      ['p2', { is_critical: 1 }],
    ]);
    board.drawCensusGrid(
      [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' },
      ],
      guardias
    );
    const chips = host.querySelectorAll('.patient-chip-card');
    assert.equal(chips.length, 2);
    assert.equal(chips[0].getAttribute('data-patient-id'), 'p2');
  });

  it('sorts by bed within the same priority tier', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid(
      [
        { id: 'p3', name: 'C', cuarto: '12', cama: '1' },
        { id: 'p1', name: 'A', cuarto: '3', cama: '1' },
        { id: 'p2', name: 'B', cuarto: '8', cama: '1' },
      ],
      new Map()
    );
    const chips = host.querySelectorAll('.patient-chip-card');
    assert.deepEqual(
      [...chips].map((c) => c.getAttribute('data-patient-id')),
      ['p1', 'p2', 'p3']
    );
  });

  it('filterR4FollowUpPinPatients keeps active Follow-up rows only', () => {
    const rows = filterR4FollowUpPinPatients([
      { id: 'a', interconsult_type: 'Follow-up', interconsult_status: 'Active' },
      { id: 'b', interconsult_type: 'Follow-up', interconsult_status: 'Resolved' },
      { id: 'c', interconsult_type: 'None', interconsult_status: 'Pending' },
      { id: 'd', interconsult_type: 'Follow-up', interconsult_status: 'Pending' },
    ]);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['a', 'd']
    );
  });

  it('renders R4 Follow-up pin divider before sector dividers', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid(
      [
        {
          id: 'fu1',
          name: 'Follow',
          interconsult_type: 'Follow-up',
          interconsult_status: 'Active',
          service: 'Sala A',
        },
        { id: 'p1', name: 'A', service: 'Sala A' },
        { id: 'p2', name: 'B', service: 'Eme' },
      ],
      new Map(),
      'R4'
    );
    const dividers = host.querySelectorAll('.r4-section-divider');
    assert.equal(dividers.length, 3);
    assert.equal(dividers[0].textContent, R4_FOLLOWUP_PIN_LABEL);
    assert.equal(dividers[1].textContent, 'Sala A');
    assert.equal(dividers[2].textContent, 'Eme');
    const chips = host.querySelectorAll('.patient-chip-card');
    assert.equal(chips.length, 3);
    assert.equal(chips[0].getAttribute('data-patient-id'), 'fu1');
  });

  it('renders R4 sector dividers', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid(
      [
        { id: 'p1', name: 'A', service: 'Sala A' },
        { id: 'p2', name: 'B', service: 'Eme' },
      ],
      new Map(),
      'R4'
    );
    const dividers = host.querySelectorAll('.r4-section-divider');
    assert.equal(dividers.length, 2);
    assert.equal(dividers[0].textContent, 'Sala A');
    assert.equal(dividers[1].textContent, 'Eme');
  });

  it('renders R4 patients with servicio Sala and area letter', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid(
      [
        { id: 'p1', name: 'A', service: 'Sala', sub_area: 'A' },
        { id: 'p2', name: 'B', service: 'Sala', sub_area: 'B' },
        { id: 'p3', name: 'C', service: 'Torre HU' },
      ],
      new Map(),
      'R4'
    );
    const dividers = host.querySelectorAll('.r4-section-divider');
    assert.equal(dividers.length, 3);
    assert.equal(dividers[0].textContent, 'Sala A');
    assert.equal(dividers[1].textContent, 'Sala B');
    assert.equal(dividers[2].textContent, 'Torre HU');
    assert.equal(host.querySelectorAll('.patient-chip-card').length, 3);
  });

  it('renders entrega marker symbols CR NF SH without emoji', () => {
    if (typeof document === 'undefined') return;
    const handoff = defaultHandoffContext();
    handoff.signedRefusal = true;
    handoff.show = true;
    const json = serializePendientesJson({ version: 2, handoffContext: handoff, items: [] });
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid(
      [
        {
          id: 'p1',
          name: 'Test',
          entregaMarkers: ['critico', 'negativas', 'show'],
        },
      ],
      new Map([['p1', { is_critical: 1, pendientes_json: json }]])
    );
    const symbols = host.querySelectorAll('.patient-chip-symbol');
    assert.equal(symbols.length, 3);
    assert.equal(symbols[0].textContent, 'CR');
    assert.equal(symbols[1].textContent, 'NF');
    assert.equal(symbols[2].textContent, 'SH');
  });

  it('always renders meta row for uniform chip layout', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid([{ id: 'p1', name: 'WENDY BERENICE ORTIZ RODRIGUEZ' }], new Map());
    assert.ok(host.classList.contains('patient-chips-grid--guardia'));
    const badges = host.querySelector('.patient-chip-badges');
    assert.ok(badges);
    assert.equal(badges.querySelectorAll('.patient-chip-symbol').length, 0);
    assert.ok(host.querySelector('.patient-chip-vitals'));
  });

  it('shows DNR badge when negativa_maniobras_firmada is set', () => {
    if (typeof document === 'undefined') return;
    const board = new UnifiedPatientGridBoard('test-guardia-grid');
    board.drawCensusGrid([{ id: 'p1', name: 'X', negativa_maniobras_firmada: 1 }], new Map());
    assert.ok(host.querySelector('.dnr-badge'));
  });

  it('HANDOFF context invokes entrega callback instead of selectPatient', () => {
    let entregaCalled = false;
    const board = new UnifiedPatientGridBoard('test-guardia-grid', 'HANDOFF');
    board.onChipClick = (id) => {
      entregaCalled = id === 'p1';
    };
    const originalSelect = globalThis.selectPatient;
    globalThis.selectPatient = () => {
      throw new Error('selectPatient should not run in HANDOFF');
    };
    try {
      board.handleChipClick('p1');
      assert.equal(entregaCalled, true);
    } finally {
      if (originalSelect === undefined) delete globalThis.selectPatient;
      else globalThis.selectPatient = originalSelect;
    }
  });

  it('GUARDIA context calls selectPatient when available', () => {
    const board = new UnifiedPatientGridBoard('test-guardia-grid', 'GUARDIA');
    let selected = null;
    const originalSelect = globalThis.selectPatient;
    globalThis.selectPatient = (id) => {
      selected = id;
    };
    try {
      board.handleChipClick('p9');
      assert.equal(selected, 'p9');
    } finally {
      if (originalSelect === undefined) delete globalThis.selectPatient;
      else globalThis.selectPatient = originalSelect;
    }
  });

  it('GUARDIA context with chipOpensEntrega invokes entrega callback', () => {
    let entregaCalled = false;
    const board = new UnifiedPatientGridBoard('test-guardia-grid', 'GUARDIA');
    board.chipOpensEntrega = true;
    board.onChipClick = (id) => {
      entregaCalled = id === 'p1';
    };
    const originalSelect = globalThis.selectPatient;
    globalThis.selectPatient = () => {
      throw new Error('selectPatient should not run when chipOpensEntrega');
    };
    try {
      board.handleChipClick('p1');
      assert.equal(entregaCalled, true);
    } finally {
      if (originalSelect === undefined) delete globalThis.selectPatient;
      else globalThis.selectPatient = originalSelect;
    }
  });

  it('GUARDIA context with chipGuardiaPatientMenu invokes menu callback', () => {
    let menuCalled = false;
    const board = new UnifiedPatientGridBoard('test-guardia-grid', 'GUARDIA');
    board.chipGuardiaPatientMenu = true;
    board.onChipClick = (id) => {
      menuCalled = id === 'p2';
    };
    const originalSelect = globalThis.selectPatient;
    globalThis.selectPatient = () => {
      throw new Error('selectPatient should not run when chipGuardiaPatientMenu');
    };
    try {
      board.handleChipClick('p2');
      assert.equal(menuCalled, true);
    } finally {
      if (originalSelect === undefined) delete globalThis.selectPatient;
      else globalThis.selectPatient = originalSelect;
    }
  });
});

describe('UnifiedPatientGridBoard vitals ticker', () => {
  it('startVitalsTicker and stopVitalsTicker do not throw outside DOM', () => {
    const board = new UnifiedPatientGridBoard('nonexistent-id');
    assert.doesNotThrow(() => board.startVitalsTicker());
    assert.doesNotThrow(() => board.stopVitalsTicker());
  });
});
