/** Scheduled auto-backup settings, scheduler, and settings UI. */
import { saveState } from '../../../app-state.mjs';
import {
  AUTO_BACKUP_INDEX_KEY,
  AUTO_BACKUP_MAX,
  AUTO_BACKUP_SETTINGS_KEY,
  formatDateSlug,
  downloadJsonPayload,
} from '../shared.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { buildFullBackupPayload } from './backup-payload.mjs';

const rt = getPlatformRuntime();
var autoBackupSchedulerId = null;

function defaultAutoBackupSettings() {
  return { frequency: 'off', retention: 7, lastRunAt: 0 };
}

function getAutoBackupSettings() {
  try {
    var saved = JSON.parse(localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY) || '{}');
    var frequency = saved.frequency === 'daily' || saved.frequency === 'weekly' ? saved.frequency : 'off';
    var retention = parseInt(saved.retention, 10);
    if (retention !== 3 && retention !== 7 && retention !== 14) retention = 7;
    var lastRunAt = parseInt(saved.lastRunAt, 10);
    return { frequency: frequency, retention: retention, lastRunAt: Number.isFinite(lastRunAt) ? lastRunAt : 0 };
  } catch {
    return defaultAutoBackupSettings();
  }
}

function saveAutoBackupSettings(cfg) {
  localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(cfg));
}

function getAutoBackupIndex() {
  try {
    var list = JSON.parse(localStorage.getItem(AUTO_BACKUP_INDEX_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAutoBackupIndex(list) {
  localStorage.setItem(AUTO_BACKUP_INDEX_KEY, JSON.stringify(list.slice(0, AUTO_BACKUP_MAX)));
}

function syncAutoBackupUi() {
  var cfg = getAutoBackupSettings();
  var freqEl = document.getElementById('auto-backup-frequency');
  var retEl = document.getElementById('auto-backup-retention');
  if (freqEl) freqEl.value = cfg.frequency;
  if (retEl) retEl.value = String(cfg.retention);
}

function updateAutoBackupSettingsFromUi() {
  var cfg = getAutoBackupSettings();
  var freqEl = document.getElementById('auto-backup-frequency');
  var retEl = document.getElementById('auto-backup-retention');
  cfg.frequency = freqEl ? freqEl.value : cfg.frequency;
  cfg.retention = retEl ? parseInt(retEl.value, 10) : cfg.retention;
  if (cfg.retention !== 3 && cfg.retention !== 7 && cfg.retention !== 14) cfg.retention = 7;
  saveAutoBackupSettings(cfg);
  addAuditEntry('auto-backup-config', 'ok', cfg.retention, cfg.frequency);
  maybeRunScheduledAutoBackup();
}

function shouldRunScheduledBackup(cfg) {
  if (!cfg || cfg.frequency === 'off') return false;
  var now = Date.now();
  var delta = cfg.frequency === 'weekly' ? 7 * 24 * 3600000 : 24 * 3600000;
  return !cfg.lastRunAt || (now - cfg.lastRunAt) >= delta;
}

function maybeRunScheduledAutoBackup() {
  var cfg = getAutoBackupSettings();
  if (!shouldRunScheduledBackup(cfg)) return;
  runAutoBackupNow(true);
}

function restartAutoBackupScheduler() {
  if (autoBackupSchedulerId) clearInterval(autoBackupSchedulerId);
  autoBackupSchedulerId = setInterval(function() {
    maybeRunScheduledAutoBackup();
  }, 30 * 60 * 1000);
}

async function runAutoBackupNow(isScheduled) {
  await saveState({ immediate: true });
  var cfg = getAutoBackupSettings();
  var payload = buildFullBackupPayload();
  payload.autoBackup = { scheduled: !!isScheduled };
  var ts = Date.now();
  var fileName = 'R-plus-auto-respaldo-' + formatDateSlug(new Date(ts)) + '-' + String(ts).slice(-6) + '.json';
  downloadJsonPayload(payload, fileName);
  var idx = getAutoBackupIndex();
  idx.unshift({ id: ts, fileName: fileName, createdAt: new Date(ts).toISOString(), patients: (payload.data.patients || []).length });
  idx = idx.slice(0, cfg.retention);
  saveAutoBackupIndex(idx);
  cfg.lastRunAt = ts;
  saveAutoBackupSettings(cfg);
  addAuditEntry('backup-auto', 'ok', (payload.data.patients || []).length, isScheduled ? 'scheduled' : 'manual');
  rt.showToast('Auto-respaldo generado', 'success');
}

export {
  defaultAutoBackupSettings,
  getAutoBackupSettings,
  saveAutoBackupSettings,
  getAutoBackupIndex,
  saveAutoBackupIndex,
  syncAutoBackupUi,
  updateAutoBackupSettingsFromUi,
  shouldRunScheduledBackup,
  maybeRunScheduledAutoBackup,
  restartAutoBackupScheduler,
  runAutoBackupNow,
};
