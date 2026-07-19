import fs from 'node:fs';
import { MAX_FILE_LINES } from './constants.mjs';

export function fileLineOverageDebt(lineCount) {
  if (lineCount <= MAX_FILE_LINES) return 0;
  return 2 * Math.ceil((lineCount - MAX_FILE_LINES) / 10);
}

export function duplicationDebtFromJscpd(statistics) {
  const tokens = statistics?.total?.tokens || 0;
  return Math.ceil(tokens / 50);
}

export function computeTotalScore(parts) {
  return (
    (parts.complexityOverage || 0) +
    (parts.lengthOverage || 0) +
    (parts.duplicationDebt || 0) +
    (parts.importSmellDebt || 0) +
    (parts.bootGraphDebt || 0)
  );
}

/** ESLint JSON: count complexity and max-lines violations as debt */
export function eslintDebtFromResults(results) {
  let complexityOverage = 0;
  let lengthOverage = 0;
  for (const file of results) {
    const lines = file.filePath && fs.existsSync(file.filePath)
      ? fs.readFileSync(file.filePath, 'utf8').split('\n').length
      : 0;
    lengthOverage += fileLineOverageDebt(lines);
    for (const msg of file.messages || []) {
      if (msg.ruleId === 'complexity') complexityOverage += 10;
      if (msg.ruleId === 'max-lines-per-function') {
        const over = Number(msg.message.match(/(\d+)/)?.[1] || 80) - 80;
        if (over > 0) lengthOverage += 2 * Math.ceil(over / 10);
      }
    }
  }
  return { complexityOverage, lengthOverage };
}
