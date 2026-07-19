const LABELS = {
  historiaClinica: {
    'labsAtAdmission': 'Laboratorios de ingreso',
    'labsAtAdmission.na': 'Sodio',
    'labsAtAdmission.k': 'Potasio',
    'signosVitalesIngreso.fc': 'Frecuencia cardiaca',
    plan: 'Plan',
    motivoConsulta: 'Motivo de consulta',
    padecimientoActual: 'Padecimiento actual',
  },
  todo: {
    text: 'Pendiente',
    completed: 'Pendiente',
    priority: 'Prioridad',
  },
  agenda: {
    title: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    notes: 'Notas',
  },
};

let remoteApplyDepth = 0;

export function deltaLabelForPath(entityType, path) {
  const labels = LABELS[entityType] || {};
  return labels[path] || labels[String(path || '').split('.')[0]] || String(path || 'cambio');
}

export function createDeltaEchoTracker(localClientId) {
  const pending = new Set();
  return {
    track(txId) {
      if (txId) pending.add(String(txId));
    },
    isOwnEcho(msg) {
      const own = String(msg && msg.originClientId || '') === String(localClientId || '');
      const txId = String(msg && msg.txId || '');
      if (!own || !txId || !pending.has(txId)) return false;
      pending.delete(txId);
      return true;
    },
  };
}

export function applyDeltaPathValues(target, pathValues) {
  Object.keys(pathValues || {}).forEach(function (path) {
    const segments = String(path).split('.');
    let cursor = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }
    const leaf = segments[segments.length - 1];
    if (pathValues[path] === null) delete cursor[leaf];
    else cursor[leaf] = pathValues[path];
  });
  return target;
}

export function isRemoteDeltaApplying() {
  return remoteApplyDepth > 0;
}

export async function withRemoteDeltaApply(fn) {
  remoteApplyDepth += 1;
  try {
    return await fn();
  } finally {
    remoteApplyDepth -= 1;
  }
}
