import {
  assertEquiposAuth,
  assertAdminAuth,
  extractAuth,
  resolveAdminCredential,
  getEquiposProgramAccess,
  rotateEquiposProgramToken,
  setEquiposProgramActive,
} from './auth.js';
import { buildEquiposBoard, getBoardStamp, getEquiposPhoto } from './board.js';
import {
  parseAdminListQuery,
  listEquiposSessionsPaged,
  countEquiposSessions,
  listEquiposTeamReportsPaged,
  countEquiposTeamReports,
  listEquiposPeopleSummary,
  equiposHistorySinceIso,
  EQUIPOS_ADMIN_HISTORY_DAYS,
} from './admin-queries.js';
import {
  equiposCheckout,
  equiposReturn,
  equiposWaitlistJoin,
  equiposWaitlistLeave,
  equiposWaitlistSkip,
  equiposCreateAlert,
  equiposAckAlert,
  equiposAdminPurgeQueue,
} from './actions.js';
import { equiposAdminWipeHistory } from './admin-wipe.js';
import { savePhotoFromBase64, readPhotoObject } from './photos.js';
import { EquiposError, equiposErrorStatus, jsonEquiposError } from './errors.js';
import { getEquiposDevice } from './board.js';
import {
  scheduleEquiposPush,
  scheduleEquiposWaitlistHeadPush,
  scheduleEquiposWaitlistTopTwoKindPush,
  scheduleEquiposQueueBypassPush,
} from './push.js';
import {
  getVapidPublicKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushLeaveCleanup,
} from './push-routes.js';

