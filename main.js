// Dev-only: Electron CSP warning (unsafe-eval from bundled renderer); packaged builds omit it.
if (process.env.NODE_ENV !== 'production' && !process.env.ELECTRON_DISABLE_SECURITY_WARNINGS) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, clipboard, safeStorage, session } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { writeApprovedOutputDir } = require('./lib/output-dir-policy.js');
const { autoUpdater } = require('electron-updater');
const {
  buildGenericFeedUrl,
  buildManualInstallerUrl,
  isValidDowngradeTargetVersion,
  pickMacArch,
} = require('./lib/update-downgrade.js');
const { probeNativeRuntime } = require('./lib/native-runtime-probe.js');
const { isAllowedExternalUrl } = require('./lib/window-open-policy.cjs');
const { PERF_CONFIG_FILE, normalizePerfConfig, readPerfConfig, writePerfConfig } = require('./lib/perf-config.js');
const { setLanDbManager, getLanDbManager } = require('./lib/db/lan-db-bridge.cjs');
const { installElectronLanCors } = require('./lib/electron-lan-cors.cjs');

// Aceleración por hardware ACTIVADA por defecto: las animaciones del premium UI
// (transform/opacity/backdrop-filter) componen en GPU; en software se ven
// entrecortadas. Opt-out para equipos con muy poca RAM (~50-100 MB del proceso GPU):
//   userData/performance.json → {"hardwareAcceleration": false}
// Decidir ANTES de app.whenReady().
let perfConfig = normalizePerfConfig(null);
try {
  perfConfig = readPerfConfig(fs, path.join(app.getPath('userData'), PERF_CONFIG_FILE));
} catch (_e) { /* ignored */ }
if (!perfConfig.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

const UPDATE_CHANNEL_FILE = 'update-channel.json';

function normalizeUpdateChannel(channel) {
  return String(channel || '').toLowerCase() === 'beta' ? 'beta' : 'estable';
}

function updateChannelFilePath() {
  return path.join(app.getPath('userData'), UPDATE_CHANNEL_FILE);
}

function readUpdateChannelFromDisk() {
  try {
    const raw = JSON.parse(fs.readFileSync(updateChannelFilePath(), 'utf8'));
    return normalizeUpdateChannel(raw.channel);
  } catch (_e) {
    return 'estable';
  }
}

function writeUpdateChannelToDisk(channel) {
  const normalized = normalizeUpdateChannel(channel);
  try {
    fs.writeFileSync(updateChannelFilePath(), JSON.stringify({ channel: normalized }), 'utf8');
  } catch (_e) { /* ignored */ }
  return normalized;
}

/** Aplica canal Estable (GitHub /releases/latest) vs Pre-releases (feed + borradores). */
function applyUpdateChannel(channel) {
  const normalized = normalizeUpdateChannel(channel);
  autoUpdater.allowPrerelease = normalized === 'beta';
  autoUpdater.channel = null;
  if (normalized === 'estable') autoUpdater.allowDowngrade = false;
  return normalized;
}

let downgradeSession = null;
let reinstallSession = null;
let defaultUpdaterFeed = null;

function clearReinstallSession() {
  if (!reinstallSession) return;
  if (reinstallSession.originalIsUpdateAvailable) {
    autoUpdater.isUpdateAvailable = reinstallSession.originalIsUpdateAvailable;
  }
  reinstallSession = null;
}

/** Re-descarga e instala el tag de release de la versión instalada (mismo semver en latest.yml). */
function beginReinstallCurrentVersion() {
  clearReinstallSession();
  const current = app.getVersion();
  reinstallSession = {
    version: current,
    originalIsUpdateAvailable: autoUpdater.isUpdateAvailable.bind(autoUpdater),
  };
  const originalIsUpdateAvailable = reinstallSession.originalIsUpdateAvailable;
  autoUpdater.isUpdateAvailable = async function (updateInfo) {
    const session = reinstallSession;
    const remote = String((updateInfo && updateInfo.version) || '').replace(/^v/i, '');
    if (session && remote && remote === session.version) {
      return true;
    }
    if (originalIsUpdateAvailable) {
      return originalIsUpdateAvailable(updateInfo);
    }
    return false;
  };
  autoUpdater.allowDowngrade = true;
  autoUpdater.autoDownload = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: buildGenericFeedUrl(current),
  });
}

function captureDefaultUpdaterFeed() {
  if (defaultUpdaterFeed) return defaultUpdaterFeed;
  try {
    defaultUpdaterFeed = autoUpdater.getFeedURL();
  } catch (_e) {
    defaultUpdaterFeed = null;
  }
  return defaultUpdaterFeed;
}

