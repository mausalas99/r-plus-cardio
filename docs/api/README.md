# API Reference — R+

Este documento describe las APIs expuestas por R+ para comunicación entre procesos (IPC) y red LAN.

---

## IPC (preload.js → main process)

R+ usa `contextBridge` expuesto en `preload.js` para comunicación entre el renderer y el proceso principal de Electron.

### Canales IPC

| Canal | Dirección | Propósito |
|-------|-----------|-----------|
| `file:save` | Renderer → Main | Guardar archivo `.docx` via diálogo |
| `file:open` | Renderer → Main | Abrir archivo via diálogo |
| `db:get-password` | Renderer → Main | Obtener contraseña de SQLCipher |
| `db:set-password` | Renderer → Main | Establecer contraseña de SQLCipher |
| `db:unlock` | Renderer → Main | Desbloquear base de datos cifrada |
| `db:lock` | Renderer → Main | Bloquear base de datos cifrada |
| `db:status` | Renderer → Main | Estado de la base (bloqueada/desbloqueada) |
| `update:check` | Renderer → Main | Verificar actualizaciones |
| `update:download` | Renderer → Main | Descargar actualización |
| `update:install` | Renderer → Main | Instalar actualización |
| `update:status` | Main → Renderer | Estado de la actualización (checking, downloaded, error) |
| `lan:status` | Main → Renderer | Estado de conexión LAN |
| `lan:peers` | Main → Renderer | Lista de peers conectados |
| `app:version` | Renderer → Main | Obtener versión de la app |
| `app:quit` | Renderer → Main | Cerrar la app |
| `settings:get` | Renderer → Main | Leer ajustes |
| `settings:set` | Renderer → Main | Escribir ajustes |
| `shell:open-external` | Renderer → Main | Abrir URL en navegador |
| `shell:open-path` | Renderer → Main | Abrir carpeta en Finder/Explorer |

### Uso desde el renderer

```javascript
// Leer (invoke → Promise)
const version = await window.electronAPI.getVersion();

// Escribir (send → evento)
window.electronAPI.saveFile({ content, path });

// Escuchar (on → callback)
window.electronAPI.onUpdateStatus((event, status) => { ... });
```

---

## HTTP API (LAN — puerto 3738)

El servidor HTTP en `localhost:3738` (Express) expone rutas para sincronización LAN entre estaciones del turno.

### Rutas

#### Salud y estado

| Método | Ruta | Propósito |
|--------|------|-----------|
| `GET` | `/health` | Health check del servidor |
| `GET` | `/status` | Estado del host LAN |

#### Autenticación

| Método | Ruta | Propósito |
|--------|------|-----------|
| `POST` | `/auth/exchange` | Intercambio de token de autenticación |
| `GET` | `/auth/ward-host-hints` | Obtener hints de host ward (cross-VLAN) |

#### Sincronización de bundles (LiveSync)

| Método | Ruta | Propósito |
|--------|------|-----------|
| `GET` | `/sync/bundle` | Obtener bundle completo del estado actual |
| `PUT` | `/sync/bundle` | Enviar bundle actualizado al host |
| `GET` | `/sync/delta` | Obtener deltas desde un `deltaSeq` específico |
| `POST` | `/sync/delta` | Enviar delta de cambios |

#### Datos clínicos

| Método | Ruta | Propósito |
|--------|------|-----------|
| `GET` | `/clinical-ops` | Obtener operaciones clínicas (guardias, equipos) |
| `PUT` | `/clinical-ops` | Actualizar operaciones clínicas |
| `GET` | `/clinical/historia/:id` | Obtener historia clínica de paciente |
| `PUT` | `/clinical/historia/:id` | Actualizar historia clínica |
| `GET` | `/clinical/meta` | Obtener metadatos clínicos del host |

#### Descubrimiento y peers

| Método | Ruta | Propósito |
|--------|------|-----------|
| `GET` | `/discovery/ping` | Ping de descubrimiento en subred |
| `GET` | `/peers` | Lista de peers conectados |
| `POST` | `/peers/join` | Solicitar unión a sala/host |
| `POST` | `/peers/leave` | Notificar salida de sala/host |

### Eventos SSE

El servidor también expone Server-Sent Events para notificaciones en tiempo real:

| Evento | Propósito |
|--------|-----------|
| `livesync:revision` | Notificación de nueva revisión disponible |
| `livesync:applied` | Confirmación de bundle aplicado |
| `livesync:host-handoff` | Transferencia de host a otro peer |
| `livesync:peer-joined` | Nuevo peer conectado |
| `livesync:peer-left` | Peer desconectado |
| `livesync:conflict` | Conflicto detectado en merge |

---

## WebSocket API

Además de HTTP/SSE, el host expone WebSocket en el mismo puerto `:3738` para comunicación bidireccional.

### Eventos WS (cliente → servidor)

| Evento | Propósito |
|--------|-----------|
| `livesync:subscribe` | Suscribirse a sala/room |
| `livesync:unsubscribe` | Desuscribirse de sala/room |
| `livesync:patch` | Enviar parche de datos |

### Eventos WS (servidor → cliente)

| Evento | Propósito |
|--------|-----------|
| `livesync:bundle` | Bundle completo de estado |
| `livesync:patch` | Parche aplicado |
| `livesync:revision` | Hint de nueva revisión |
| `livesync:conflict` | Conflicto detectado |

---

## IPC de almacenamiento local

Los módulos en `lib/db/` exponen canales IPC para operaciones de base de datos SQLCipher:

| Canal | Propósito |
|-------|-----------|
| `db:patient:list` | Listar pacientes |
| `db:patient:get` | Obtener paciente por ID |
| `db:patient:save` | Guardar/actualizar paciente |
| `db:patient:delete` | Eliminar paciente |
| `db:note:list` | Listar notas de paciente |
| `db:note:save` | Guardar nota |
| `db:settings:get` | Leer ajustes |
| `db:settings:set` | Guardar ajustes |

---

## Referencias

- Código del servidor HTTP: `server.js`, `lan-squad/host-router.js`
- Bridge IPC: `preload.js`, `main.js`
- WebSocket hub: `lan-squad/ws-hub.js`, `lan-squad/lan-sse-hub.js`
- Almacenamiento: `lib/db/`, `lan-squad/host-store.js`
