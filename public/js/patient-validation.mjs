// Validación de alta de paciente. Pura, sin DOM ni storage.
// Devuelve { ok, error?, warning? } para que la UI decida qué hacer.

export function validatePatientForSave(input) {
  const nombre = String(input?.nombre || '').trim();
  const registro = String(input?.registro || '').trim();
  const edadNum = String(input?.edadNum || '').trim();

  if (!nombre) return { ok: false, error: 'Falta el nombre del paciente.' };

  if (edadNum) {
    const n = Number(edadNum);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'La edad debe ser un número válido.' };
    }
  }

  if (!registro) return { ok: true, warning: 'missing_expediente' };

  return { ok: true };
}

// Texto del diálogo previo cuando el usuario intenta guardar sin
// expediente. La UI lo muestra como confirm modal.
export function buildExpedienteAdvice() {
  return {
    title: 'Falta el número de expediente',
    body:
      'No capturaste expediente. Para ingresar pacientes en un solo paso, '
      + 'copia el texto desde "Expediente:" hasta el final del reporte y pégalo en la pestaña '
      + 'Laboratorio: R+ rellena nombre, expediente, edad y sexo automáticamente.',
    confirmLabel: 'Guardar sin expediente',
    cancelLabel: 'Volver y completar',
  };
}
