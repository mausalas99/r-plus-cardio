import { clinicalSessionContext } from '../clinical-access-runtime.mjs';

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function readRotationConfigFormValues() {
  return {
    monthEndAt: String(document.getElementById('rotation-config-month-end')?.value || '').trim(),
    effectiveAt: String(document.getElementById('rotation-config-effective')?.value || '').trim(),
    previewDays: Number(document.getElementById('rotation-config-preview-days')?.value || 2),
  };
}

/** @param {(msg: string, type?: string) => void} toast */
export async function submitRotationConfigForm(toast) {
  const { monthEndAt, effectiveAt, previewDays } = readRotationConfigFormValues();
  if (!monthEndAt || !effectiveAt) {
    toast('Indica fin de mes y fecha de vigencia.', 'error');
    return { ok: false };
  }
  const api = dbApi();
  if (!api || typeof api.dbRotationCycleUpsert !== 'function') {
    toast('Base de datos no disponible.', 'error');
    return { ok: false };
  }
  const res = await api.dbRotationCycleUpsert({
    monthEndAt,
    effectiveAt,
    previewDays,
    createdBy: clinicalSessionContext.user?.user_id,
  });
  if (!res || res.ok === false) {
    toast(res?.error || 'No se guardó la configuración.', 'error');
    return { ok: false };
  }
  return { ok: true };
}