/** @param {unknown} data @param {number} [status] */
function jsonOk(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** @param {unknown} err */
function jsonErr(err) {
  const status = equiposErrorStatus(err);
  return jsonOk(jsonEquiposError(err), status);
}

/** @param {Request} req */
async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** wrangler dev can drop waitUntil work; on localhost we await push inline instead. */
function isLocalDevRequest(req) {
  try {
    const host = new URL(req.url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * @param {Request} req
 * @param {Promise<unknown>} pushTask
 */
async function settlePushForLocalDev(req, pushTask) {
  if (isLocalDevRequest(req)) await pushTask;
}

/**
 * @param {Request} req
 * @param {import('@cloudflare/workers-types').ExecutionContext} env
 * @param {string} subpath
 */
/**
 * @param {Request} req
 * @param {import('@cloudflare/workers-types').ExecutionContext} env
 * @param {string} subpath
 * @param {import('@cloudflare/workers-types').ExecutionContext} [execCtx]
 */
export async function handleEquiposApi(req, env, subpath, execCtx) {
  const db = env.DB;
  const bucket = env.PHOTOS;
  const auth = extractAuth(req, env);
  const method = req.method;
  const vapidJwk = env.EQUIPOS_VAPID_PRIVATE_JWK;

  try {
    if (method === 'GET' && subpath === '/push/vapid-public-key') {
      const row = getVapidPublicKey(env);
      if (!row) throw new EquiposError('push_unconfigured', 'Notificaciones no configuradas.');
      return jsonOk(row);
    }

    if (method === 'GET' && subpath === '/ping') {
      return jsonOk({ ok: true, equipos: true, cloud: true, lease: null });
    }

    if (method === 'GET' && subpath === '/access/invite') {
      const row = await getEquiposProgramAccess(db);
      if (!row || row.is_active !== 1) {
        throw new EquiposError(
          'access_inactive',
          'La lista de espera no está activa.'
        );
      }
      const inviteToken = String(row.access_token || '').trim();
      if (!inviteToken) {
        throw new EquiposError(
          'access_not_ready',
          'Aún no hay enlace configurado.'
        );
      }
      return jsonOk({ ok: true, token: inviteToken });
    }

    if (method === 'GET' && subpath === '/board/stamp') {
      await assertEquiposAuth(db, auth);
      const stamp = await getBoardStamp(db);
      return jsonOk({ ok: true, stamp });
    }

    if (method === 'GET' && subpath === '/board') {
      await assertEquiposAuth(db, auth);
      const board = await buildEquiposBoard(db);
      return jsonOk({ ok: true, ...board });
    }

    if (method === 'GET' && subpath === '/reports') {
      assertAdminAuth(env, auth);
      const since = equiposHistorySinceIso(EQUIPOS_ADMIN_HISTORY_DAYS);
      const sessions = await listEquiposSessionsPaged(db, { since, limit: 100 });
      const reports = await listEquiposTeamReportsPaged(db, { since, limit: 100 });
      return jsonOk({ ok: true, sessions, reports });
    }

    if (method === 'GET' && subpath === '/admin/sessions') {
      assertAdminAuth(env, auth);
      const q = parseAdminListQuery(new URL(req.url).searchParams);
      const sessions = await listEquiposSessionsPaged(db, q);
      const total = await countEquiposSessions(db, q);
      return jsonOk({ ok: true, sessions, total, ...q, days: parseInt(new URL(req.url).searchParams.get('days') || String(EQUIPOS_ADMIN_HISTORY_DAYS), 10) });
    }

    if (method === 'GET' && subpath === '/admin/reports-list') {
      assertAdminAuth(env, auth);
      const q = parseAdminListQuery(new URL(req.url).searchParams);
      const reports = await listEquiposTeamReportsPaged(db, q);
      const total = await countEquiposTeamReports(db, q);
      return jsonOk({ ok: true, reports, total, ...q, days: parseInt(new URL(req.url).searchParams.get('days') || String(EQUIPOS_ADMIN_HISTORY_DAYS), 10) });
    }

    if (method === 'GET' && subpath === '/admin/people') {
      assertAdminAuth(env, auth);
      const q = parseAdminListQuery(new URL(req.url).searchParams);
      const people = await listEquiposPeopleSummary(db, { since: q.since });
      return jsonOk({ ok: true, people, since: q.since, days: parseInt(new URL(req.url).searchParams.get('days') || String(EQUIPOS_ADMIN_HISTORY_DAYS), 10) });
    }

    if (method === 'GET' && subpath.startsWith('/photos/')) {
      await assertEquiposAuth(db, auth);
      const photoId = subpath.slice('/photos/'.length);
      const row = await getEquiposPhoto(db, photoId);
      if (!row?.file_path) throw new EquiposError('not_found', 'Foto no encontrada.');
      const obj = await readPhotoObject(bucket, row.file_path);
      if (!obj) throw new EquiposError('not_found', 'Foto no encontrada.');
      return new Response(obj.body, {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
      });
    }

    if (method === 'GET' && subpath === '/admin/ping') {
      assertAdminAuth(env, auth);
      return jsonOk({ ok: true, admin: true });
    }

    if (method === 'GET' && subpath === '/admin/access') {
      assertAdminAuth(env, auth);
      const row = await getEquiposProgramAccess(db);
      return jsonOk({ ok: true, row });
    }

    const body = method === 'GET' ? {} : await readJson(req);

    if (method === 'POST' && subpath === '/admin/verify') {
      const credential = resolveAdminCredential(req, env, body);
      assertAdminAuth(env, credential);
      return jsonOk({ ok: true, admin: true });
    }

    if (method === 'POST' && subpath === '/admin/access/rotate') {
      assertAdminAuth(env, auth);
      const row = await rotateEquiposProgramToken(db, body.rotatedBy || 'admin');
      return jsonOk({ ok: true, row });
    }

    if (method === 'POST' && subpath === '/admin/access/set-active') {
      assertAdminAuth(env, auth);
      const row = await setEquiposProgramActive(db, !!body.active);
      return jsonOk({ ok: true, row });
    }

    if (method === 'POST' && subpath === '/checkout') {
      await assertEquiposAuth(db, auth);
      let pickupPhotoId = null;
      if (body.photoBase64) {
        pickupPhotoId = await savePhotoFromBase64(body.photoBase64, {
          deviceType: body.deviceType,
          photoKind: 'pickup',
        }, bucket, db);
      }
      const out = await equiposCheckout(db, { ...body, pickupPhotoId });
      if (out.queueBypassed && out.notifyWaitlist?.length) {
        const pushTask = scheduleEquiposQueueBypassPush(
          db,
          execCtx,
          {
            deviceType: out.deviceType,
            takerName: body.reporterName,
            takerRotation: body.rotation,
            waitlistRows: out.notifyWaitlist,
          },
          vapidJwk
        );
        await settlePushForLocalDev(req, pushTask);
      }
      return jsonOk({ ok: true, ...out });
    }

    if (method === 'POST' && subpath === '/return') {
      await assertEquiposAuth(db, auth);
      let returnPhotoId = null;
      if (body.photoBase64) {
        returnPhotoId = await savePhotoFromBase64(body.photoBase64, {
          deviceType: body.deviceType,
          photoKind: 'return',
        }, bucket, db);
      }
      const out = await equiposReturn(db, { ...body, returnPhotoId });
      const kind = out.deviceType === 'lumify' ? 'lumify_return' : 'device_available';
      const pushTask = scheduleEquiposWaitlistTopTwoKindPush(
        db,
        execCtx,
        kind,
        {
          deviceType: out.deviceType,
          chargePct: body.chargePct != null ? Number(body.chargePct) : null,
        },
        vapidJwk
      );
      await settlePushForLocalDev(req, pushTask);
      return jsonOk({ ok: true, ...out });
    }

    if (method === 'POST' && subpath === '/waitlist/join') {
      await assertEquiposAuth(db, auth);
      const out = await equiposWaitlistJoin(db, body);
      return jsonOk({ ok: true, ...out });
    }

    if (method === 'POST' && subpath === '/waitlist/leave') {
      await assertEquiposAuth(db, auth);
      await equiposWaitlistLeave(db, body);
      await handlePushLeaveCleanup(env, body);
      return jsonOk({ ok: true });
    }

    if (method === 'POST' && subpath === '/waitlist/skip') {
      await assertEquiposAuth(db, auth);
      const out = await equiposWaitlistSkip(db, body);
      if (out.wasNext && body?.deviceType) {
        const pushTask = scheduleEquiposWaitlistHeadPush(db, execCtx, body.deviceType, vapidJwk);
        await settlePushForLocalDev(req, pushTask);
      }
      return jsonOk({ ok: true, ...out });
    }

    if (method === 'POST' && subpath === '/push/subscribe') {
      await assertEquiposAuth(db, auth);
      const out = await handlePushSubscribe(req, env, body);
      return jsonOk(out);
    }

    if (method === 'POST' && subpath === '/push/unsubscribe') {
      await assertEquiposAuth(db, auth);
      const out = await handlePushUnsubscribe(env, body);
      return jsonOk(out);
    }

    if (method === 'POST' && subpath === '/alert') {
      await assertEquiposAuth(db, auth);
      let photoId = null;
      if (body.photoBase64) {
        photoId = await savePhotoFromBase64(body.photoBase64, {
          deviceType: body.deviceType,
          photoKind: 'alert',
        }, bucket, db);
      }
      const out = await equiposCreateAlert(db, { ...body, photoId });
      const alertKind = body.kind === 'malfunction' ? 'malfunction' : 'missing_material';
      const pushTask = scheduleEquiposPush(db, execCtx, alertKind, {
        deviceType: body.deviceType,
        message: body.message,
      }, vapidJwk);
      await settlePushForLocalDev(req, pushTask);
      return jsonOk({ ok: true, ...out });
    }

    if (method === 'POST' && subpath.startsWith('/alert/') && subpath.endsWith('/ack')) {
      await assertEquiposAuth(db, auth);
      const reportId = subpath.slice('/alert/'.length, -'/ack'.length);
      const reportRow = await db
        .prepare(`SELECT device_type FROM equipos_team_reports WHERE id = ?`)
        .bind(reportId)
        .first();
      await equiposAckAlert(db, reportId, body);
      if (reportRow?.device_type) {
        const dev = await getEquiposDevice(db, reportRow.device_type);
        if (dev?.status === 'available') {
          const pushTask = scheduleEquiposPush(db, execCtx, 'device_available', {
            deviceType: reportRow.device_type,
          }, vapidJwk);
          await settlePushForLocalDev(req, pushTask);
        }
      }
      return jsonOk({ ok: true });
    }

    if (method === 'POST' && subpath === '/admin/purge-queue') {
      if (!auth.isAdmin) await assertEquiposAuth(db, auth);
      else assertAdminAuth(env, auth);
      const results = await equiposAdminPurgeQueue(db, {
        deviceType: body.deviceType || 'all',
        adminUserId: body.adminUserId,
        adminName: body.adminName,
      });
      for (const r of results) {
        if (r.hadCustody || r.cleared > 0) {
          const pushTask = scheduleEquiposPush(db, execCtx, 'device_available', {
            deviceType: r.deviceType,
          }, vapidJwk);
          await settlePushForLocalDev(req, pushTask);
        }
      }
      return jsonOk({ ok: true, results });
    }

    if (method === 'POST' && subpath === '/admin/wipe-history') {
      assertAdminAuth(env, auth);
      const out = await equiposAdminWipeHistory(db, bucket, {
        adminUserId: body.adminUserId,
        adminName: body.adminName,
      });
      return jsonOk({ ok: true, ...out });
    }

    return jsonOk({ error: 'not_found', message: 'Ruta no encontrada.' }, 404);
  } catch (e) {
    if (e instanceof EquiposError) return jsonErr(e);
    return jsonOk({ error: 'server_error', message: e?.message || 'Error interno.' }, 500);
  }
}
