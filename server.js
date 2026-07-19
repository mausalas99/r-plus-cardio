const express = require('express');
const http    = require('node:http');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { execSync } = require('child_process');
const docExport = require('./lib/doc-export-service.js');
const { sendDocxBuffer, sendPdfBuffer } = require('./lib/doc-export-http.js');
const { logDocExport } = require('./lib/doc-export-audit.js');
const { createHostStore } = require('./lan-squad/host-store.js');
const { createLanRouter } = require('./lan-squad/host-router.js');
const { createClientIdentityStore } = require('./lan-squad/client-identity-store.js');
const { attachWsHub } = require('./lan-squad/ws-hub.js');
const { createConflictResolver } = require('./lan-squad/conflict-resolver.js');
const { bootstrapLanTeamCode } = require('./lan-squad/effective-team-code.js');
const { pickLanCandidateBaseUrl } = require('./lan-squad/lan-candidate-url.js');
const { readHostClinicalMeta } = require('./lan-squad/host-clinical-meta.js');
const { createTicketStore } = require('./lan-squad/ticket-store.js');
const { createShiftPinStore } = require('./lan-squad/shift-pin-store.js');
const { createAuthRouter } = require('./lan-squad/auth-router.js');
const { createWardHostRegistry } = require('./lan-squad/ward-host-registry.js');
const { createSseHub } = require('./lan-squad/lan-sse-hub.js');
const { redactUrlSecrets, redactForLog } = require('./lan-squad/redact-secrets.js');
const {
  createDocumentExportAuthMiddleware,
  shouldSkipGlobalRateLimit,
  shouldSkipGlobalJsonBodyParser,
} = require('./lib/server-http-security.js');
const { createInternoRouter, broadcastInterno } = require('./lib/interno/interno-router.js');
const { createEquiposRouter } = require('./lib/equipos/equipos-router.js');
const { scheduleEquiposPhotoPurge } = require('./lib/equipos/equipos-photo-purge.mjs');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const appExpress = express();
const globalJsonBodyParser = express.json({ limit: '2mb' });
appExpress.use((req, res, next) => {
  if (shouldSkipGlobalJsonBodyParser(req)) return next();
  return globalJsonBodyParser(req, res, next);
});

const LAN_HTTP_PORT = 3738;

function isPrivateIpv4Host(host) {
  const h = String(host || '').split(':')[0];
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Permite fetch/WebSocket desde el mismo host (p. ej. iPad en http://192.168.x.x:3738). */
function isAllowedLanCorsOrigin(originUrl, requestHost) {
  if (!originUrl || !requestHost) return false;
  const oh = String(originUrl.host || '').toLowerCase();
  const rh = String(requestHost || '').toLowerCase();
  if (oh === rh) return true;
  if (oh === `localhost:${LAN_HTTP_PORT}` || oh === `127.0.0.1:${LAN_HTTP_PORT}`) return true;
  const reqIp = rh.split(':')[0];
  const originIp = String(originUrl.hostname || '').toLowerCase();
  if (isPrivateIpv4Host(originIp) && isPrivateIpv4Host(reqIp)) return true;
  return false;
}

/** CORS antes del rate limiter para que 429/OPTIONS sigan exponiendo Access-Control-Allow-Origin. */
function applyLanCorsHeaders(req, res) {
  const rawOrigin = req.headers.origin;
  if (!rawOrigin) return;
  try {
    const originUrl = new URL(rawOrigin);
    if (isAllowedLanCorsOrigin(originUrl, req.headers.host)) {
      res.setHeader('Access-Control-Allow-Origin', rawOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Interno-Token, X-Interno-Sala, X-Equipos-Token');
    }
  } catch (_e) {
    // Ignore malformed Origin headers and continue normal handling.
  }
}

appExpress.use((req, res, next) => {
  applyLanCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

/** frame-ancestors only applies via HTTP headers (ignored in <meta> CSP). */
appExpress.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
});

const rateLimitHandler = (req, res) => {
  applyLanCorsHeaders(req, res);
  res.status(429).json({ error: 'rate_limit_exceeded' });
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: shouldSkipGlobalRateLimit,
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

appExpress.use(globalLimiter);

appExpress.use((req, _res, next) => {
  req.__safeForLog = {
    method: req.method,
    path: redactUrlSecrets(req.originalUrl || req.url || ''),
  };
  next();
});

appExpress.get('/join', (_req, res) => {
  res.redirect(302, '/mobile/');
});

appExpress.get('/join/:ticketId', (req, res) => {
  if (!/^req_[a-f0-9]{12}$/i.test(String(req.params.ticketId || ''))) {
    return res.status(404).send('Invalid join link');
  }
  res.sendFile(path.join(__dirname, 'public', 'mobile', 'join.html'));
});

const INTERNO_SLUGS = ['sala-1', 'sala-2', 'sala-e'];
for (const slug of INTERNO_SLUGS) {
  appExpress.get(`/interno/${slug}`, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'interno', 'index.html'));
  });
}

appExpress.get('/equipos', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'equipos', 'index.html'));
});