function resetUpdaterFeedToDefault() {
  downgradeSession = null;
  clearReinstallSession();
  autoUpdater.allowDowngrade = false;
  applyUpdateChannel(readUpdateChannelFromDisk());
  const feed = captureDefaultUpdaterFeed();
  if (feed) {
    try {
      autoUpdater.setFeedURL(feed);
    } catch (_e) { /* noop */ }
  }
}

function beginDowngradeToVersion(version) {
  const target = String(version || '').replace(/^v/, '');
  const current = app.getVersion();
  if (!isValidDowngradeTargetVersion(target, current)) {
    throw new Error(`No se puede restaurar v${target} desde v${current}`);
  }
  downgradeSession = { version: target };
  autoUpdater.allowDowngrade = true;
  autoUpdater.autoDownload = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: buildGenericFeedUrl(target),
  });
}

function sendDowngradeFailedFromSession(code, message) {
  if (!downgradeSession) return;
  const v = downgradeSession.version;
  let manualUrl = null;
  try {
    manualUrl = buildManualInstallerUrl(
      v,
      process.platform,
      process.platform === 'darwin' ? pickMacArch(process.arch) : 'x64'
    );
  } catch (_e) { /* noop */ }
  safeSendToRenderer('downgrade-failed', {
    version: v,
    code,
    message: message || '',
    manualUrl,
  });
  resetUpdaterFeedToDefault();
}

let server;
let mainWindow;

// Cache update state so renderer can receive it even if events fired before page loaded
let pendingUpdate = null;

function serializeReleaseNotes(info) {
  if (info == null) return '';
  const n = info.releaseNotes;
  if (n == null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) {
    return n
      .map((x) => (typeof x === 'string' ? x : x && x.note ? String(x.note) : ''))
      .filter(Boolean)
      .join('\n');
  }
  return String(n);
}

