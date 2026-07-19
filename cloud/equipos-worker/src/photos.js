import { MAX_PHOTO_BYTES, newEquiposId } from './constants.js';
import { EquiposError } from './errors.js';

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} row */
async function insertEquiposPhotoRow(db, row) {
  await db
    .prepare(
      `INSERT INTO equipos_photos (id, session_id, report_id, device_type, photo_kind, file_path, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.sessionId || null,
      row.reportId || null,
      row.deviceType,
      row.photoKind,
      row.filePath,
      row.capturedAt
    )
    .run();
}

/**
 * @param {string} photoBase64
 * @param {{ deviceType: string, photoKind: string }} meta
 * @param {import('@cloudflare/workers-types').R2Bucket} bucket
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function savePhotoFromBase64(photoBase64, meta, bucket, db) {
  const raw = String(photoBase64 || '');
  const m = /^data:image\/\w+;base64,(.+)$/i.exec(raw);
  const b64 = m ? m[1] : raw;
  let buf;
  try {
    const bin = atob(b64);
    buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  } catch {
    throw new EquiposError('photo_invalid', 'Foto inválida.');
  }
  if (!buf.length || buf.length > MAX_PHOTO_BYTES) {
    throw new EquiposError('photo_too_large', 'La foto es demasiado grande.');
  }
  const id = newEquiposId();
  const key = `photos/${id}.jpg`;
  await bucket.put(key, buf, { httpMetadata: { contentType: 'image/jpeg' } });
  const capturedAt = new Date().toISOString();
  await insertEquiposPhotoRow(db, {
    id,
    sessionId: null,
    deviceType: meta.deviceType,
    photoKind: meta.photoKind,
    filePath: key,
    capturedAt,
  });
  return id;
}

/** @param {import('@cloudflare/workers-types').R2Bucket} bucket @param {string} key */
export async function readPhotoObject(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj;
}

/** @param {import('@cloudflare/workers-types').R2Bucket} bucket @param {string[]} keys */
export async function deletePhotoObjects(bucket, keys) {
  await Promise.all(keys.map((key) => bucket.delete(key)));
}