appExpress.get('/health', (_req, res) => {
  try {
    res.json({ ok: true, app: 'r-plus' });
  } catch (e) {
    try { res.status(500).json({ ok: false, error: (e && e.message) || 'health failed' }); }
    catch (_inner) { /* response already broken; nothing else to do */ }
  }
});
/** Dev/desktop: avoid stale renderer modules after `npm run build:ui`. */
appExpress.use('/js', (req, res, next) => {
  if (/\.(mjs|js|css)(\?|$)/i.test(req.path || '')) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  }
  next();
});
appExpress.get('/manifest.webmanifest', (_req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest'));
});
appExpress.use(express.static(path.join(__dirname, 'public')));

const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const userData = process.env.R_PLUS_USER_DATA || require('node:os').tmpdir();
const lanStatePath = path.join(userData, 'lan-squad-host-state.json');
const lanHostStateDir = path.join(userData, 'lan-host');
const lanShiftPinPath = path.join(userData, 'lan-shift-pin.json');
const lanWardHostRegistryPath = path.join(userData, 'lan-ward-host-registry.json');
const equiposPhotosDir = path.join(userData, 'equipos-photos');

let lanBoot;
try {
  lanBoot = bootstrapLanTeamCode({ userDataPath: userData, hostStatePath: lanStatePath });
} catch (e) {
  console.error('[lan]', redactForLog({ message: e && e.message, code: e && e.code }));
  process.exit(1);
}

appExpress.locals.lanRequiresMigrationNotice = lanBoot.requiresMigrationNotice;
const LAN_TEAM_CODE = lanBoot.token;

const { getLanDbManager } = require('./lib/db/lan-db-bridge.cjs');
const lanDbManager = getLanDbManager();
if (lanBoot.rotated && lanDbManager && typeof lanDbManager.schedulePendingAudit === 'function') {
  lanDbManager.schedulePendingAudit('lan.token.rotate', { reason: 'weak_token_rotation' });
}
const lanStore = createHostStore({
  filePath: lanStatePath,
  hostStateDir: lanHostStateDir,
  teamCodePlain: LAN_TEAM_CODE,
  dbManager: lanDbManager,
});
const ticketStore = createTicketStore({ getHostToken: () => LAN_TEAM_CODE });
const shiftPinStore = createShiftPinStore({
  getHostToken: () => LAN_TEAM_CODE,
  filePath: lanShiftPinPath,
});
shiftPinStore.ensure();
const clientIdentityStore = createClientIdentityStore();
const wardHostRegistry = createWardHostRegistry({ filePath: lanWardHostRegistryPath });
const getLanHostUrl = () =>
  pickLanCandidateBaseUrl(LAN_HTTP_PORT) || `http://localhost:${LAN_HTTP_PORT}`;
try {
  wardHostRegistry.seedFromCandidateBaseUrl(getLanHostUrl());
} catch (_wardSeed) { /* ignored */ }

const documentExportAuth = createDocumentExportAuthMiddleware(() => lanStore.getState());

const exportPaths = () => ({ userDataPath: userData, downloadsPath: DOWNLOADS });

function docExportHttpError(res, e, meta) {
  if (meta) logDocExport(Object.assign({ status: 500, error: e && e.message }, meta));
  if (e && e.code === 'BAD_REQUEST') {
    return res.status(400).json({ error: e.message });
  }
  if (e && (e.code === 'OUTPUT_DIR_NOT_ALLOWED' || e.code === 'OUTPUT_DIR_NOT_WRITABLE')) {
    return res.status(400).json({ error: e.message });
  }
  if (!res.headersSent) {
    res.status(500).json({ error: 'No se pudo generar el documento. Intenta de nuevo.' });
  }
}

appExpress.post('/generate', generateLimiter, documentExportAuth, async (req, res) => {
  const { patient, note } = req.body;
  try {
    const { buffer, fileName } = await docExport.exportNoteDocx({ patient, note });
    sendDocxBuffer(res, { buf: buffer, fileName, type: 'nota', patient });
  } catch (e) {
    docExportHttpError(res, e, { type: 'nota', patient });
  }
});

