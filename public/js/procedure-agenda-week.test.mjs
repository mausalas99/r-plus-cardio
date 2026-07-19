import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mondayStartLocal,
  addDaysLocal,
  weekBoundsFromMonday,
  clipEventToDayColumn,
  assignLanesByInterval,
  AGENDA_DISPLAY_FIRST_HOUR,
  AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE,
  VISUAL_DURATION_MS,
  hoursVisibleCount,
} from './procedure-agenda-week.mjs';

describe('procedure-agenda-week', () => {
  it('hoursVisible spans first..last exclusive grid', () => {
    assert.strictEqual(hoursVisibleCount(), AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE - AGENDA_DISPLAY_FIRST_HOUR);
  });

  it('Monday anchor normalizes arbitrary weekday to preceding Monday', () => {
    var wed = new Date(2026, 4, 14, 15, 0, 0, 0);
    var mo = mondayStartLocal(wed);
    assert.strictEqual(mo.getDay(), 1);
    assert.strictEqual(mo.getDate(), 11);
    assert.strictEqual(mo.getMonth(), 4);
  });

  it('week bounds are 7 local days starting Monday', () => {
    var mon = mondayStartLocal(new Date(2026, 4, 11, 0, 0, 0));
    var w = weekBoundsFromMonday(mon);
    assert.strictEqual(w.endExclusive.getTime() - w.start.getTime(), 7 * 86400000);
  });

  it('clips 2 h block within visible daytime', () => {
    var midnight = mondayStartLocal(new Date(2026, 4, 11)).getTime();
    var evt = new Date(2026, 4, 11, AGENDA_DISPLAY_FIRST_HOUR + 3, 15, 0, 0).getTime();
    var c = clipEventToDayColumn(evt, midnight);
    assert.ok(c);
    assert.strictEqual(c.botMs - c.topMs, VISUAL_DURATION_MS);
  });

  it('lane assignment splits overlaps', () => {
    var t0 = 1000;
    var lanes = assignLanesByInterval([
      { id: 'a', topMs: t0, botMs: t0 + VISUAL_DURATION_MS },
      { id: 'b', topMs: t0 + 60 * 60 * 1000, botMs: t0 + 60 * 60 * 1000 + VISUAL_DURATION_MS },
    ]);
    assert.strictEqual(lanes.get('a'), 0);
    assert.strictEqual(lanes.get('b'), 1);
  });

  it('addDaysLocal keeps wall clock stable', () => {
    var a = mondayStartLocal(new Date(2026, 4, 11));
    var sun = addDaysLocal(a, 6);
    assert.strictEqual(sun.getDay(), 0);
  });
});
