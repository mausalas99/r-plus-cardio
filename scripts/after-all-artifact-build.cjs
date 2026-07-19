#!/usr/bin/env node
/**
 * Hook electron-builder: regenera latest*.yml con los nombres reales en dist/.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'write-release-yml.js');
const r = spawnSync(process.execPath, [script, '--auto'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});
process.exit(r.status || 0);