appExpress.post('/generate-indicaciones', generateLimiter, documentExportAuth, async (req, res) => {
  const { patient, indicaciones } = req.body;
  try {
    const { buffer, fileName } = await docExport.exportIndicacionesDocx({ patient, indicaciones });
    sendDocxBuffer(res, { buf: buffer, fileName, type: 'indicaciones', patient });
  } catch (e) {
    docExportHttpError(res, e, { type: 'indicaciones', patient });
  }
});

appExpress.post('/generate-listado', generateLimiter, documentExportAuth, async (req, res) => {
  const { patient, listado, medicos } = req.body;
  try {
    const { buffer, fileName } = await docExport.exportListadoDocx({ patient, listado, medicos });
    sendDocxBuffer(res, { buf: buffer, fileName, type: 'listado', patient });
  } catch (e) {
    docExportHttpError(res, e, { type: 'listado', patient });
  }
});

appExpress.post('/generate-censo', generateLimiter, documentExportAuth, async (req, res) => {
  const { header, rows, servicio } = req.body;
  try {
    const { buffer, fileName } = await docExport.exportCensoPdf({ header, rows, servicio });
    sendPdfBuffer(res, { buf: buffer, fileName, type: 'censo' });
  } catch (e) {
    docExportHttpError(res, e);
  }
});

appExpress.post('/generate-receta-hu', generateLimiter, documentExportAuth, async (req, res) => {
  const { patient, receta, doctorName, cedulaProfesional } = req.body;
  try {
    const { buffer, fileName } = await docExport.exportRecetaHuPdf({
      patient,
      receta,
      doctorName,
      cedulaProfesional,
    });
    sendPdfBuffer(res, { buf: buffer, fileName, type: 'receta-hu', patient });
  } catch (e) {
    docExportHttpError(res, e, { type: 'receta-hu', patient });
  }
});

// LAN squad (host): escucha en el puerto de abajo en todas las interfaces; los clientes
// usan http://<IP-de-esta-PC>:3738. Abre el puerto en el firewall del SO si no conecta.
// Código de equipo: variable R_PLUS_LAN_TEAM_CODE o primer línea de userData/lan-team-code.txt
// (tras cambiar el archivo, reinicia R+). Red local de confianza; sin TLS en LAN.
const PORT = LAN_HTTP_PORT;

function portInUseProcessHint(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: 'utf8' }).trim();
    if (!out) return '';
    const pid = out.split('\n')[0];
    let detail = '';
    try {
      detail = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim();
    } catch (_e) {
      /* ignore */
    }
    return detail ? ` (PID ${pid}: ${detail})` : ` (PID ${pid})`;
  } catch (_e) {
    return '';
  }
}
const authExchangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authTicketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authRouter = createAuthRouter({
  ticketStore,
  shiftPinStore,
  wardHostRegistry,
  getHostToken: () => LAN_TEAM_CODE,
  getHostUrl: getLanHostUrl,
  getRequiresMigrationNotice: () => Boolean(appExpress.locals.lanRequiresMigrationNotice),
  clientIdentityStore,
});

const httpServer = http.createServer(appExpress);
const lanResolver = createConflictResolver({ store: lanStore });
const { broadcast, close: closeWsHub } = attachWsHub(httpServer, {
  getState: () => lanStore.getState(),
  resolver: lanResolver,
});

appExpress.use('/api/lan/v1', compression({ threshold: 2048 }));
appExpress.use('/api/lan/v1', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/auth/exchange') {
    return authExchangeLimiter(req, res, next);
  }
  if (req.method === 'POST' && req.path === '/auth/tickets') {
    return authTicketLimiter(req, res, next);
  }
  next();
});
appExpress.use('/api/lan/v1', authRouter);
const sseHub = createSseHub();
const sseRouter = express.Router();
sseHub.attachSseRouter(sseRouter, { getState: () => lanStore.getState() });
appExpress.use('/api/lan/v1', sseRouter);
appExpress.use(
  '/api/lan/v1',
  createLanRouter({
    store: lanStore,
    broadcast,
    resolver: lanResolver,
    getHostClinicalMeta: () => readHostClinicalMeta(userData),
    getHealthExtras: () => {
      let revision = 0;
      try {
        revision = Number(lanStore.getState()?.bundle?.revision) || 0;
      } catch (e) {
        console.error('[lan-health]', redactForLog({ message: e && e.message, code: e && e.code }));
      }
      return {
        dbUnlocked: !!(lanDbManager?.isUnlocked?.()),
        shiftPinActive: !!(shiftPinStore.getStatus()?.active),
        clientId: (readHostClinicalMeta(userData) || {}).clientId || '',
        revision,
        repairedRoomCount: lanStore.getRepairedRoomCount?.() ?? 0,
      };
    },
    sseBroadcast: (channel, obj) => sseHub.broadcast(channel, obj),
    onClinicalOpsMerged: () => {
      const db = getClinicalDbForInterno();
      if (!db) return;
      try {
        const rows = db
          .prepare('SELECT sala FROM sala_interno_access WHERE is_active = 1')
          .all();
        for (const row of rows) {
          if (row?.sala) {
            broadcastInterno(row.sala, { type: 'board-changed', source: 'clinical-ops' });
          }
        }
      } catch (e) {
        console.error('[interno-board]', e && e.message ? e.message : e);
      }
    },
    clientIdentityStore,
  })
);

