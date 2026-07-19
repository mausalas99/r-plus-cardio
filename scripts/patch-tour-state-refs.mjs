#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public/js/features/settings-help');
const files = ['tour-demo-seed.mjs', 'tour-engine.mjs', 'tour-flow.mjs', 'tour-mini.mjs'];

const vars = [
  'TEND_SECTION_EXPANDED_LS',
  'TEND_HIDDEN_SERIES_LS',
  'TEND_ABNORMAL_ONLY_LS',
  'guidedTourActive',
  'guidedTourBranch',
  'guidedTourMode',
  'tourStepId',
  'persistTourProgressTimer',
  'tourDemoLabSessionProcessed',
  'miniTourActive',
  'miniTourSteps',
  'miniTourIdx',
];

const map = {
  TEND_SECTION_EXPANDED_LS: 'tendSectionExpandedLs',
  TEND_HIDDEN_SERIES_LS: 'tendHiddenSeriesLs',
  TEND_ABNORMAL_ONLY_LS: 'tendAbnormalOnlyLs',
};

for (const f of files) {
  let s = fs.readFileSync(path.join(dir, f), 'utf8');
  s = s.replace(
    /import \{\s*guidedTourActive,[\s\S]*?GUIDED_TOUR_LS_KEY,\s*\} from '\.\/tour-state\.mjs';\n/g,
    "import { tourState, publishTourGuardContext, GUIDED_TOUR_LS_KEY } from './tour-state.mjs';\n"
  );
  for (const v of vars) {
    const prop = map[v] || v;
    const re = new RegExp(`\\b${v}\\b`, 'g');
    s = s.replace(re, `tourState.${prop}`);
  }
  fs.writeFileSync(path.join(dir, f), s);
}
console.log('patched tour state refs');