function createWindow() {
  const winOpts = {
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    title: 'Cardionotas',
    show: false, // mostrar solo cuando esté listo (sin flash blanco)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: true, // throttle renderer cuando window no está en foco
      spellcheck: false,          // deshabilitar corrector ortográfico (innecesario)
      // El renderer decide no-blur según el modo de render real (ver preload isSoftwareRender)
      additionalArguments: perfConfig.hardwareAcceleration ? [] : ['--rplus-sw-render'],
    },
  };
  // Barra de título integrada con el HTML (macOS); semáforos en el área de cliente
  if (process.platform === 'darwin') {
    winOpts.titleBarStyle = 'hiddenInset';
    winOpts.trafficLightPosition = { x: 14, y: 17 };
  }
  mainWindow = new BrowserWindow(winOpts);

  mainWindow.loadURL('http://localhost:3738');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 5000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    mainWindow.show();
  });

  // Wait for renderer JS to fully load before checking for updates
  mainWindow.webContents.once('did-finish-load', () => {
    try {
      // Replay any update events that fired before the renderer was ready
      if (pendingUpdate) {
        if (pendingUpdate.type === 'available')
          mainWindow.webContents.send('update-available', {
            version: pendingUpdate.version,
            releaseNotes: pendingUpdate.releaseNotes || '',
            prerelease: !!pendingUpdate.prerelease,
          });
        else if (pendingUpdate.type === 'progress')
          mainWindow.webContents.send('update-progress', {
            percent: pendingUpdate.percent,
            transferred: pendingUpdate.transferred,
            total: pendingUpdate.total,
            bytesPerSecond: pendingUpdate.bytesPerSecond,
          });
        else if (pendingUpdate.type === 'ready')
          mainWindow.webContents.send('update-ready', { version: pendingUpdate.version });
      }
    } catch (e) {
      console.error('did-finish-load replay error:', e && e.message);
    }
    // Small delay to ensure renderer IPC listeners are registered
    scheduleUpdateCheck(1500);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Auto-updater events ───────────────────────────────────────────
function safeSendToRenderer(channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch (e) {
    console.error('safeSendToRenderer error for', channel, ':', e && e.message);
  }
}

autoUpdater.on('update-available', (info) => {
  try {
    const releaseNotes = serializeReleaseNotes(info);
    const version = info && info.version ? info.version : '';
    const prerelease = !!(info && info.prerelease);
    pendingUpdate = { type: 'available', version, releaseNotes, prerelease };
    safeSendToRenderer('update-available', { version, releaseNotes, prerelease });
  } catch (e) {
    console.error('update-available handler error:', e && e.message);
  }
});

autoUpdater.on('download-progress', (p) => {
  try {
    const payload = {
      percent: Math.round((p && p.percent) || 0),
      transferred: p && p.transferred,
      total: p && p.total,
      bytesPerSecond: p && p.bytesPerSecond,
    };
    pendingUpdate = { type: 'progress', ...payload };
    safeSendToRenderer('update-progress', payload);
  } catch (e) {
    console.error('download-progress handler error:', e && e.message);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  try {
    const version = info && info.version ? info.version : '';
    pendingUpdate = { type: 'ready', version };
    safeSendToRenderer('update-ready', { version });
  } catch (e) {
    console.error('update-downloaded handler error:', e && e.message);
  }
});

autoUpdater.on('update-not-available', () => {
  try {
    if (downgradeSession) {
      sendDowngradeFailedFromSession(
        'not-available',
        'No se encontró la versión en el servidor de actualizaciones.'
      );
      return;
    }
    if (reinstallSession) {
      const v = reinstallSession.version;
      clearReinstallSession();
      resetUpdaterFeedToDefault();
      safeSendToRenderer('update-not-available', { reinstallFailed: true, version: v });
      return;
    }
    safeSendToRenderer('update-not-available', {});
  } catch (e) {
    console.error('update-not-available handler error:', e && e.message);
  }
});

autoUpdater.on('error', (err) => {
  try {
    const baseMsg = (err && err.message) ? err.message : String(err || 'Error desconocido');
    console.error('AutoUpdater error:', baseMsg);
    let msg = baseMsg;
    if (process.platform === 'darwin' && /Code signature|did not pass validation/i.test(msg)) {
      msg +=
        ' En macOS, la actualización automática exige la misma firma e identificador de app que la instalación actual; si cambió el build, descarga el DMG desde GitHub e instálalo manualmente.';
    }
    if (downgradeSession) {
      sendDowngradeFailedFromSession('updater-error', msg);
      return;
    }
    if (reinstallSession) {
      const v = reinstallSession.version;
      clearReinstallSession();
      resetUpdaterFeedToDefault();
      safeSendToRenderer('update-not-available', { reinstallFailed: true, version: v, detail: msg });
      return;
    }
    safeSendToRenderer('update-error', msg);
  } catch (e) {
    console.error('updater error handler crashed:', e && e.message);
  }
});

ipcMain.on('install-update', () => {
  clearReinstallSession();
  autoUpdater.quitAndInstall();
});

ipcMain.on('reinstall-current-release', () => {
  try {
    beginReinstallCurrentVersion();
    scheduleUpdateCheck(80);
  } catch (err) {
    clearReinstallSession();
    resetUpdaterFeedToDefault();
    safeSendToRenderer('update-error', err && err.message ? err.message : String(err));
  }
});

let updateCheckTimer = null;
function scheduleUpdateCheck(delayMs) {
  if (updateCheckTimer) clearTimeout(updateCheckTimer);
  updateCheckTimer = setTimeout(function () {
    updateCheckTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      autoUpdater.checkForUpdates().catch(function (err) {
        // intentional: ignore if window closed or updater busy during scheduled check
        if (process.env.R_PLUS_DEBUG_UPDATER === '1') {
          console.warn('[updater] scheduled check failed:', err && err.message);
        }
      });
    } catch (_e) { /* noop */ }
  }, typeof delayMs === 'number' ? delayMs : 400);
}

ipcMain.on('check-for-updates', () => {
  scheduleUpdateCheck(80);
});

ipcMain.on('downgrade-to-stable', (_e, version) => {
  try {
    beginDowngradeToVersion(version);
    scheduleUpdateCheck(80);
  } catch (err) {
    safeSendToRenderer('downgrade-failed', {
      version: String(version || ''),
      code: 'invalid-target',
      message: err && err.message ? err.message : String(err),
      manualUrl: null,
    });
  }
});

ipcMain.on('reset-update-feed', () => {
  resetUpdaterFeedToDefault();
});

ipcMain.handle('open-downgrade-installer', async (_e, version) => {
  const v = String(version || '').replace(/^v/, '');
  const url = buildManualInstallerUrl(
    v,
    process.platform,
    process.platform === 'darwin' ? pickMacArch(process.arch) : 'x64'
  );
  if (!isAllowedExternalUrl(url)) return { ok: false, url };
  await shell.openExternal(url);
  return { ok: true, url };
});

ipcMain.on('relaunch-app', () => {
  try {
    app.relaunch();
  } catch (_e) {
    // ignore — fallback to exit
  }
  app.exit(0);
});

function perfConfigFilePath() {
  return path.join(app.getPath('userData'), PERF_CONFIG_FILE);
}

ipcMain.handle('get-performance-prefs', () => readPerfConfig(fs, perfConfigFilePath()));

ipcMain.handle('set-hardware-acceleration', (_e, enabled) => {
  perfConfig = writePerfConfig(fs, perfConfigFilePath(), { hardwareAcceleration: !!enabled });
  return perfConfig;
});

// Canal de actualización (pre-releases "beta" | estable). Persistido en userData y en localStorage del renderer.
ipcMain.on('set-update-channel', (_e, channel) => {
  const normalized = writeUpdateChannelToDisk(channel);
  applyUpdateChannel(normalized);
});

ipcMain.handle('get-platform', () => process.platform);

ipcMain.handle('open-external', async (_e, url) => {
  if (!isAllowedExternalUrl(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-native-runtime-status', () => {
  const probe = probeNativeRuntime();
  const detail = (probe.failures || [])
    .map((f) => (f.module ? `${f.module}: ${f.message || ''}` : f.message || ''))
    .filter(Boolean)
    .join('\n');
  return {
    ok: probe.ok,
    userMessage: probe.userMessage,
    message: probe.userMessage,
    detail: detail || null,
    failures: probe.failures || [],
  };
});

ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('open-user-data-folder', async () => {
  const p = app.getPath('userData');
  const err = await shell.openPath(p);
  return { ok: !err, path: p, error: err || null };
});

let approvedOutputDir = null;

function defaultDownloadsDir() {
  return app.getPath('downloads');
}

async function validateOutputDir(dir) {
  const target = dir && String(dir).trim() ? path.resolve(String(dir).trim()) : defaultDownloadsDir();
  await fs.promises.access(target, fs.constants.W_OK);
  return target;
}

ipcMain.handle('set-approved-output-dir', async (_e, dir) => {
  try {
    approvedOutputDir = await validateOutputDir(dir);
    writeApprovedOutputDir(app.getPath('userData'), approvedOutputDir);
    const dbManager = getLanDbManager();
    if (dbManager && dbManager.isUnlocked()) {
      await dbManager.auditOnly('system.output_dir.register', {
        basename: path.basename(approvedOutputDir),
      });
    }
    return { ok: true, path: approvedOutputDir };
  } catch (e) {
    approvedOutputDir = null;
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('save-exported-document', async (_e, { fileName, buffer }) => {
  const dir = approvedOutputDir || defaultDownloadsDir();
  const safe = path.basename(String(fileName || ''));
  if (!safe || safe !== fileName) {
    throw new Error('Nombre de archivo inválido');
  }
  await fs.promises.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, safe);
  const resolvedDir = await fs.promises.realpath(dir);
  await fs.promises.writeFile(fullPath, Buffer.from(buffer));
  const resolvedFile = await fs.promises.realpath(fullPath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    await fs.promises.unlink(fullPath).catch(() => {});
    throw new Error('Ruta de exportación no permitida');
  }
  return { success: true, path: resolvedFile };
});

const docExport = require('./lib/doc-export-service.js');
const { logDocExport } = require('./lib/doc-export-audit.js');

ipcMain.handle('generate-document', async (_e, { kind, payload }) => {
  const paths = {
    userDataPath: app.getPath('userData'),
    downloadsPath: app.getPath('downloads'),
  };
  try {
    switch (kind) {
      case 'note': {
        const { buffer, fileName } = await docExport.exportNoteDocx(payload || {});
        logDocExport({ type: 'nota', patient: payload && payload.patient, status: 200, bytes: buffer.length });
        return { ok: true, fileName, buffer };
      }
      case 'indicaciones': {
        const { buffer, fileName } = await docExport.exportIndicacionesDocx(payload || {});
        logDocExport({ type: 'indicaciones', patient: payload && payload.patient, status: 200, bytes: buffer.length });
        return { ok: true, fileName, buffer };
      }
      case 'listado': {
        const { buffer, fileName } = await docExport.exportListadoDocx(payload || {});
        logDocExport({ type: 'listado', patient: payload && payload.patient, status: 200, bytes: buffer.length });
        return { ok: true, fileName, buffer };
      }
      case 'censo': {
        const { buffer, fileName } = await docExport.exportCensoPdf(payload || {}, paths);
        logDocExport({ type: 'censo', status: 200, bytes: buffer.length });
        return { ok: true, fileName, buffer };
      }
      case 'receta-hu': {
        const { buffer, fileName } = await docExport.exportRecetaHuPdf(payload || {});
        logDocExport({ type: 'receta-hu', patient: payload && payload.patient, status: 200, bytes: buffer.length });
        return { ok: true, fileName, buffer };
      }
      default:
        return { ok: false, error: 'Tipo de documento no soportado.' };
    }
  } catch (e) {
    return {
      ok: false,
      error: (e && e.message) || 'No se pudo generar el documento. Intenta de nuevo.',
      code: e && e.code ? e.code : undefined,
    };
  }
});

ipcMain.handle('select-output-dir', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return undefined;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Elegir carpeta para documentos',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return undefined;
  const chosen = result.filePaths[0];
  try {
    approvedOutputDir = await validateOutputDir(chosen);
    writeApprovedOutputDir(app.getPath('userData'), approvedOutputDir);
  } catch (_e) {
    /* renderer may call set-approved-output-dir after save */
  }
  return chosen;
});

ipcMain.handle('lan-host-write-team-code', (_e, plain) => {
  try {
    const userData = app.getPath('userData');
    const token = String(plain || '').trim();
    const filePath = path.join(userData, 'lan-team-code.txt');
    fs.writeFileSync(filePath, token, 'utf8');
    const { reconcileLanHostTeamCode } = require('./lan-squad/effective-team-code.js');
    const dbManager = getLanDbManager();
    const db =
      dbManager && typeof dbManager.isUnlocked === 'function' && dbManager.isUnlocked()
        ? dbManager.getDb()
        : null;
    reconcileLanHostTeamCode({
      hostStatePath: path.join(userData, 'lan-squad-host-state.json'),
      plainToken: token,
      db,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

/** Borra el estado del host LAN (salas/pacientes en ese JSON). Útil tras error HTTP 500 por cambio de código. */
ipcMain.handle('lan-reset-squad-host-state', () => {
  try {
    const userData = app.getPath('userData');
    const filePath = path.join(userData, 'lan-squad-host-state.json');
    const hostStateDir = path.join(userData, 'lan-host');
    if (fs.existsSync(hostStateDir)) {
      fs.rmSync(hostStateDir, { recursive: true, force: true });
    }
    for (const suffix of ['', '.pre-shard-backup', '.migrated']) {
      const p = suffix ? `${filePath}${suffix}` : filePath;
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('lan-get-effective-team-code', () => {
  try {
    const { readLanTeamCodeFile } = require('./lan-squad/effective-team-code.js');
    return readLanTeamCodeFile({ userDataPath: app.getPath('userData') });
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

const { createLanMdnsService, buildTeamHashSync } = require('./lan-squad/lan-mdns-service.js');
const { createUdpBeacon } = require('./lan-squad/lan-udp-beacon.js');
const crypto = require('node:crypto');

let _lanMdnsService = null;
let _udpBeacon = null;

function ensureLanMdnsClientId(userDataPath) {
  const idPath = path.join(String(userDataPath || ''), 'lan-mdns-client-id.txt');
  try {
    const existing = fs.readFileSync(idPath, 'utf8').trim();
    if (existing) return existing;
  } catch (_e) { /* ignored */ }
  const id = `lc_main_${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(idPath, id + '\n', 'utf8');
  } catch (_e) { /* ignored */ }
  return id;
}

function startLanMdnsIfHosting() {
  try {
    const userData = app.getPath('userData');
    const { readLanTeamCodeFile } = require('./lan-squad/effective-team-code.js');
    const teamResult = readLanTeamCodeFile({ userDataPath: userData });
    if (!teamResult?.ok || !teamResult.code) return;
    const { readHostClinicalMeta } = require('./lan-squad/host-clinical-meta.js');
    const meta = readHostClinicalMeta(userData) || {};
    const clientId = ensureLanMdnsClientId(userData);
    const startedAt = meta.startedAt || Date.now();
    const rank = meta.rank || 'R1';
    const teamHash = buildTeamHashSync(teamResult.code);
    if (_lanMdnsService) _lanMdnsService.stop();
    _lanMdnsService = createLanMdnsService({ clientId, startedAt, rank, teamHash }, (peers) => {
      const json = JSON.stringify(peers || []);
      const now = Date.now();
      if (json === _lastMdnsPeersJson && now - _lastMdnsPeersSentAt < 2000) return;
      _lastMdnsPeersJson = json;
      _lastMdnsPeersSentAt = now;
      safeSendToRenderer('lan:mdns-peers', peers);
    });
    _lanMdnsService.start();
  } catch (_e) {
    // Non-critical — mDNS unavailable (e.g. firewall, no network)
  }
}

function startUdpBeaconIfHosting() {
  try {
    const userData = app.getPath('userData');
    const { readLanTeamCodeFile } = require('./lan-squad/effective-team-code.js');
    const teamResult = readLanTeamCodeFile({ userDataPath: userData });
    if (!teamResult?.ok || !teamResult.code) return;
    const { readHostClinicalMeta } = require('./lan-squad/host-clinical-meta.js');
    const meta = readHostClinicalMeta(userData) || {};
    const clientId = ensureLanMdnsClientId(userData);
    const startedAt = meta.startedAt || Date.now();
    const rank = meta.rank || 'R1';
    const teamHash = buildTeamHashSync(teamResult.code);
    if (_udpBeacon) _udpBeacon.stop();
    _udpBeacon = createUdpBeacon({ clientId, startedAt, rank, teamHash, port: 3739 });
    _udpBeacon.startListening().catch(() => {});
  } catch (_e) {
    // Non-critical — UDP beacon unavailable
  }
}

/** Persist guest Bearer from auth/exchange into userData for auto-reconnect (Electron guest only). */
ipcMain.handle('lan-ensure-server-ready', async () => {
  const lanServer = require('./server');
  const peerMode = process.env.R_PLUS_LAN_PEER === '1';
  try {
    await lanServer.startLanServer();
  } catch (lanErr) {
    const portBusy =
      (lanErr && lanErr.code === 'EADDRINUSE') ||
      (lanErr && lanErr.message && String(lanErr.message).includes('3738'));
    if (!(peerMode && portBusy)) throw lanErr;
  }
  if (!peerMode) {
    try {
      const { ensureHostStartedAt } = require('./lan-squad/host-clinical-meta.js');
      ensureHostStartedAt(app.getPath('userData'));
    } catch (_e) {
      // non-fatal — renderer may sync meta later
    }
    startLanMdnsIfHosting();
    startUdpBeaconIfHosting();
    try {
      const lanServer = require('./server');
      const reg =
        typeof lanServer.getLanWardHostRegistry === 'function'
          ? lanServer.getLanWardHostRegistry()
          : getWardHostRegistryForIpc();
      reg.seedFromCandidateBaseUrl(pickLanCandidateBaseUrl());
    } catch (_wardSeed) { /* ignored */ }
  }
  return { ok: true, peer: peerMode };
});

ipcMain.handle('lan-udp-discover', async () => {
  if (!_udpBeacon) return [];
  return _udpBeacon.discover(500);
});

/** Dev peer window (npm run dev:lan-peer-app): seed LAN client config toward local host. */
ipcMain.handle('lan-dev-peer-seed-config', () => {
  if (process.env.R_PLUS_LAN_PEER !== '1') return { ok: false };
  const hostUrl = String(process.env.R_PLUS_LAN_DEV_PEER_HOST || 'http://127.0.0.1:3738').trim();
  const teamCode = String(process.env.R_PLUS_LAN_DEV_PEER_CODE || '').trim();
  if (!hostUrl || teamCode.length < 32) return { ok: false };
  return { ok: true, hostUrl, teamCode };
});

ipcMain.handle('lan-sync-host-clinical-meta', (_e, payload) => {
  try {
    const { writeHostClinicalMeta } = require('./lan-squad/host-clinical-meta.js');
    const body = writeHostClinicalMeta(app.getPath('userData'), payload || {});
    return { ok: true, meta: body };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('lan-guest-write-bearer', (_e, payload) => {
  const token = String(payload?.token || '').trim();
  if (!token || token.length < 32) return { ok: false, error: 'invalid_token' };
  try {
    const userData = app.getPath('userData');
    const {
      writeLanGuestBearerFile,
      recoverLocalHostTeamCodeIfGuestOverwrite,
      lanTeamCodePath,
    } = require('./lan-squad/effective-team-code.js');
    const hostStatePath = path.join(userData, 'lan-squad-host-state.json');
    const dbManager = getLanDbManager();
    const db =
      dbManager && typeof dbManager.isUnlocked === 'function' && dbManager.isUnlocked()
        ? dbManager.getDb()
        : null;
    const written = writeLanGuestBearerFile({ userDataPath: userData, token });
    if (!written.ok) return written;
    // Heal 7.2.0 bug: guest bearer had overwritten lan-team-code.txt.
    let hostToken = '';
    try {
      hostToken = fs.readFileSync(lanTeamCodePath(userData), 'utf8').split(/\r?\n/, 1)[0].trim();
    } catch (_e) { /* ignored */ }
    if (hostToken && hostToken === token) {
      recoverLocalHostTeamCodeIfGuestOverwrite({ userDataPath: userData, hostStatePath, db });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('lan-get-guest-bearer', () => {
  try {
    const { readLanGuestBearerFile } = require('./lan-squad/effective-team-code.js');
    return readLanGuestBearerFile({ userDataPath: app.getPath('userData') });
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

const {
  pickLanCandidateBaseUrl,
  listPrivateIpv4SubnetPrefixes,
} = require('./lan-squad/lan-candidate-url.js');
const { createLanNetworkWatch } = require('./lan-squad/lan-network-watch.js');
const { createWardHostRegistry } = require('./lan-squad/ward-host-registry.js');

let _wardHostRegistryIpc = null;
function getWardHostRegistryForIpc() {
  if (!_wardHostRegistryIpc) {
    _wardHostRegistryIpc = createWardHostRegistry({
      filePath: path.join(app.getPath('userData'), 'lan-ward-host-registry.json'),
    });
  }
  return _wardHostRegistryIpc;
}

ipcMain.handle('get-lan-candidate-base-url', () => pickLanCandidateBaseUrl());

ipcMain.handle('get-lan-subnet-prefixes', () => listPrivateIpv4SubnetPrefixes());

ipcMain.handle('lan-ward-host-record', (_e, payload) => {
  try {
    const url = String(payload && payload.url ? payload.url : '').trim();
    if (!url) return { ok: false, error: 'missing_url' };
    getWardHostRegistryForIpc().recordUrl(url, {
      source: payload && payload.source === 'client' ? 'client' : 'host',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('lan-ward-host-merge', (_e, hints) => {
  try {
    getWardHostRegistryForIpc().merge(hints && typeof hints === 'object' ? hints : {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('lan-ward-host-clear', () => {
  try {
    getWardHostRegistryForIpc().clear();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

let _lastMdnsPeersJson = '';
let _lastMdnsPeersSentAt = 0;

const lanNetworkWatch = createLanNetworkWatch((payload) => {
  try {
    const reg = getWardHostRegistryForIpc();
    if (payload.candidateBaseUrl) {
      reg.recordUrl(payload.candidateBaseUrl, { source: 'host' });
    }
    if (Array.isArray(payload.prefixes)) {
      for (const p of payload.prefixes) reg.recordPrefix(p);
    }
  } catch (_wardNet) { /* ignored */ }
  safeSendToRenderer('lan-network-changed', payload);
  if (_lanMdnsService) {
    if (payload.candidateBaseUrl) {
      _lanMdnsService.restart(payload.candidateBaseUrl);
    } else {
      _lanMdnsService.stop();
    }
  }
}, { intervalMs: 10000 });

ipcMain.handle('clipboard-write-text', (_e, text) => {
  try {
    clipboard.writeText(String(text == null ? '' : text));
    return true;
  } catch (_err) {
    return false;
  }
});

ipcMain.handle('lab-repo-fetch', async (_e, payload) => {
  try {
    const { fetchLabRepoStudies } = await import('./lib/lab-repo/lab-repo-fetch.mjs');
    return await fetchLabRepoStudies(payload);
  } catch (err) {
    return {
      studies: [],
      errors: [{ folio: '', message: String(err?.message || err) }],
    };
  }
});
function getTargetWebContents() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused.webContents;
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  return wins.length ? wins[0].webContents : null;
}

/** Avoid menu `role:` handlers — they call webContents.getFocusedWebContents() and can crash if no window yet. */
function webContentsMenuAction(method) {
  return () => {
    try {
      const wc = getTargetWebContents();
      if (!wc || wc.isDestroyed()) return;
      const fn = wc[method];
      if (typeof fn === 'function') fn.call(wc);
    } catch (err) {
      console.warn('[menu]', method, err && err.message ? err.message : err);
    }
  };
}

function buildMenu() {
  const version = app.getVersion();
  const isMac = process.platform === 'darwin';
  const checkUpdate = () => scheduleUpdateCheck(80);

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: `Cardionotas v${version}`, enabled: false },
        { type: 'separator' },
        { label: 'Buscar actualizaciones…', click: checkUpdate },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    }] : []),
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: webContentsMenuAction('undo') },
        { label: 'Rehacer', accelerator: 'Shift+CmdOrCtrl+Z', click: webContentsMenuAction('redo') },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', click: webContentsMenuAction('cut') },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', click: webContentsMenuAction('copy') },
        { label: 'Pegar', accelerator: 'CmdOrCtrl+V', click: webContentsMenuAction('paste') },
        { label: 'Seleccionar todo', accelerator: 'CmdOrCtrl+A', click: webContentsMenuAction('selectAll') },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Herramientas de desarrollador', accelerator: 'Alt+CmdOrCtrl+I', click: webContentsMenuAction('toggleDevTools') },
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: webContentsMenuAction('reload') },
        { label: 'Forzar recarga', accelerator: 'Shift+CmdOrCtrl+R', click: webContentsMenuAction('reloadIgnoringCache') },
      ],
    },
    {
      label: 'Aplicación',
      submenu: [
        ...(!isMac ? [
          { label: `Cardionotas v${version}`, enabled: false },
          { type: 'separator' },
          { label: 'Buscar actualizaciones…', click: checkUpdate },
          { type: 'separator' },
        ] : []),
        ...(!isMac ? [
          { type: 'separator' },
          { role: 'quit', label: 'Salir' },
        ] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Startup ───────────────────────────────────────────────────────
let unlockPromise;

/** @param {{ ensureUnlocked: () => Promise<unknown> }} dbManager */
async function unlockClinicalDbAtStartup(dbManager) {
  const maxAttempts = process.platform === 'win32' ? 8 : 3;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await dbManager.ensureUnlocked();
      return;
    } catch (unlockErr) {
      lastErr = unlockErr;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200 + attempt * 250));
      }
    }
  }
  throw lastErr || new Error('Clinical DB auto-open failed');
}

app.whenReady().then(async () => {
  try {
    installElectronLanCors(session.defaultSession);
    process.env.R_PLUS_USER_DATA = app.getPath('userData');
    applyUpdateChannel(readUpdateChannelFromDisk());
    captureDefaultUpdaterFeed();

    const { loadNativeDatabase } = await import('./lib/db/native-load.mjs');
    try {
      loadNativeDatabase();
    } catch (nativeErr) {
      const detail =
        nativeErr && nativeErr.message
          ? nativeErr.message
          : 'No se pudo cargar el módulo nativo de base de datos (SQLCipher).';
      dialog.showErrorBox('Cardionotas no pudo iniciar', detail);
      app.quit();
      return;
    }

    const { createDbManager } = await import('./lib/db/db-manager.mjs');
    const dbManager = createDbManager({
      userDataPath: app.getPath('userData'),
      safeStorage,
      getClientId: () => 'desktop-host',
    });
    setLanDbManager(dbManager);

    const { registerDbIpcHandlers } = await import('./lib/db/ipc-handlers.mjs');
    registerDbIpcHandlers({
      ipcMain,
      dbManager,
      app,
      dialog,
      safeStorage,
      getClientId: () => 'desktop-host',
    });

    unlockPromise = unlockClinicalDbAtStartup(dbManager);

    const lanServer = require('./server');
    if (typeof lanServer.setOnInternoHostSync === 'function') {
      lanServer.setOnInternoHostSync((payload) => {
        safeSendToRenderer('rpc-interno-host-sync', payload);
      });
    }
    try {
      server = await lanServer.startLanServer();
    } catch (lanErr) {
      const peerMode = process.env.R_PLUS_LAN_PEER === '1';
      const portBusy =
        (lanErr && lanErr.code === 'EADDRINUSE') ||
        (lanErr && lanErr.message && String(lanErr.message).includes('3738'));
      if (peerMode && portBusy) {
        console.warn(
          '[R+ LAN peer mode] Puerto 3738 en uso — esta ventana usará el servidor LAN del anfitrión ya abierto.'
        );
      } else {
        throw lanErr;
      }
    }
    if (unlockPromise) await unlockPromise;

    if (process.env.R_PLUS_RECOVER_CENSUS === '1') {
      try {
        const { runRecoverCensusExport } = await import('./scripts/recover-census-export.mjs');
        const result = await runRecoverCensusExport({ app, dbManager });
        dialog.showMessageBox({
          type: 'info',
          title: 'Recuperación de censo',
          message:
            'Exportados ' +
            result.count +
            ' paciente(s) a Descargas.\n\nImporta con Ajustes → Importar rango…',
        });
      } catch (recoverErr) {
        dialog.showErrorBox(
          'Recuperación de censo',
          recoverErr && recoverErr.message ? recoverErr.message : String(recoverErr)
        );
      }
      app.quit();
      return;
    }

    try {
      const userData = app.getPath('userData');
      const { readLanTeamCodeFile, reconcileLanHostTeamCode } = require('./lan-squad/effective-team-code.js');
      const team = readLanTeamCodeFile({ userDataPath: userData });
      if (team.ok && team.code) {
        reconcileLanHostTeamCode({
          hostStatePath: path.join(userData, 'lan-squad-host-state.json'),
          plainToken: team.code,
          db: dbManager.isUnlocked() ? dbManager.getDb() : null,
        });
      }
    } catch (reconcileErr) {
      console.error('[lan]', reconcileErr && reconcileErr.message ? reconcileErr.message : reconcileErr);
    }
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    dialog.showErrorBox(
      'Cardionotas no pudo iniciar',
      detail
    );
    app.quit();
    return;
  }
  createWindow();
  buildMenu();
  lanNetworkWatch.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function destroyAllBrowserWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.destroy();
  }
}

let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  quitting = true;
  lanNetworkWatch.stop();
  const lanServer = require('./server');
  event.preventDefault();

  const QUIT_DEADLINE_MS = 4000;
  const forceExitTimer = setTimeout(() => app.exit(0), QUIT_DEADLINE_MS);
  if (typeof forceExitTimer.unref === 'function') forceExitTimer.unref();

  const flushCap = new Promise((r) => setTimeout(r, 3000));
  Promise.race([lanServer.flushHostStoreNow().catch(() => {}), flushCap])
    .then(() => {
      // Renderer loads from localhost:3738 — drop windows before httpServer.close().
      destroyAllBrowserWindows();
      return lanServer.stopLanServer();
    })
    .finally(() => {
      clearTimeout(forceExitTimer);
      app.exit(0);
    });
});
