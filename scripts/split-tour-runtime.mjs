#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public/js/features/settings-help');
const src = fs.readFileSync(path.join(dir, 'tour-runtime.mjs'), 'utf8');
const lines = src.split('\n');

const headerEnd = lines.findIndex((l, i) => i > 0 && l.startsWith('const rt ='));
const header = lines.slice(0, headerEnd).join('\n');

const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const stateBlock = slice(98, 119);
const demoBlock = slice(121, 368);
const engineBlock = slice(370, 931);
const flowBlock = slice(932, 1511);
const miniBlock = slice(1512, 1711);
const exportBlock = lines.slice(1711).join('\n');

const stateImports = `import { syncGuidedTourContext } from '../../tour-guards.mjs';\n\n`;

fs.writeFileSync(
  path.join(dir, 'tour-state.mjs'),
  `/** Shared guided-tour / mini-tour mutable state. */\n${stateImports}${stateBlock}\n`
);

const subHeader = (note) =>
  `${header}\nimport { getSettingsHelpRuntime } from './runtime.mjs';\nimport { settingsHelpBridge } from './bridges.mjs';\nimport {\n  closeSettingsDropdown,\n  toggleSettingsDropdown,\n  ensureSettingsDropdownOpen,\n  expandSettingsAccordionBackupSync,\n} from './settings-dropdown.mjs';\nimport {\n  guidedTourActive,\n  guidedTourBranch,\n  guidedTourMode,\n  tourStepId,\n  persistTourProgressTimer,\n  tourDemoLabSessionProcessed,\n  miniTourActive,\n  miniTourSteps,\n  miniTourIdx,\n  publishTourGuardContext,\n  GUIDED_TOUR_LS_KEY,\n} from './tour-state.mjs';\n\nconst rt = getSettingsHelpRuntime();\n\n/** ${note} */\n`;

fs.writeFileSync(path.join(dir, 'tour-demo-seed.mjs'), subHeader('Tour demo patient seeding') + demoBlock + '\n');
fs.writeFileSync(path.join(dir, 'tour-engine.mjs'), subHeader('Tour intro, dock, step targets') + engineBlock + '\n');
fs.writeFileSync(path.join(dir, 'tour-flow.mjs'), subHeader('Tour step render and onboarding flow') + flowBlock + '\n');
fs.writeFileSync(path.join(dir, 'tour-mini.mjs'), subHeader('Mini tours and help entrypoints') + miniBlock + '\n');

const barrel = `/** Guided tours facade — re-exports submodules (BN-05). */
export { GUIDED_TOUR_LS_KEY } from './tour-state.mjs';
export { shouldShowGuidedTourIntro, normalizeTourVersionLabel, syncLearnHubContinueVisibility } from './tour-engine.mjs';
export * from './tour-flow.mjs';
export * from './tour-demo-seed.mjs';
export * from './tour-mini.mjs';

import './tour-demo-seed.mjs';
import './tour-engine.mjs';
import './tour-flow.mjs';
import './tour-mini.mjs';

${exportBlock}
`;

fs.writeFileSync(path.join(dir, 'tour-runtime.mjs'), barrel);
console.log('split tour-runtime OK');
