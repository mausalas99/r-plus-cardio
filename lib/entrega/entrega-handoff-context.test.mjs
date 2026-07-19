import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultHandoffContext,
  defaultVasopressorInfusion,
  formatVasopressorInfusion,
  handoffContextSummary,
  normalizeHandoffContext,
  normalizeVasopressor,
  parseVasopressorRate,
} from './entrega-handoff-context.mjs';

describe('normalizeVasopressor', () => {
  it('defaults norepinefrina infusion', () => {
    const v = normalizeVasopressor({ active: true, agent: 'norepinefrina' });
    assert.equal(v.dose, '0.05');
    assert.equal(v.unit, 'mcg_kg_min');
    assert.match(v.rate, /Nore.*0\.05.*mcg\/kg\/min/);
  });

  it('forces vasopresina to UI/min', () => {
    const v = normalizeVasopressor({
      active: true,
      agent: 'vasopresina',
      dose: '0.04',
      unit: 'mcg_kg_min',
    });
    assert.equal(v.unit, 'ui_min');
    assert.match(v.rate, /UI\/min/);
  });

  it('parses legacy rate string', () => {
    const v = normalizeVasopressor({ active: true, rate: '0.08 mcg/min', agent: 'Norepinefrina' });
    assert.equal(v.dose, '0.08');
    assert.equal(v.unit, 'mcg_min');
  });

  it('respects explicit active: false even when agent is set', () => {
    const v = normalizeVasopressor({ active: false, agent: 'norepinefrina' });
    assert.equal(v.active, false);
  });

  it('infers active from agent when active key is absent (legacy records)', () => {
    const v = normalizeVasopressor({ agent: 'norepinefrina', dose: '0.05' });
    assert.equal(v.active, true);
  });

  it('defaultHandoffContext vasopressor is inactive', () => {
    const ctx = defaultHandoffContext();
    assert.equal(ctx.vasopressor.active, false);
  });
});

describe('parseVasopressorRate', () => {
  it('detects UI/min', () => {
    assert.deepEqual(parseVasopressorRate('0.03 UI/min'), { dose: '0.03', unit: 'ui_min' });
  });
});

describe('defaultVasopressorInfusion', () => {
  it('vasopresina default dose', () => {
    assert.deepEqual(defaultVasopressorInfusion('vasopresina'), {
      dose: '0.03',
      unit: 'ui_min',
    });
  });
});

describe('normalizeHandoffContext', () => {
  it('defaults empty doc', () => {
    const ctx = normalizeHandoffContext(null);
    assert.equal(ctx.show, false);
    assert.equal(ctx.vasopressor.agent, 'norepinefrina');
  });

  it('maps legacy shock field to show', () => {
    const ctx = normalizeHandoffContext({ shock: true });
    assert.equal(ctx.show, true);
  });
});

describe('handoffContextSummary', () => {
  it('joins clinical markers', () => {
    const text = handoffContextSummary({
      clinicalStatus: 'unstable',
      show: true,
      signedRefusal: true,
      vasopressor: { active: true, agent: 'norepinefrina', dose: '0.1', unit: 'mcg_min' },
    });
    assert.match(text, /Inestable/);
    assert.match(text, /Show/);
    assert.match(text, /mcg\/min/);
  });
});

describe('defaultHandoffContext', () => {
  it('returns fresh object each call', () => {
    const a = defaultHandoffContext();
    const b = defaultHandoffContext();
    a.show = true;
    assert.equal(b.show, false);
  });
});

describe('formatVasopressorInfusion', () => {
  it('formats nore with short label', () => {
    assert.equal(
      formatVasopressorInfusion({
        agent: 'norepinefrina',
        dose: '0.05',
        unit: 'mcg_kg_min',
      }),
      'Nore 0.05 mcg/kg/min'
    );
  });
});
