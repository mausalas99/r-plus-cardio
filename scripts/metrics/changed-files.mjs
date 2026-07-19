import { execSync } from 'node:child_process';

const TIER1_RE = /^(public\/js\/|lib\/|lan-squad\/)/;
const LINTABLE_RE = /\.(mjs|js|cjs)$/;

export function filterTier1Paths(paths) {
  return paths.filter((p) => TIER1_RE.test(p.replace(/\\/g, '/')));
}

/** Tier 1 paths that ESLint flat config can lint (excludes fixtures HTML, etc.). */
export function filterLintableTier1Paths(paths) {
  return filterTier1Paths(paths).filter((p) => LINTABLE_RE.test(p.replace(/\\/g, '/')));
}

function gitChangedFiles(baseRef = 'HEAD') {
  try {
    const out = execSync(`git diff --name-only ${baseRef}`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function gitChangedFilesAgainst(base = 'main') {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return gitChangedFiles('HEAD');
  }
}
