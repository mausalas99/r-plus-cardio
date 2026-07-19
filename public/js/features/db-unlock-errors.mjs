function nativeAbiMismatchMessage(opts) {
  opts = opts || {};
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (opts.nativeError) return String(opts.nativeError);
    return (
      'R+ no pudo cargar SQLCipher o el cifrado (argon2) en esta instalación. ' +
      'En Ajustes → Aplicación usa «Restaurar versión estable» o «Abrir instalador en GitHub».'
    );
  }
  return (
    'El módulo SQLCipher no coincide con esta sesión de R+ (suele pasar después de npm test). ' +
    'En la carpeta del proyecto ejecuta: npm run rebuild:db-native — cierra R+ por completo (Cmd+Q) y vuelve a abrir con npm start.'
  );
}

function setupFailedMessage(res) {
  var setupDetail = res && (res.cause || res.error);
  return setupDetail
    ? 'No se pudo crear la base cifrada: ' + setupDetail
    : 'No se pudo crear la base cifrada. Cierra R+, vuelve a abrir e intenta de nuevo.';
}

function schemaMigrationFailedMessage(res) {
  var migDetail = res && (res.cause || res.error || '');
  return (
    'No se pudo actualizar el esquema de la base cifrada' +
    (migDetail ? ': ' + migDetail : '.') +
    ' Si el problema continúa, exporta un respaldo .db y contacta soporte.'
  );
}

function nodeModuleVersionMismatchMessage() {
  return (
    'El módulo SQLCipher no coincide con esta versión de Electron. En la carpeta del proyecto ejecuta: npm run rebuild:db-native — luego cierra R+ por completo y vuelve a abrirlo.'
  );
}

const UNLOCK_ERROR_BY_CODE = {
  AUTH_RATE_LIMITED: function () {
    return 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.';
  },
  DB_UNLOCK_METADATA_MISSING: function () {
    return 'Faltan metadatos de cifrado en el perfil local. Contacta soporte o restaura un respaldo.';
  },
  DB_SETUP_RESET_FAILED: function () {
    return (
      'No se pudo reiniciar la base cifrada anterior (archivo en uso). Cierra R+ por completo y vuelve a abrir.'
    );
  },
  DB_UNLOCK_FAILED: function () {
    return 'Código de recuperación incorrecto.';
  },
  DB_RECOVERY_NOT_CONFIGURED: function () {
    return 'La recuperación no está disponible para esta base de datos.';
  },
  DB_AUTO_UNLOCK_FAILED: function () {
    return 'No se pudo abrir la base en este equipo. Usa tu código de recuperación si lo guardaste.';
  },
};

function unlockErrorMessageForCode(code, res, opts) {
  if (code === 'DB_SETUP_FAILED' || (opts.setup && code === 'DB_UNLOCK_FAILED')) {
    return setupFailedMessage(res);
  }
  if (code === 'DB_NATIVE_ABI_MISMATCH' || code === 'DB_NATIVE_BINDING_FAILED') {
    return nativeAbiMismatchMessage(opts);
  }
  if (code === 'DB_SCHEMA_MIGRATION_FAILED') {
    return schemaMigrationFailedMessage(res);
  }
  var handler = UNLOCK_ERROR_BY_CODE[code];
  return handler ? handler(res, opts) : null;
}

/** User-facing unlock / boot error copy for SQLCipher gate. */
export function unlockErrorMessage(res, opts) {
  opts = opts || {};
  var code = res && res.code;
  var byCode = unlockErrorMessageForCode(code, res, opts);
  if (byCode) return byCode;

  var detail = res && (res.cause || res.error || res.message);
  if (detail && /NODE_MODULE_VERSION|was compiled against a different/i.test(String(detail))) {
    return nodeModuleVersionMismatchMessage();
  }
  return detail || 'No se pudo desbloquear la base de datos.';
}

/** User-facing copy when clinical DB cannot open at app boot. */
export function describeClinicalDbBootFailure(unlockResult) {
  if (!unlockResult || unlockResult.unlocked) return '';
  if (unlockResult.reason === 'native_blocked') {
    return unlockErrorMessage(
      { code: 'DB_NATIVE_ABI_MISMATCH' },
      { nativeError: unlockResult.status && unlockResult.status.nativeError }
    );
  }
  if (unlockResult.reason === 'locked') {
    return (
      'La base clínica está bloqueada. Usa tu código de recuperación en el diálogo de desbloqueo — ' +
      'tus pacientes siguen en el disco.'
    );
  }
  return unlockErrorMessage(unlockResult.status || {}, {});
}

export function changePassphraseErrorMessage(res) {
  var code = res && res.code;
  if (code === 'DB_PASSPHRASE_MISMATCH') {
    return 'La contraseña actual no es correcta.';
  }
  if (code === 'DB_PASSPHRASE_TOO_SHORT') {
    return 'La contraseña nueva debe tener al menos 8 caracteres.';
  }
  if (code === 'DB_PASSPHRASE_INVALID') {
    return 'Completa la contraseña actual y la nueva.';
  }
  if (code === 'DB_LOCKED') {
    return 'La base está bloqueada. Desbloquéala antes de cambiar la contraseña.';
  }
  return (res && (res.cause || res.error || res.message)) || 'No se pudo cambiar la contraseña.';
}