function getClinicalDbForInterno() {
  if (!lanDbManager || typeof lanDbManager.isUnlocked !== 'function') return null;
  if (!lanDbManager.isUnlocked()) return null;
  return typeof lanDbManager.getDb === 'function' ? lanDbManager.getDb() : null;
}

/** @type {(obj: object) => void} */
let onInternoHostSync = null;

function setOnInternoHostSync(fn) {
  onInternoHostSync = typeof fn === 'function' ? fn : null;
}

appExpress.use(
  '/api/interno/v1',
  createInternoRouter({
    store: lanStore,
    getDb: getClinicalDbForInterno,
    broadcastSync: broadcast,
    onHostSync: (obj) => {
      if (typeof onInternoHostSync === 'function') onInternoHostSync(obj);
    },
    httpServer: httpServer,
  })
);

appExpress.use(
  '/api/equipos/v1',
  createEquiposRouter({
    getDb: getClinicalDbForInterno,
    photosDir: equiposPhotosDir,
    httpServer: httpServer,
  })
);

appExpress.use((err, req, res, _next) => {
  console.error('[express]', redactForLog({
    message: err && err.message,
    code: err && err.code,
    ...(req.__safeForLog || {}),
  }));
  if (res.headersSent) return;
  const status = Number(err && (err.status || err.statusCode)) || 500;
  const error =
    status === 413 ? 'payload_too_large' : status === 500 ? 'internal_error' : err.message || 'request_failed';
  res.status(status).json({ error });
});

let serverInstance = null;
let listenPromise = null;

function listenErrorMessage(err) {
  if (err && err.code === 'EADDRINUSE') {
    return new Error(
      `El puerto ${PORT} ya está en uso${portInUseProcessHint(PORT)}. ` +
        'Cierra la otra instancia de R+ (o el proceso que escucha en ese puerto) y vuelve a abrir la aplicación. ' +
        'En macOS/Linux: lsof -nP -iTCP:' + PORT + ' -sTCP:LISTEN'
    );
  }
  return err;
}

function startLanServer() {
  if (serverInstance && serverInstance.listening) {
    return Promise.resolve(serverInstance);
  }
  if (listenPromise) return listenPromise;

  listenPromise = new Promise((resolve, reject) => {
    const srv = httpServer.listen(PORT, () => {
      console.log(`R+ → http://localhost:${PORT}`);
      serverInstance = srv;
      try {
        scheduleEquiposPhotoPurge(equiposPhotosDir, getClinicalDbForInterno);
      } catch (e) {
        console.error('[equipos-purge]', e && e.message ? e.message : e);
      }
      resolve(srv);
    });
    srv.once('error', (err) => {
      listenPromise = null;
      reject(listenErrorMessage(err));
    });
  });
  return listenPromise;
}

async function flushHostStoreNow() {
  if (!lanStore || typeof lanStore.flushCacheNow !== 'function') return;
  try {
    await lanStore.flushCacheNow({ serialized: true });
  } catch (e) {
    console.error('[lan-server] final flush failed:', e && e.message);
  }
}

function stopLanServer() {
  const STOP_DEADLINE_MS = 2000;

  return new Promise((resolve) => {
    const finish = () => {
      serverInstance = null;
      listenPromise = null;
      resolve();
    };
    if (!serverInstance) {
      finish();
      return;
    }
    const timer = setTimeout(finish, STOP_DEADLINE_MS);
    if (typeof timer.unref === 'function') timer.unref();

    Promise.resolve()
      .then(() => (typeof closeWsHub === 'function' ? closeWsHub() : undefined))
      .then(() => {
        if (typeof httpServer.closeAllConnections === 'function') {
          httpServer.closeAllConnections();
        }
      })
      .then(
        () =>
          new Promise((resolveClose) => {
            httpServer.close(() => resolveClose());
          })
      )
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        finish();
      });
  });
}

function getLanWardHostRegistry() {
  return wardHostRegistry;
}

module.exports = {
  startLanServer,
  stopLanServer,
  flushHostStoreNow,
  getLanWardHostRegistry,
  setOnInternoHostSync,
};
