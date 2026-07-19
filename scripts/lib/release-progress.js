/**
 * Barra de progreso global para release:publish (sin dependencias externas).
 * Con jsonMode emite líneas JSON en stdout para la consola Release (~/Release).
 */

function buildPublishSteps(opts) {
  const steps = [];
  steps.push({ id: 'preflight', label: 'Comprobar versión y tag', weight: 1 });
  steps.push({ id: 'pack-files', label: 'Sincronizar build.files (electron-builder)', weight: 1 });
  if (!opts.skipPreCommit) {
    steps.push({ id: 'pre-commit', label: 'Commit cambios pendientes', weight: 3 });
  }
  if (!opts.skipTests) {
    steps.push({ id: 'native-restore', label: 'Restaurar SQLCipher (host arch)', weight: 1 });
    steps.push({ id: 'tests', label: 'Tests', weight: 8 });
  }
  if (!opts.skipCommit) {
    steps.push({ id: 'git-commit', label: 'Commit release', weight: 4 });
  }
  if (!opts.skipPush) {
    steps.push({ id: 'git-push', label: 'Push main', weight: 3 });
  }
  if (!opts.skipBuild) {
    steps.push({
      id: 'verify-natives',
      label: 'Verificar módulos nativos (.node)',
      weight: 1,
    });
    if (!opts.winOnly) {
      steps.push({ id: 'build-mac', label: 'Build Mac (arm64 + x64)', weight: 38 });
    }
    if (!opts.macOnly) {
      steps.push({ id: 'build-win', label: 'Build Windows', weight: 38 });
    }
    steps.push({ id: 'verify-dist', label: 'Verificar dist/', weight: 2 });
  }
  steps.push({ id: 'git-tag', label: 'Tag de versión', weight: 3 });
  if (!opts.skipPush) {
    steps.push({ id: 'git-push-tag', label: 'Push tag', weight: 2 });
  }
  if (!opts.skipGh) {
    steps.push({ id: 'gh-release', label: 'GitHub Release + assets', weight: 10 });
  }
  if (!opts.noManifestCommit && !opts.skipPush) {
    steps.push({ id: 'manifest-commit', label: 'Manifests latest*.yml (opcional)', weight: 2 });
  }
  return steps;
}

