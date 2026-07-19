export function buildConflictModalTitle(context) {
  const ctx = context || {};
  if (ctx.entityType === 'roomBundle') return 'Conflicto de paquete de sala';
  if (ctx.entityType === 'todo') return 'Pendiente en la sala';
  if (ctx.entityType === 'historiaClinica') return 'Historia clínica en la sala';
  if (ctx.entityType === 'patient') return 'Paciente en la sala';
  return 'Cambio en la sala';
}

export function buildConflictActionCopy(context) {
  const ctx = context || {};
  if (ctx.intent === 'todo-delete') {
    return {
      primaryTitle: 'No eliminar — conservar sala',
      primaryHint: 'El pendiente sigue en la sala para todos. En tu pantalla volverá a aparecer si ya lo habías quitado.',
      secondaryTitle: 'Sí eliminar — reenviar borrado',
      secondaryHint: 'Intenta de nuevo el borrado con la versión actual de la sala. Úsalo si estás seguro de que debe desaparecer.',
      tagline: 'Conflicto al eliminar un pendiente en la sala.',
    };
  }
  if (ctx.intent === 'todo-complete') {
    return {
      primaryTitle: 'Marcar como en la sala',
      primaryHint: 'Aplica el estado completado que ya tiene el host (si aplica).',
      secondaryTitle: 'Dejar como lo tengo',
      secondaryHint: 'Cierra sin cambiar; revisa el pendiente en tu lista.',
      tagline: 'El pendiente ya estaba completado o se marcó en otro equipo.',
    };
  }
  if (ctx.entityType === 'todo') {
    return {
      primaryTitle: 'Usar lo que tiene la sala',
      primaryHint: 'Aplica el texto y estado del pendiente tal como está guardado en el host.',
      secondaryTitle: 'Mantener mi cambio local',
      secondaryHint: 'Cierra el comparador sin sobrescribir; revisa el texto en pantalla.',
      tagline: 'El mismo pendiente cambió en otro equipo.',
    };
  }
  if (ctx.entityType === 'roomBundle') {
    return {
      primaryTitle: 'Usar versión del servidor',
      primaryHint: 'Carga el censo, agenda y pendientes que ya tiene la sala. Tu intento local queda como borrador.',
      secondaryTitle: 'Cerrar sin decidir',
      secondaryHint: 'El borrador queda en ⇄ → Borradores de conflicto para revisarlo después.',
      tagline: 'La sala tiene otra versión del paquete de sincronización.',
    };
  }
  return {
    primaryTitle: 'Usar versión del servidor',
    primaryHint: 'Descarta este intento de guardado y carga lo que ya guardó la sala o el host. Se elimina el borrador guardado.',
    secondaryTitle: 'Seguir con mi borrador',
    secondaryHint: 'Cierra el comparador y mantén tus cambios en pantalla. El borrador queda en Ajustes → LAN.',
    tagline: 'Otro equipo guardó antes. Elige la copia de la sala o sigue con lo que tienes en pantalla.',
  };
}
