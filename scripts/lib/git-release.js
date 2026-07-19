/**
 * Staging de cambios locales antes de release:publish (respeta .gitignore).
 */
const { execSync } = require('child_process');

function gitOutput(cwd, args) {
  try {
    return execSync(['git', ...args].join(' '), {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/** @param {string} line */
function parseStatusPath(line) {
  const body = line.slice(3).trim();
  if (body.includes(' -> ')) return body.split(' -> ').pop().trim();
  if (body.startsWith('"') && body.endsWith('"')) return body.slice(1, -1);
  return body;
}

/** @param {string} cwd */
function listWorkingTreeChanges(cwd) {
  const out = gitOutput(cwd, ['status', '--porcelain', '-u']);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: parseStatusPath(line),
    }));
}

/** @param {string} cwd */
function stagedFileNames(cwd) {
  return gitOutput(cwd, ['diff', '--cached', '--name-only'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} cwd
 * @param {{ autoStageAll?: boolean }} [opts]
 * @returns {string[]}
 */
function stageForRelease(cwd, opts = {}) {
  const autoStageAll = opts.autoStageAll !== false;
  if (autoStageAll) {
    execSync(
      'git add -A -- . ":!dist" ":!node_modules" ":!dist/**" ":!node_modules/**"',
      { cwd, stdio: 'inherit' }
    );
  } else {
    execSync('git add package.json package-lock.json', { cwd, stdio: 'inherit' });
  }
  return stagedFileNames(cwd);
}

/** @param {string[]} staged @param {number} [limit] */
function formatStagedSummary(staged, limit = 14) {
  if (!staged.length) return '';
  const head = staged.slice(0, limit).join(', ');
  return staged.length > limit ? `${head} (+${staged.length - limit} más)` : head;
}

module.exports = {
  listWorkingTreeChanges,
  stagedFileNames,
  stageForRelease,
  formatStagedSummary,
};
