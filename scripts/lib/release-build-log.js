/**
 * Heurísticas de sub-progreso a partir de salida de npm test / electron-builder.
 */

let testOkCount = 0;
let buildMacHits = 0;
let buildWinHits = 0;

function resetBuildLogState() {
  testOkCount = 0;
  buildMacHits = 0;
  buildWinHits = 0;
}

function bumpSub(progress, stepId, subPct, detail) {
  progress.subProgress(stepId, subPct, detail);
}

function applyBuildLogLine(progress, stepId, line) {
  const t = String(line || '').trim();
  if (!t) return;

  if (stepId === 'tests') {
    const ok = t.match(/^ok \d+/);
    if (ok) {
      testOkCount += 1;
      const sub = Math.min(95, 5 + Math.floor((testOkCount / 500) * 90));
      bumpSub(progress, stepId, sub, `tests (${testOkCount} ok)`);
    }
    return;
  }

  if (stepId === 'build-mac') {
    if (/electron-builder|packaging|building|target=|arch=|signing|\.dmg|\.zip|blockmap/i.test(t)) {
      buildMacHits += 1;
      const sub = Math.min(95, 8 + buildMacHits * 4);
      let detail = 'electron-builder';
      if (/arm64/i.test(t)) detail = 'Mac arm64';
      else if (/x64|x86_64/i.test(t)) detail = 'Mac x64';
      else if (/signing/i.test(t)) detail = 'Firmando…';
      else if (/packaging/i.test(t)) detail = 'Empaquetando…';
      bumpSub(progress, stepId, sub, detail);
    }
    return;
  }

  if (stepId === 'build-win') {
    if (/electron-builder|packaging|building|target=|\.exe|nsis|wine|blockmap/i.test(t)) {
      buildWinHits += 1;
      const sub = Math.min(95, 8 + buildWinHits * 5);
      bumpSub(progress, stepId, sub, 'Windows build');
    }
  }
}

module.exports = { applyBuildLogLine, resetBuildLogState };
