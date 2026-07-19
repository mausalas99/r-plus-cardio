/**
 * Concatenate feature module sources for characterization grep tests.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} dir - Absolute or relative directory containing modules
 * @param {string[]} names - Explicit filenames in order; use '*' suffix for glob prefix
 * @returns {string}
 */
export function readFeatureSrc(dir, names) {
  const parts = [];
  for (const name of names) {
    if (name.includes('*')) {
      const prefix = name.replace(/\*.*$/, '');
      const suffix = name.includes('.') ? name.slice(name.indexOf('*') + 1) : '';
      const entries = readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && (!suffix || f.endsWith(suffix)))
        .sort();
      for (const entry of entries) {
        parts.push(readFileSync(join(dir, entry), 'utf8'));
      }
      continue;
    }
    parts.push(readFileSync(join(dir, name), 'utf8'));
  }
  return parts.join('\n');
}