function createReleaseProgress(steps, options) {
  const opts = options || {};
  const jsonMode = !!opts.jsonMode;
  const totalWeight = steps.reduce(function (sum, s) {
    return sum + (s.weight || 1);
  }, 0);
  let doneWeight = 0;
  let current = null;
  let lastLine = '';
  let stepSubPct = 0;
  let stepSubDetail = '';
  let lastSubRender = 0;

  function stepIndex(stepId) {
    const i = steps.findIndex(function (s) {
      return s.id === stepId;
    });
    return i < 0 ? 0 : i + 1;
  }

  function pct() {
    if (!totalWeight) return 100;
    let activeWeight = 0;
    if (current) {
      const w = current.weight || 1;
      const sub = stepSubPct || 0;
      activeWeight = w * (sub > 0 ? sub / 100 : 0.08);
    }
    return Math.min(99, Math.round(((doneWeight + activeWeight) / totalWeight) * 100));
  }

  function emit(event) {
    if (opts.onEvent) opts.onEvent(event);
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  }

  function render() {
    if (jsonMode) return;
    const p = pct();
    let label = current ? current.label : 'Completado';
    if (current && stepSubDetail) {
      label = `${current.label} — ${stepSubDetail}`;
    }
    const w = 24;
    const filled = Math.round((p / 100) * w);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(Math.max(0, w - filled));
    const stepIdx = current ? stepIndex(current.id) : steps.length;
    let line =
      '[' +
      bar +
      '] ' +
      String(p).padStart(3) +
      '%  (' +
      stepIdx +
      '/' +
      steps.length +
      ') ' +
      label;

    if (process.stderr.isTTY) {
      const cols = process.stderr.columns || 80;
      if (line.length > cols - 1) line = `${line.slice(0, cols - 4)}…`;
      process.stderr.write(`\r${line.padEnd(cols - 1, ' ')}\r`);
      lastLine = line;
    } else {
      console.error('[release]', line.trim());
    }
  }

  function clearLine() {
    if (jsonMode) return;
    if (process.stderr.isTTY && lastLine) {
      const cols = process.stderr.columns || 80;
      process.stderr.write(`\r${' '.repeat(cols - 1)}\r`);
      lastLine = '';
    }
  }

  function stepPayload(stepId, phase) {
    const step = steps.find(function (s) {
      return s.id === stepId;
    });
    return {
      type: 'step',
      phase,
      id: stepId,
      label: step ? step.label : stepId,
      pct: pct(),
      stepIndex: stepIndex(stepId),
      stepCount: steps.length,
    };
  }

  emit({
    type: 'plan',
    steps: steps.map(function (s) {
      return { id: s.id, label: s.label, weight: s.weight || 1 };
    }),
  });

  return {
    steps,
    jsonMode,
    currentStepId: null,
    start(stepId) {
      stepSubPct = 0;
      stepSubDetail = '';
      current = steps.find(function (s) {
        return s.id === stepId;
      }) || null;
      emit(stepPayload(stepId, 'start'));
      render();
    },
    subProgress(stepId, subPct, detail) {
      if (!current || current.id !== stepId) return;
      if (subPct > stepSubPct) stepSubPct = subPct;
      if (detail) stepSubDetail = detail;
      const step = steps.find(function (s) {
        return s.id === stepId;
      });
      emit({
        type: 'subprogress',
        id: stepId,
        label: step ? step.label : stepId,
        subPct: stepSubPct,
        detail: stepSubDetail,
        pct: pct(),
        stepIndex: stepIndex(stepId),
        stepCount: steps.length,
      });
      const now = Date.now();
      if (now - lastSubRender > 350 || stepSubPct >= 95) {
        lastSubRender = now;
        render();
      }
    },
    emitLog(ev) {
      const line = ev && ev.line != null ? String(ev.line) : '';
      if (!line.trim()) return;
      emit({
        type: 'log',
        stream: ev.stream || 'stdout',
        line,
      });
    },
    complete(stepId) {
      const step = steps.find(function (s) {
        return s.id === stepId;
      });
      if (step) doneWeight += step.weight || 1;
      if (current && current.id === stepId) current = null;
      stepSubPct = 0;
      stepSubDetail = '';
      emit(stepPayload(stepId, 'complete'));
      render();
    },
    skip(stepId) {
      const step = steps.find(function (s) {
        return s.id === stepId;
      });
      if (step) doneWeight += step.weight || 1;
      if (current && current.id === stepId) current = null;
      stepSubPct = 0;
      stepSubDetail = '';
      emit(stepPayload(stepId, 'skip'));
      render();
    },
    finish() {
      current = null;
      doneWeight = totalWeight;
      emit({ type: 'done', pct: 100, stepCount: steps.length });
      if (jsonMode) return;
      if (process.stderr.isTTY) {
        const w = 24;
        const bar = '\u2588'.repeat(w);
        const line = `[${bar}] 100%  (${steps.length}/${steps.length}) Publicación lista`;
        const cols = process.stderr.columns || 80;
        process.stderr.write(`\r${line.padEnd(cols - 1, ' ')}\n`);
      } else {
        console.error('[release] 100% — Publicación lista');
      }
      lastLine = '';
    },
    fail(stepId) {
      const failed = steps.find(function (s) {
        return s.id === stepId;
      });
      emit({ type: 'fail', id: stepId, label: failed ? failed.label : stepId });
      clearLine();
      if (!jsonMode) {
        const step = steps.find(function (s) {
          return s.id === stepId;
        });
        console.error('\n✗ Release detenido en:', step ? step.label : stepId);
      }
    },
    logCommand(cmd) {
      emit({ type: 'log', stream: 'meta', line: `→ ${cmd}` });
      clearLine();
      if (!jsonMode) console.log('\n→', cmd);
      if (current) render();
    },
  };
}

module.exports = { buildPublishSteps, createReleaseProgress };
