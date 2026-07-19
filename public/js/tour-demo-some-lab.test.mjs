import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeSomeLabReport, procesarLabs } from './labs.js';
import { parseSomeReportTables } from './labs-some-table.mjs';
import { DEMO_SOME_LAB_REPORT, OLDER_DEMO_SOME_LAB_REPORT } from './tour-demo-some-lab.mjs';

test('demo SOME reports detect as SOME and parse tables', () => {
  assert.equal(looksLikeSomeLabReport(DEMO_SOME_LAB_REPORT), true);
  assert.equal(looksLikeSomeLabReport(OLDER_DEMO_SOME_LAB_REPORT), true);
  const newer = parseSomeReportTables(DEMO_SOME_LAB_REPORT);
  const older = parseSomeReportTables(OLDER_DEMO_SOME_LAB_REPORT);
  assert.ok(newer.departments.length >= 2);
  assert.ok(older.departments.length >= 2);
  const r = procesarLabs(DEMO_SOME_LAB_REPORT);
  assert.ok(r.resLabs.length > 0);
});
