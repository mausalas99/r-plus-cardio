import { storage } from './storage.js';
import { computeReminderAt } from './todos-due.mjs';

var deps = {
  getPatientLabel(pid) {
    return String(pid || '');
  },
  showToast(_msg) {},
  onNotify(_payload) {},
};

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
var timeouts = new Map();

function scheduleKey(patientId, todoId) {
  return String(patientId) + ':' + String(todoId);
}

function clearTimeoutForKey(key) {
  var id = timeouts.get(key);
  if (id != null) {
    clearTimeout(id);
    timeouts.delete(key);
  }
}

function fireReminder(patientId, todo) {
  var label = deps.getPatientLabel(patientId);
  var text = String(todo && todo.text != null ? todo.text : '');
  var msg = 'Pendiente: ' + label + ' — ' + text;
  deps.showToast(msg);
  var title = 'Pendiente';
  var body = label + ' — ' + text;
  if (typeof Notification !== 'undefined') {
    new Notification(title, { body: body });
  }
  if (typeof deps.onNotify === 'function') {
    deps.onNotify({ patientId: patientId, todo: todo, message: msg });
  }
}

function scheduleTodoReminder(patientId, todo) {
  if (!todo || !todo.id) return;
  var key = scheduleKey(patientId, todo.id);
  clearTimeoutForKey(key);

  if (todo.completed) return;

  var reminderAt = computeReminderAt(todo);
  if (!reminderAt) return;

  var targetMs = new Date(reminderAt).getTime();
  if (Number.isNaN(targetMs)) return;

  var delay = Math.max(0, targetMs - Date.now());
  if (delay === 0) {
    fireReminder(patientId, todo);
    return;
  }
  var timeoutId = setTimeout(function () {
    timeouts.delete(key);
    fireReminder(patientId, todo);
  }, delay);
  timeouts.set(key, timeoutId);
}

function cancelStaleKeys(activeKeys) {
  Array.from(timeouts.keys()).forEach(function (key) {
    if (!activeKeys.has(key)) {
      clearTimeoutForKey(key);
    }
  });
}

function collectActiveKeysForPatient(patientId, activeKeys) {
  storage.getTodos(patientId).forEach(function (t) {
    if (!t.completed && computeReminderAt(t)) {
      activeKeys.add(scheduleKey(patientId, t.id));
    }
  });
}

/**
 * @param {{ getPatientLabel?: (patientId: string) => string, showToast?: (msg: string) => void, onNotify?: (payload: object) => void }} newDeps
 */
export function configureTodoReminderScheduler(newDeps) {
  if (newDeps && typeof newDeps === 'object') {
    if (typeof newDeps.getPatientLabel === 'function') {
      deps.getPatientLabel = newDeps.getPatientLabel;
    }
    if (typeof newDeps.showToast === 'function') {
      deps.showToast = newDeps.showToast;
    }
    if (typeof newDeps.onNotify === 'function') {
      deps.onNotify = newDeps.onNotify;
    }
  }
}

/**
 * @param {string} [patientId] — when set, only reschedule that patient
 */
export function rescheduleAllTodos(patientId) {
  if (patientId != null && patientId !== '') {
    var pid = String(patientId);
    var activeKeys = new Set();
    collectActiveKeysForPatient(pid, activeKeys);
    Array.from(timeouts.keys()).forEach(function (key) {
      if (key.indexOf(pid + ':') === 0 && !activeKeys.has(key)) {
        clearTimeoutForKey(key);
      }
    });
    storage.getTodos(pid).forEach(function (t) {
      scheduleTodoReminder(pid, t);
    });
    return;
  }

  var patientIds = storage.listTodoPatientIds();
  var allActive = new Set();
  patientIds.forEach(function (id) {
    collectActiveKeysForPatient(id, allActive);
  });
  cancelStaleKeys(allActive);
  patientIds.forEach(function (id) {
    storage.getTodos(id).forEach(function (t) {
      scheduleTodoReminder(id, t);
    });
  });
}

/**
 * @param {string} todoId
 * @param {string} [patientId]
 */
export function cancelTodoReminder(todoId, patientId) {
  if (patientId != null && patientId !== '') {
    clearTimeoutForKey(scheduleKey(patientId, todoId));
    return;
  }
  var suffix = ':' + String(todoId);
  Array.from(timeouts.keys()).forEach(function (key) {
    if (key.slice(-suffix.length) === suffix) {
      clearTimeoutForKey(key);
    }
  });
}

/** @internal tests */
export function resetTodoReminderSchedulerForTests() {
  Array.from(timeouts.keys()).forEach(function (key) {
    clearTimeoutForKey(key);
  });
  deps = {
    getPatientLabel(pid) {
      return String(pid || '');
    },
    showToast(_msg) {},
    onNotify(_payload) {},
  };
}
