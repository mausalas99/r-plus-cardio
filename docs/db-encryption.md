# Base de datos cifrada (SQLCipher)

R+ guarda datos clínicos y estado LAN del host en una base SQLite cifrada con SQLCipher (`rplus-clinical.db`), en el proceso principal de Electron. Esta nota es para operaciones y soporte.

## Recompilar el módulo nativo

Tras cambiar la versión de Electron o clonar el repo en otra arquitectura (macOS arm64/x64, Windows x64), recompila el binding nativo:

```bash
npm run rebuild:db-native
```

El script ejecuta `@electron/rebuild` sobre `better-sqlite3-multiple-ciphers`. Si falla en CI sin Electron instalado, es esperado; en máquina de desarrollo debe completarse antes de empaquetar o probar la app.

## Instalación y scripts postinstall

`better-sqlite3-multiple-ciphers` compila código nativo en `npm install`. Con npm 11+ puede pedirse aprobación explícita de scripts:

```bash
npm approve-scripts better-sqlite3-multiple-ciphers@12.10.0
```

En `package.json` ya está en `allowScripts` para esa versión. Sin el binario `.node` compilado, la app muestra error de ABI y cierra (no hay respaldo en JSON plano).

## Olvidé la contraseña

**No hay recuperación** desde la app. La clave deriva de la frase de acceso del usuario (Argon2id + SQLCipher). Sin ella, el archivo `.db` no se puede abrir.

Opciones únicas:

1. **Copia de seguridad `.db`** hecha con la misma contraseña (Configuración → respaldo cifrado).
2. **Exportación JSON** previa (texto plano con PHI; solo si se guardó cuando la sesión estaba desbloqueada).

Mantén respaldos periódicos en un medio seguro fuera del equipo compartido.

## Tipos de respaldo

| Tipo | Contenido | Cuándo usarlo |
|------|-----------|---------------|
| **Export JSON** | Datos clínicos en texto plano (desbloqueado) | Migrar a otra instalación, auditoría legible, recuperación si se pierde solo el `.db` |
| **Copia `.db`** | Archivo SQLCipher completo (`VACUUM INTO`) | Restauración rápida idéntica; requiere la **misma** contraseña |

La exportación JSON muestra advertencia de PHI. La copia `.db` permanece cifrada.

## Prueba rápida con archivo en disco

Los tests unitarios usan `:memory:`. Para validar el binario nativo contra un archivo real:

```javascript
// Proceso principal (DevTools → consola de main), ruta temporal:
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.tmpdir(), 'rplus-smoke.db');
const db = new Database(dbPath);
db.pragma("key = 'smoke-test-pass'");
db.exec('CREATE TABLE IF NOT EXISTS smoke (id INTEGER PRIMARY KEY)');
db.close();
// Borrar dbPath cuando termines
```

Si esto falla con error de carga del `.node`, ejecuta `npm run rebuild:db-native` y vuelve a empaquetar (`build.asarUnpack` incluye `node_modules/better-sqlite3-multiple-ciphers/**/*`).

## Empaquetado Electron

El release incluye el addon en `build.files` y lo extrae del asar en `build.asarUnpack` (misma ruta). Los binarios de `@node-rs/argon2` van en el mismo `asarUnpack` (si quedan dentro del asar, macOS/Windows muestran *failed to load native binding*).

Antes de `npm run build:mac` en un Mac Apple Silicon, `prebuild:mac` descarga `argon2.darwin-x64.node` para el artefacto **x64** (`scripts/fetch-argon2-darwin-x64.mjs`). Al empaquetar **Windows desde macOS**, `prebuild:win` usa `scripts/fetch-argon2-win.mjs` y `scripts/fetch-sqlite-win.mjs` (prebuild `better_sqlite3.node` win32-x64 para la ABI de Electron actual). Sin el segundo script, el `.exe` incluye el binario Mach-O y Windows muestra *not a valid Win32 application*.

Sincronizar patrones de empaquetado con:

```bash
node scripts/lib/electron-pack-files.js --write
```

## Referencias

- Diseño: `docs/superpowers/specs/2026-05-31-sqlcipher-forensic-audit-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-05-31-sqlcipher-forensic-audit.md`
