import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDuration, fmtWhen } from './equipos-format.mjs';

describe('equipos-format', () => {
  it('fmtWhen returns em dash for empty input', () => {
    assert.equal(fmtWhen(), '—');
    assert.equal(fmtWhen(''), '—');
  });

  it('fmtWhen formats valid ISO timestamps in es-MX locale', () => {
    const out = fmtWhen('2026-06-15T14:30:00.000Z');
    assert.match(out, /15/);
    assert.match(out, /06/);
    assert.match(out, /26/);
  });

  it('fmtWhen returns locale string for unparseable date input', () => {
    assert.equal(fmtWhen('not-a-date'), 'Invalid Date');
  });

  it('fmtDuration returns em dash for nullish or NaN', () => {
    assert.equal(fmtDuration(null), '—');
    assert.equal(fmtDuration(undefined), '—');
    assert.equal(fmtDuration(Number.NaN), '—');
  });

  it('fmtDuration formats sub-minute, minutes, and hours', () => {
    assert.equal(fmtDuration(30), '< 1 min');
    assert.equal(fmtDuration(90), '1 min');
    assert.equal(fmtDuration(3600), '1 h 0 min');
    assert.equal(fmtDuration(3661), '1 h 1 min');
  });

  it('fmtDuration floors negative values to zero', () => {
    assert.equal(fmtDuration(-5), '< 1 min');
  });
});
