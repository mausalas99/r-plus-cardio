# R+ Cardio

Fork de R+ orientado al seguimiento intrahospitalario de IC descompensada (descongestión, congestión/POCUS, manejo y hoja IC). Sin LiveSync/LAN en el MVP.

- **Repo:** [mausalas99/r-plus-cardio](https://github.com/mausalas99/r-plus-cardio)
- **Releases:** [última versión](https://github.com/mausalas99/r-plus-cardio/releases/latest)
- **Upstream R+:** [mausalas99/r-mas](https://github.com/mausalas99/r-mas) (código de origen; releases independientes)
- Diseño: [2026-07-19-cardionotas-ic-fork-design](docs/superpowers/specs/2026-07-19-cardionotas-ic-fork-design.md)
- Plan MVP: [2026-07-19-cardionotas-ic-mvp](docs/superpowers/plans/2026-07-19-cardionotas-ic-mvp.md)
- Fixture demo IC: `data/demo-patients/demo-ic-seguimiento.json` (+ hoja ejemplo `demo-ic-hoja-ejemplo.docx`)
- Importar en app: **Ajustes → Tours → Importar DEMO IC (caso completo)**
- **Puerto local:** `3838` (R+ usa `3738`) — override con `CARDIONOTAS_HTTP_PORT`

## Índice

- [Instalación](#instalación-mac-y-windows)
- [Historial de versiones](#historial-de-versiones)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Desarrollo](#desarrollo)
- [Architecture](#architecture)
- [Actualizaciones](#actualizaciones)

---

## Instalación (Mac y Windows)

Todo se descarga desde **[Releases — última versión](https://github.com/mausalas99/r-plus-cardio/releases/latest)**. No hace falta instalar Python ni Node: los instaladores ya incluyen todo lo necesario para generar los `.docx` (módulos nativos en `lib/doc-generators/`).

### Mac

1. Abre la página de *Releases* (enlace de arriba).
2. Descarga el `.dmg` según tu Mac:
   - **`R+ Cardio-<versión>-arm64.dmg`** — Apple Silicon (M1, M2, M3, M4…).
   - **`R+ Cardio-<versión>-x64.dmg`** — Mac con procesador Intel.
3. Abre el `.dmg`, arrastra **R+ Cardio** a la carpeta **Aplicaciones** y abre la app desde allí.

> Si macOS dice que no se puede abrir porque el desarrollador no está identificado: clic derecho en **R+ Cardio** → **Abrir** → confirmar **Abrir**.

### Windows

1. En la misma página de *Releases*, descarga **`R+ Cardio-<versión>-x64.exe`**.
2. Ejecuta el instalador y sigue los pasos.

Instalación silenciosa (`/S`) y códigos de salida del instalador NSIS: [`docs/INSTALLER_EXIT_CODES.md`](docs/INSTALLER_EXIT_CODES.md).

> Si **SmartScreen** muestra una advertencia: **Más información** → **Ejecutar de todas formas**.

---

**Versión estable actual:** [1.0.2](https://github.com/mausalas99/r-plus-cardio/releases/tag/v1.0.2) — en *Releases* verás siempre el instalador más reciente con el número de versión en el nombre del archivo.

---

## R+ 1.0.2 (Manejo IC en pestaña principal)

- **Manejo app** — Fantásticos / diuréticos en la pestaña superior **Manejo** (ya no sub-pestaña del expediente).
- **Combos GDMT** — Sugerencias por pilar sin mezclar diuréticos; combo UI opaca.
- **Furosemida** — Acumulado por dosis diaria × días del segmento cuando falta `mgTotal`.
- **Chrome** — Sin Pendientes, Drive ni entrega; Salida centrada en hoja IC.

Notas: `docs/RELEASE_NOTES_1.0.2.txt`.

## R+ 1.0.1 (parche — min-version Cardio)

- **Min-version** — Corrige el modal bloqueante que pedía R+ **6.4.0** / LAN: `public/min-version.json` quedó desfasado del policy Cardio (`1.0.0`).
- **Build** — `build:ui` sincroniza el policy raíz → `public/min-version.json` para que no vuelva a derivar.

Notas: `docs/RELEASE_NOTES_1.0.1.txt`.

## R+ 1.0.0 (seguimiento IC descompensada)

- **Producto** — Primera release de R+ Cardio (fork de R+); releases en `mausalas99/r-plus-cardio`, independiente de R+.
- **Descongestión / congestión / POCUS** — Captura diaria en Estado actual con acumulados overrideables.
- **Manejo** — Fantásticos, otros meds y diuréticos por segmentos de dosis.
- **Hoja IC** — Export `.docx` con plantilla institucional fija (Salida → Generar hoja IC).
- **MVP sin LiveSync** — Pase local; puerto **3838** (R+ usa 3738); appId propio.

Notas: `docs/RELEASE_NOTES_1.0.0.txt`.

## R+ 7.7.1 (receta SOAP ampliada e insulina rescate)

- **Receta → SOAP** — Más familias (antieméticos, sedación, antiepilépticos, transfusiones, anticoagulación, etc.) con override manual por fila.
- **Rescates de insulina** — Grupo PRN SC en Manejo; cláusula NM **RESCATES DE INSULINA** al marcar SOAP.
- **Glucometrías con UI** — Texto EA/SOAP muestra valor + unidades aplicadas; evita duplicar «rescates disponibles».
- **Bomba IV** — Detección más robusta y exclusión del cloruro portador en NM.
- **Parche sobre 7.7.0** — Interpretación citoquímica, LCR dual-block y diagramas colapsables.

Notas: `docs/RELEASE_NOTES_7.7.1.txt`.

## R+ 7.7.0 (interpretación citoquímica y LCR)

- **Labs — interpretación citoquímica** — GASA, Light, PBE/SBP, empiema pleural y etiología LCR en bloque informativo (no se copia a nota/censo).
- **LCR — bloques duales SOME** — Fusiona química + bacteriología; evita fugas de glucosa a QS; bandera si pH fuera de 7.28–7.42.
- **Labs — diagramas** — Sección colapsable en Resultados con preferencia guardada.
- **Parche sobre 7.6.9** — Gasometría resaltada, historial LAN y repositorio.

Notas: `docs/RELEASE_NOTES_7.7.0.txt`.

## R+ 7.6.9 (gasometría — resaltado de alterados)

- **Labs — gasometría** — Valores alterados (pCO₂, pO₂, lactato, bicarbonato, etc.) vuelven a resaltarse en RESULTADOS y en el diagrama Gasometría.
- **Repositorio** — Al importar gasometría + química del mismo día, R+ calcula **anión gap** y **Delta-Delta** automáticamente.
- **Labs — reproceso** — Al guardar historial o reprocesar, se conservan asteriscos y rangos del reporte SOME.
- **Parche sobre 7.6.8** — Bomba insulina EA, filtro censo instantáneo y receta en Manejo.

Notas: `docs/RELEASE_NOTES_7.6.9.txt`.

## R+ 7.6.8 (bomba insulina EA + filtro censo)

- **EA — bomba de insulina** — SOME detecta algoritmo 1–4; registro, snapshot, texto copiable y SOAP de medicamentos.
- **Filtros censo** — Sala/equipo/servicio filtran al instante; sin esperar sync LAN para ver el censo correcto.
- **Medicamentos** — Receta hospitalaria en pestaña **Manejo** del expediente.
- **Parche sobre 7.6.7** — Equipos push, troponina hs y consolidación de labs.

Notas: `docs/RELEASE_NOTES_7.6.8.txt`.

## R+ 7.6.7 (equipos push + troponina hs)

- **Equipos — avisos push** — PWA de lista de espera Lumify/EKG/US con notificaciones web cuando te llaman (LAN y cloud); guía iOS y página de ayuda.
- **Labs — troponina hs** — Parseo de reportes SOME solo troponina I (alta sensibilidad) y tarjeta en tendencias.
- **Labs — consolidación** — Mezcla más inteligente: gasometría no fusiona con gasometría; labwork + gaso en ventana de 2 h.
- **Parche sobre 7.6.6** — QR imprimible y host LAN estable de la versión anterior.

Notas: `docs/RELEASE_NOTES_7.6.7.txt`.

## R+ 7.6.6 (QR imprimible + host estable)

- **QR — imprimible** — Copiar o **Descargar QR** en alta resolución (~2048px) para interno por sala y lista de espera equipos.
- **LAN — host estable** — El R4 conserva rol anfitrión: repinea IP local si ⇄ tenía un pin remoto obsoleto.
- **Parche sobre 7.6.5** — Token `lan-team-code.txt`, invite empaquetado y auto-connect.

Notas: `docs/RELEASE_NOTES_7.6.6.txt`.

## R+ 7.6.5 (LAN token fix + invite empaquetado)

- **LAN — token anfitrión** — Alinea bearer con `lan-team-code.txt`; corrige 401 en sync-bundle cuando el host tenía token obsoleto en localStorage.
- **LAN — invite empaquetado** — Enlace de sala pre-llenado en ⇄ tras actualizar (`bundledWardInviteUrl`; rotar por turno antes del build).
- **Parche sobre 7.6.4** — Campo anfitrión visible, auto-connect y host `10.0.57.65`.

Notas: `docs/RELEASE_NOTES_7.6.5.txt`.

## R+ 7.6.4 (LAN reconnect — host URL visible)

- **LAN — campo anfitrión** — ⇄ muestra dirección del R4 editable cuando no hay PIN (bypass activo).
- **LAN — host empaquetado** — Primer probe a `http://10.0.57.65:3738`.
- **LAN — Restablecer** — Re-siembra ward registry y reconecta sin pedir PIN.
- **LAN — Unirse sala** — Auto-conecta al host antes de unirse a la sala.
- **Parche sobre 7.6.3** — Auto-connect sin código de la versión anterior.

Notas: `docs/RELEASE_NOTES_7.6.4.txt`.

## R+ 7.6.3 (LAN auto-connect sin código)

- **LAN — auto-connect** — R1–R3 se unen al turno sin PIN ni código: la app prueba los endpoints del hospital al arrancar, en ⇄ y al cambiar de Wi‑Fi.
- **LAN — barrido** — El descubrimiento sigue activo aunque el cliente aún no tenga bearer guardado.
- **Parche sobre 7.6.2** — iPad scope LAN, Interconsultas en sala y filtro de censo por equipo.

Notas: `docs/RELEASE_NOTES_7.6.3.txt`.

## R+ 7.6.2 (iPad scope LAN + Interconsultas sala)

- **iPad — scope LAN** — Conserva scope hidratado por LAN sin SQLCipher; censo espera equipo unido antes de aplicar pacientes del host.
- **iPad — ops clínicas** — Snapshot del anfitrión en móvil; reconcile de pacientes tras merge de ops.
- **Interconsultas — sala** — Sala del equipo al registrar o asignar (prevalece sobre stamp UX del perfil).
- **Censo — filtro sala** — Incluye pacientes por sala del equipo asignado.
- **Tests** — `room.test` ya no cuelga el pipeline de release.
- **Parche sobre 7.6.1** — SQLCipher v21, borrador Mi rotación y equipos push de la línea anterior.

Notas: `docs/RELEASE_NOTES_7.6.2.txt`.

## R+ 7.6.1 (Interconsultas en DB + Mi rotación sin perder borrador)

- **SQLCipher v21** — Salas Interconsultas, UX y Eme válidas en users/teams/sala_interno_access (migración al desbloquear).
- **Mi rotación — borrador** — Formularios de crear equipo, perfil y código de unión no se pierden al refrescar el panel.
- **Equipos push** — Notificaciones solo si ya estás en la cola del dispositivo.
- **Downgrade estable** — Catálogo con timeout y enlace a GitHub si falla la red.
- **Parche sobre 7.6.0** — ⇄ sin PIN y censo abierto por equipo; sin cambios de comportamiento LAN respecto a 7.6.0.

Notas: `docs/RELEASE_NOTES_7.6.1.txt`.

## R+ 7.6.0 (LAN sin PIN de turno + censo abierto por equipo)

- **⇄ sin PIN** — Unión LAN automática al guardar perfil; sin campo de 6 dígitos en onboarding ni registro (por defecto).
- **Restaurar PIN** — El anfitrión puede exigir PIN otra vez con `R_PLUS_LAN_REQUIRE_SHIFT_PIN=1` al arrancar.
- **Censo abierto (temporal)** — Todos los pacientes de la sala visibles en guía clínica, sin filtro por equipo asignado.
- **Parche sobre 7.5.9** — Censo recuperable, tombstones LAN y directorio de equipos; sin migración (SQLCipher v20).

Notas: `docs/RELEASE_NOTES_7.6.0.txt`.

## R+ 7.5.9 (recuperación censo + tombstones LAN)

- **Censo recuperable** — Ajustes exporta pacientes desde SQLCipher aunque el sidebar esté vacío; importa con **Importar rango…** (`npm run recover:census` en CLI).
- **Exportar pacientes…** — Selector multi-paciente del censo para un JSON de respaldo.
- **Anfitrión LAN** — Limpiar tombstones, restaurar fantasmas y purgar huérfanos del host con respaldo automático previo.
- **Directorio LAN** — Membresías de equipo remapean al @usuario local tras sync entre Macs.
- **Parche sobre 7.5.8** — Catálogo downgrade y EA suplemento; sin migración (SQLCipher v20).

Notas: `docs/RELEASE_NOTES_7.5.9.txt`.

## R+ 7.5.8 (catálogo downgrade 7.5.7)

- **Restaurar versión estable** — El catálogo in-app incluye **7.5.7** como release curada recomendada para downgrade.
- **Parche sobre 7.5.7** — Confirmar dieta SUPLEMENTO en EA y sync sin re-propuesta; sin migración (SQLCipher v20).

Notas: `docs/RELEASE_NOTES_7.5.8.txt`.

## R+ 7.5.7 (EA suplemento confirm)

- **Confirmar suplemento** — Aceptar dieta SUPLEMENTO desde SOME limpia la propuesta pendiente; ya no queda atascada la barra Confirmar/Descartar.
- **Sync Manejo** — kcal/proteína del SOME no re-disparan la propuesta tras confirmar el mismo suplemento.
- **Parche sobre 7.5.6** — Onboarding Windows/wipe y la línea anterior sin migración (SQLCipher v20).

Notas: `docs/RELEASE_NOTES_7.5.7.txt`.

## R+ 7.5.6 (onboarding local + wipe Windows)

- **Borrado completo Electron** — Modal in-app confirma con BORRAR; sin prompt/confirm nativos en Windows.
- **Registro tras wipe** — Recuperar @usuario y Guardar perfil avanzan; clientId del dispositivo se repone en ajustes.
- **Solo este equipo** — Un clic entra a la app; firma por defecto editable en Mi Perfil.
- **Parche sobre 7.5.5** — Dieta AYUNO, registro cableado y signos iPad→LAN de la línea anterior.

Notas: `docs/RELEASE_NOTES_7.5.6.txt`.

## R+ 7.5.5 (dieta AYUNO + onboarding registro)

- **Dieta desde AYUNO confirmado** — Pegar SOME con receta propone nueva dieta en pendienteReceta sin flag force.
- **Onboarding registro** — Formulario submit cableado; perfil persistido no repite gate; LAN push en background.
- **Parche sobre 7.5.4** — Signos iPad→LAN, sync-bundle 16 MB y recuperación desde cola LAN.

Notas: `docs/RELEASE_NOTES_7.5.5.txt`.

## R+ 7.5.4 (iPad signos vitales LAN)

- **Guardar empuja LAN** — Estado Actual en iPad/móvil sincroniza signos al anfitrión (Guardar, registrar y eliminar medición).
- **sync-bundle 16 MB** — Corrige 500 en censos grandes; reinicia R+ en la Mac anfitrión tras instalar.
- **Recuperar signos** — Botón en ⇄ → Estado de sincronización; restaura desde outbox/snapshot local.
- **Sin migración** — SQLCipher sigue en v20.

Notas: `docs/RELEASE_NOTES_7.5.4.txt`.
## R+ 7.5.3 (Repositorio intrahospitalario de laboratorio)

- **Importar desde repositorio** — Registro + rango de fechas → PDFs del portal → historial y tendencias (misma deduplicación que pegado masivo).
- **Flujo híbrido** — Importación silenciosa cuando cuadra el paciente; modal de revisión si hay ambigüedad o duplicados.
- **Sin migración** — SQLCipher sigue en v20; requiere acceso LAN al portal de laboratorio.

Notas: `docs/RELEASE_NOTES_7.5.3.txt`.

## R+ 7.5.2 (Estado Actual signos, SOME ayuno y traqueostomía)

- **Signos vitales** — Filas compactas en Estado Actual; toca una fila para ver historial del turno en modal.
- **SOAP / copiar** — Última lectura del turno; PICO febril (≥38 °C, ≤5 días) con fecha corta; menos ruido `@ 00:00`.
- **SOME** — Detecta **AYUNO**; soporte **Traqueostomía** en EA y export.
- **Sin migración** — SQLCipher sigue en v20.

Notas: `docs/RELEASE_NOTES_7.5.2.txt`.

## R+ 7.5.1 (push equipos, eTFG paciente y UI Rams)

- **Equipos push** — Web Push en `/equipos` cuando un dispositivo queda libre, Lumify devuelto o hay alerta de material/falla (LAN + cloud).
- **Laboratorio** — eTFG desde sexo/edad del expediente; pegado masivo agrupa por ventana de 2 h.
- **UI** — Superficies planas Rams/Tufte: papel cálido, hairlines, sin sombras en tarjetas.
- **SQLCipher v20** — Suscripciones push de equipos en host LAN.

Notas: `docs/RELEASE_NOTES_7.5.1.txt`.

## R+ 7.5.0 (equipos Lumify/EKG/US, panel ⇄ y cola cloud)

- **Equipos** — Cola Lumify/EKG/US con móvil `/equipos`, tablero en guardia, fotos y reportes; opción cloud en Cloudflare sin Mac anfitrión.
- **Panel ⇄** — Héroe estado/PIN y filas unificadas; alertas como franja; toggles y chevrons consistentes.
- **Ajustes** — Paneles internos con botones fantasma y jerarquía clara (menos paredes moradas).
- **SQLCipher v19** — Tablas equipos y fotos de alerta en reportes de material/falla.

Notas: `docs/RELEASE_NOTES_7.5.0.txt`.

## R+ 7.4.1 (dieta EA, LAN ward y CORS Electron)

- **Dieta SOME en EA** — Suplemento, columnas desplazadas y re-aplicar receta sin perder confirmación.
- **Signos y SOAP** — Vitals alineados a la tira de monitoreo; pico de temperatura con formato claro.
- **LAN ward** — Beacon-first al escanear peers; CORS en Electron para API `:3738`.
- **Seguridad** — `frame-ancestors` por header en el servidor LAN.

Notas: `docs/RELEASE_NOTES_7.4.1.txt`.

## R+ 7.4.0 (arranque rápido, monitoreo EA y UI pulida)

- **Arranque** — Carga diferida de entrega, plataforma, tour, modales y shell; menos trabajo antes del primer uso.
- **Estado actual** — Máximo de signos vitales por turno al registrar; hora de alteración prellenada desde el registro.
- **Censo** — Re-tocar el mismo paciente no parpadea la lista; highlight activo en silencio.
- **Pase** — Expediente se pinta al cambiar paciente aunque el panel estuviera vacío.
- **UI** — Profundidad en tarjetas, sidebar cama-first, EA e interno alineados al design system.

Notas: `docs/RELEASE_NOTES_7.4.0.txt`.

## R+ 7.3.8 (COAG separado, balance I/O NC y arranque DB)

- **Laboratorio** — Coagulación en sección **COAG** independiente de BH; encabezados con estilo de sección en pase y panel; diagramas leen BH o COAG.
- **Estado actual** — Balance **NC** cuando egresos no cuantificados; SOAP y snapshot muestran `BALANCE NC`.
- **Estado actual** — Selector fecha/hora del modal de registro alineado al design system.
- **Arranque** — Toast si la base clínica no abre (bloqueada o binario nativo incompatible).
- **DX** — Scripts SQLCipher Node/Electron más seguros para pruebas locales.

Notas: `docs/RELEASE_NOTES_7.3.8.txt`.

## R+ 7.3.7 (censo LAN estable y expediente Drive)

- **LAN** — Pacientes ya no desaparecen del censo por readmisión con el mismo registro; deletes LiveSync solo por id del expediente.
- **LAN** — Limpieza de tombstones obsoletos al registrar paciente nuevo; bundle merge conserva charts con id distinto.
- **Expediente** — **Importar desde Drive** en la barra del bloque Clínico (modo sala), con estilo pill unificado.

Notas: `docs/RELEASE_NOTES_7.3.7.txt`.
## R+ 7.3.6 (LAN identity, sync modular y calidad)

- **LAN** — identidad por cliente emitida en el intercambio; purga usa identidad de servidor, no query params.
- **Sync** — `orchestrator` dividido en módulos (`conflicts`, `patient-delete`, `historia-sync`, …).
- **Laboratorio** — detección superset de cultivos unificada; lipasa con prueba golden.
- **Calidad** — IPC clínico con 13 pruebas de integración; cinco suites reactivadas; `npm start` sin rebuild nativo forzado.

Notas: `docs/RELEASE_NOTES_7.3.6.txt`.

## R+ 7.3.5 (LAN hardening, host durability y pulido UI)

- **LAN** — purga con guard de propiedad en servidor; bloqueo 5 min tras 8 PIN fallidos.
- **Anfitrión** — persistencia más fiable al cerrar; errores de disco visibles en diagnóstico.
- **Rendimiento** — caché de blobs parseados; parser unificado de cultivos.
- **Clínico** — modal **Datos del paciente**; ATB por día según fecha de Manejo; presets de vencimiento editables.

Notas: `docs/RELEASE_NOTES_7.3.5.txt`.

## R+ 7.3.4 (perf, pendientes con vencimiento y censo virtual)

- **Rendimiento** — chunks perezosos (labs/gráficas), censo virtual >30 activos, reconcile LAN con refresco acotado de pendientes.
- **Pendientes** — vencimiento opcional, recordatorios, orden por vencidos, filtro **Entrega** con acuse.
- **Guardia v7** — barra de progreso del currículo y nudge en tablero.
- **iPad/PWA** — espejo limitado a pacientes de equipos unidos + guardia activa.
- **UI** — laboratorio premium, motion/skeleton refinados.

Notas: `docs/RELEASE_NOTES_7.3.4.txt`.

## R+ 7.3.3 (EA balance, evacuaciones y dieta)

- **Balance I/O** — cláusula SOAP calcula balance con egresos mixtos (diuresis NC + drenaje numérico).
- **Evacuaciones** — conteo sin sufijo CC en EA, historial y censo.
- **Dieta** — kcal total visible desde kcal/kg × peso sin pisar valor guardado.

Notas: `docs/RELEASE_NOTES_7.3.3.txt`.

## R+ 7.3.2 (Premium UI, gráficas EA y endurecimiento)

- **Diseño** — tokens, elevación, motion presets (Sobrio/Mixto/Expresivo) y overlays de vidrio en modales/menús.
- **Navegación** — fila agrupada en expediente, contexto de paciente, selector de modo y paleta **⌘K**.
- **Superficies** — escritorio, móvil e interno con Workbench Refinado; Learn Hub y onboarding alineados.
- **Estado actual** — modal de gráficas con pestañas, downsampling y curvas como Tendencias.
- **LAN + seguridad** — purga host con guard de propiedad; CSP, allowlist de ventanas y borrado PHI en web móvil.

Notas: `docs/RELEASE_NOTES_7.3.2.txt`.

## R+ 7.3.1 (Manejo modal SOME, AAS SOAP y perfil borrar)

- **Manejo** — modal **Importar SOME**; grilla «Medicamentos del turno» con etiquetas compactas y **+1 día**.
- **SOAP** — AAS ≤160 mg → Otros; >160 mg → Analgesia; texto dieta sin «PARA PESO DE X KG».
- **Perfil farmacoterapéutico** — menú **⋯** para eliminar mes visible o borrar perfil completo.
- **Estado actual** — barra de confirmación de dieta pendiente; rejilla clínica reorganizada.

Notas: `docs/RELEASE_NOTES_7.3.1.txt`.

## R+ 7.3.0 (Perfil histórico, directorio LAN y laboratorio)

- **Perfil histórico** — grilla cross-mes con filas continuas, solape dinámico y acotado por fecha de ingreso.
- **Directorio LAN** — actividad reciente (SQL v17), filtros y rangos colapsables.
- **Laboratorio** — historial por fecha (selector Estudio); FAB Copiar solo con contenido en la pestaña activa.
- **Censo PDF** — labs y pendientes con envoltura completa; anfitrión con dashboard modal del censo host.

Notas: `docs/RELEASE_NOTES_7.3.0.txt`.

## R+ 7.2.9 (Manejo, dietas SOME y EA)

- **Manejo** — parser SOME con medicamentos P2 y dietas; SOAP pre-marcado (ATB, insulina, D50, PRN glu).
- **Estado actual** — propuesta de dieta con confirmar/descartar; campo proteína g/día; FAB copiar.
- **Censo** — re-selección automática si el filtro oculta al paciente activo.

Notas: `docs/RELEASE_NOTES_7.2.9.txt`.

## R+ 7.2.8 (interno, glu rescate y LAN iPad)

- **Interno** — orden por frecuencia de signos (q1h arriba); glucometrías con fondo oscuro en iPad.
- **Estado actual** — rescate de insulina por glucometría (unidades + DXT post-rescate) en la nota SOME.
- **LAN** — Mac cliente del turno puede copiar enlace iPad sin ser anfitrión.

Notas: `docs/RELEASE_NOTES_7.2.8.txt`.

## R+ 7.2.7 (interno — frecuencia y UI signos)

- **Interno** — orden por frecuencia de signos (q1h arriba); vencidos antes en la misma frecuencia.
- **Interno** — glucometrías con fondo oscuro en el modal de captura (iPad).

Notas: `docs/RELEASE_NOTES_7.2.7.txt`.

## R+ 7.2.6 (entrega en censo, guardia e interno)

- **Entrega** — equipo del paciente según censo; Admin ve todos los equipos; opción **Sin signos**.
- **Guardia** — orden por cama; críticos e inestables arriba (grid, Entrega, interno).
- **Interno** — lista alineada al censo; signos del iPad sincronizan al host/desktop.
- **Expediente** — tabs Lab/Med/Nota más fluidos; tendencias con sparklines fuera de rango en rojo.

Notas: `docs/RELEASE_NOTES_7.2.6.txt`.

---

## Historial de versiones

Las release notes detalladas de cada versión están en:

- **[CHANGELOG.md](./CHANGELOG.md)** — Listado cronológico completo de todas las versiones (5.0.1 → 7.4.1)
- `docs/RELEASE_NOTES_X.Y.Z.txt` — Archivos individuales por versión

### Versiones recientes

| Versión | Destacado |
|---------|----------|
| **7.4.1** | Dieta SOME en EA, signos/SOAP alineados, LAN beacon + CORS Electron |
| **7.4.0** | Arranque rápido (carga diferida), EA signos por turno, censo sin parpadeo, pase/expediente, UI tokens |
| **7.3.8** | COAG separado de BH, balance NC en monitoreo, toast arranque DB, directorio LAN |
| **7.3.7** | Censo LAN sin pérdida por readmisión, importar expediente desde Drive |
| **7.3.6** | Identidad LAN por cliente, orchestrator modular, cultivo superset |
| **7.3.5** | Purga LAN con guard, PIN lockout, persistencia anfitrión |
| **7.3.4** | Perf lazy chunks, pendientes con vencimiento, censo virtual |
| **7.3.3** | EA balance I/O mixto, evacuaciones sin CC, dieta kcal total |
| **7.3.2** | Premium UI (nav + tokens), gráficas EA con pestañas, endurecimiento + LAN purge |
| **7.3.1** | Manejo modal SOME, AAS SOAP por dosis, borrar perfil farmacoterapéutico |
| **7.3.0** | Perfil histórico cross-mes, directorio LAN actividad, lab historial por fecha |
| **7.2.9** | Manejo parser dietas/P2, propuesta dieta EA, FAB copiar EA |
| **7.2.8** | Interno SV por frecuencia, glu rescate en EA, enlace iPad en cliente LAN |
| **7.2.7** | Interno: orden por frecuencia SV, UI glucometrías oscura |
| **7.2.6** | Entrega en censo, orden por cama, interno alineado, expediente fluido |
| **7.2.5** | Persistencia LAN anfitrión: commits coalescidos, shards por sala, labs en sidecar, SQL v15 |
| **7.2.4** | R4 como cliente primero, sin equipo obligatorio, barrido LAN para R4 |
| **7.2.3** | LAN anfitrión ward empaquetado, URL ward en shift-PIN, subred 10.0.57 |
| **7.2.2** | LAN cliente y reconexión: bearer de invitado, pegar dirección, PIN más rápido |
| **7.2.1** | LAN cross-VLAN: registro ward persistente, PIN + dirección, copiar dirección |
| **7.2.0** | Estabilización LAN: reconcilia código de equipo sin borrar datos, mDNS resiliente |
| **7.1.x** | Descubrimiento y reconexión LAN, LiveSync ligero, Aprender R+, guardia v7 |
| **7.0.x** | PIN del turno, Wi-Fi hospital, perfil Windows, delta sync |
| **6.x** | LiveSync LAN, iPad/móvil, guardia workbench, historia clínica, manejo clínico |
| **5.x** | Arquitectura modular, Pase, tendencias, LiveSync por sala |
| **3.x–2.x** | Laboratorio, expediente, sidebar, modo Sala/Interconsulta |

> 🔍 Para el detalle completo de cada versión, ver [CHANGELOG.md](./CHANGELOG.md).

---

## Funcionalidades

- **Laboratoriazo** — Interpreta resultados de laboratorio y genera diagramas visuales: Biometría Hemática, Coagulación, Diagrama de Gamble, Química Sanguínea, Gasometría y más. Historial por paciente y **tendencias** con mini-gráficas.
- **Expediente** — En vista Normal: **Paciente**, **Clínico**, **Resultados** y **Salida**. En **Sala**, **Clínico** incluye **Historia Clínica**, **Estado actual** y **Eventualidades**; en **Interconsulta**, Nota, Indicaciones y VPO. En **Modo Pase** el tablero de ronda sigue igual; al abrir un bloque entras al expediente con la misma organización de pestañas.
- **Historia Clínica (Sala)** — Ingreso institucional en 3 pasos, catálogos APP/AHF/IPAS, vista **Lectura** con texto compilado, ancla de laboratorios y sincronización en sala en vivo.
- **Eventualidades (Sala)** — Registro cronológico de hechos clínicos por día dentro de **Clínico**.
- **Estado Actual (Sala)** — Monitoreo estructurado en **Clínico → Estado actual**: medición, snapshot, balance hídrico, historial, tendencias y texto copiable; integración con medicamentos y LiveSync por sala.
- **Medicamentos** — Receta hospitalaria (TSV) en la pestaña **Manejo**, copia desde sistemas tipo SOME, volcado a nota / SOAP y copia al portapapeles.
- **Nota de Evolución** — Formulario estructurado que genera un archivo `.docx` listo para imprimir, con membrete y formato clínico. **Plantilla SOAP** integrada (Interconsulta). Formatos en blanco editables desde Mi Perfil (pestaña Nota).
- **Indicaciones médicas** — Generación de hoja de indicaciones en `.docx` con secciones configurables (Interconsulta). Formatos en blanco editables desde Mi Perfil (pestaña Indicaciones).
- **Valoración preoperatoria (VPO)** — Calculadora de riesgo, plantillas EKG/Rx, fármacos perioperatorios y texto copiable; **Interconsulta** en Clínico, **Sala** en Salida.
- **Receta médica HU** — PDF oficial 000-061-R-06-12 desde **Salida** (Interconsulta).
- **Listado de problemas** — Generación desde **Salida** (Sala).
- **Salida configurable** — Exportación clínica rápida del paciente actual en `.docx`, `.html` o `.txt` desde Nota/Indicaciones.
- **Auto-actualización** — La app detecta nuevas versiones automáticamente y se actualiza con un clic.
- **Búsqueda** — Pacientes en la barra lateral; **búsqueda unificada** (⌘/Ctrl+K) sobre notas e indicaciones.
- **Atajos** — **⌘/Ctrl+1** Laboratorio; **⌘/Ctrl+2** Expediente; **⌘/Ctrl+3** abre **Mi Perfil** en la barra lateral; **⌘/Ctrl+4** abre **Ajustes**.
- **Portabilidad** — Exporta / importa copia completa (JSON), **paciente único**, **rango de fechas** o **paquete sync** cifrado.

---

## Requisitos

- **Instalación desde el instalador oficial** (`.dmg` / `.exe`; instrucciones arriba en **Instalación**): no necesitas Python ni Node; los `.docx` se generan con módulos nativos en `lib/doc-generators/`.
- **Desarrollo desde el código fuente** (`npm start` / compilar tú mismo): **Node.js 22+** y `npm install`. La generación de **Nota**, **Indicaciones** y **Listado** usa el servidor Node (`lib/doc-generators/`). Python no forma parte del flujo de build ni de release.

Los documentos generados se guardan en tu carpeta **Descargas** por defecto. Puedes cambiar la carpeta de salida en **Ajustes** (icono ⚙ arriba a la derecha) → sección **Documentos y salida** → **Cambiar**. Allí también defines **Salida rápida** (`docx`, `html` o `txt`). **Respaldos**, **catálogo medicamentos (SOAP)**, **privacidad** y **actualizaciones** están en las demás secciones del mismo panel. En la barra lateral, **Mi Perfil** concentra médico tratante, plantillas por defecto y tutorial.

---

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ensamblar index.html + bundle del renderer (requerido antes de start o release)
npm run build:ui

# Ejecutar en modo desarrollo (prestart regenera el bundle si hace falta)
npm start

# Publicar release: versión en package.json, docs/RELEASE_NOTES_X.Y.Z.txt, README, data/release-notes-highlights.mjs; luego:
npm run build:ui
npm run bundle:renderer:prod   # incluido en prebuild:mac/win; corre explícito si solo publicas
npm run release:publish -- --yes   # tests, commit, build Mac+Win, tag, GitHub release

# Solo revisar/actualizar empaquetado electron-builder:
npm run release:sync-pack

# Compilar para Mac (arm64 + x64). Con certificado de firma en el llavero, electron-builder firma automáticamente.
npm run build:mac

# Igual que build:mac (nombre explícito para releases firmados)
npm run build:mac:signed

# Mac sin firma de desarrollador (ad-hoc; útil en CI o pruebas locales)
npm run build:mac:unsigned

# Mac más rápido: solo arm64 (omitir universal / segunda arquitectura)
npm run build:mac:arm64-only
```

Para **notarizar** tras firmar, exporta en la misma terminal antes de `build:mac:signed`:

- `APPLE_ID` — Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` — contraseña específica de app
- `APPLE_TEAM_ID` — identificador del equipo (10 caracteres)

Y en `package.json`, dentro de `build.mac`, añade `"notarize": true` (sin eso, el build firmado no pasa por notarización automática de electron-builder).

Firmar y notarizar **no acelera** el build: suele tardar más que un build sin notarizar. Para iterar más rápido en tu Mac Apple Silicon, `npm run build:mac:arm64-only` evita empaquetar la segunda arquitectura.

**Stack:** Electron 41 · Express 5 · electron-builder 26 · electron-updater 6 · Node doc generators (`lib/doc-generators/`)

---

## Architecture

R+ is an Electron desktop app with a LAN HTTP/WS server, SQLCipher clinical store, and an esbuild-bundled renderer. New UI work belongs in `public/js/features/*.mjs` — run `npm run build:ui` after edits; never hand-edit `public/js/chunks/` or `app.bundle.mjs`.

### Entry points

| Layer | File | Role |
|-------|------|------|
| Electron main | `main.js` | Window, auto-updater, IPC, spawns LAN server |
| Preload bridge | `preload.js` | `window.electronAPI` IPC surface |
| LAN server | `server.js` | Express routes, doc export, interno mobile, WS hub (port **3738**) |
| Renderer boot | `public/js/app.js` → `app-runtimes.mjs` | Feature registration via `windowHandlers` |
| Node shared logic | `lib/` | SQLCipher store (`lib/db/`), doc generators, interno, entrega |
| LAN host | `lan-squad/` | Auth, host-store, persistence, conflict resolver |

Mapa completo: `.cursor/rules/project-context.mdc` y `docs/core/04-directory-structure.md`.

---

## Actualizaciones

La app busca actualizaciones automáticamente al iniciar. También puedes verificar manualmente desde el menú **R+ → Buscar actualizaciones…** (Mac) o **Aplicación → Buscar actualizaciones…** (Windows).

En **macOS**, el instalador automático (Squirrel) solo acepta actualizaciones firmadas de forma compatible con la app ya instalada; el **identificador de paquete** (`appId`) debe mantenerse entre versiones. El nombre visible sigue siendo «R+»; el id interno no afecta el título de la ventana.

### Canal de actualizaciones (estable / pre-releases)

En **Ajustes → Aplicación y actualizaciones → Canal de actualizaciones** puedes elegir entre:

- **Estable** (predeterminado): solo recibes releases publicados oficialmente.
- **Pre-releases (borradores)**: además recibes borradores de GitHub (pre-releases). El modal solo muestra el distintivo **Pre-release** cuando la versión disponible en GitHub está marcada como pre-release (no por tener activado el canal en Ajustes). Puedes volver a Estable en cualquier momento.

El canal se guarda localmente (`rpc-settings.updateChannel`, valores internos `estable` o `beta`) y se sincroniza con `electron-updater` al iniciar la app vía IPC (`autoUpdater.allowPrerelease`).

### Telemetría anónima de actualización (opcional)

- **Desactivada por defecto.** Se habilita en **Ajustes → Aplicación y actualizaciones → Enviar telemetría anónima de actualización**.
- Cuando está activa, al completar una actualización (éxito o fallo) se envía un `POST` no bloqueante con exactamente `{ version, result, platform }`.
- **Nunca** se envían datos clínicos ni identificables del paciente, del usuario, de la red, ni del equipo.
- Los errores de red son silenciosos; el toggle es la única forma de enviar datos. La URL de telemetría es configurable en `public/js/app.js` (constante `UPDATE_TELEMETRY_URL`).

### Versión mínima soportada

Al iniciar, R+ intenta leer `min-version.json` desde el repositorio oficial (`main` branch) con el formato:

```json
{ "minVersion": "1.8.0", "message": "Por favor actualiza para continuar." }
```

Si la versión instalada es menor a `minVersion`, se muestra un modal **bloqueante no descartable** (no se puede cerrar con Escape ni haciendo clic fuera) con dos acciones: **Buscar actualización** (usa el autoupdater) y **Descargar desde GitHub** (abre Releases). Si el fetch falla o el archivo no existe, no se bloquea al usuario.

### Restaurar versión estable anterior (6.5.8+)

En **Ajustes → Aplicación y actualizaciones**, **Restaurar versión estable anterior** lista releases curadas en `stable-versions.json` (solo versiones **menores** que la instalada). R+ intenta descargar e instalar in-app; si falla (red, firma macOS), ofrece abrir el instalador correcto en GitHub. Tus datos en `userData` y la base clínica **no se borran**.

### Volver a una versión anterior (rollback manual)

Si prefieres instalar a mano o la versión no está en el catálogo curado, reinstala desde Releases siguiendo estos pasos.

**Antes de empezar (recomendado):**

- **Haz un respaldo** desde **Ajustes → Respaldo local → Exportar copia de seguridad…** (o **Exportar paciente actual / Exportar por rango** si solo quieres parte de los datos). Guarda el `.json` fuera de la carpeta de la app.
- Confirma la versión instalada actualmente en **Ajustes → Aplicación → Versión** por si necesitas regresar.

**Pasos:**

1. **Cierra R+ Cardio por completo** (en macOS, ⌘Q; no basta con cerrar la ventana).
2. Abre la página de [Releases](https://github.com/mausalas99/r-plus-cardio/releases) y localiza la versión a la que quieres volver (**no uses “Latest”**). Expande **Assets** y descarga el instalador adecuado:
   - **Mac Apple Silicon (M1/M2/M3/M4):** `R+ Cardio-x.x.x-arm64.dmg`
   - **Mac Intel:** `R+ Cardio-x.x.x-x64.dmg`
   - **Windows:** `R+ Cardio-x.x.x-x64.exe`
3. Instala la versión descargada:
   - **Mac:** abre el `.dmg` y arrastra **R+ Cardio** a **Aplicaciones**. Si macOS ofrece **Reemplazar**, acéptalo. Si aparece un aviso de firma inválida, elimina R+ Cardio desde `Aplicaciones` (a la Papelera) y vuelve a instalar desde el `.dmg` descargado.
   - **Windows:** ejecuta el `.exe` del instalador; por defecto sobrescribe la instalación actual.
4. Abre R+ Cardio y confirma la versión en **Ajustes → Aplicación → Versión**.
5. Si la auto-actualización vuelve a proponerte la versión nueva y aún no quieres actualizar, en macOS puedes **esperar 24h** (la app respeta el snooze por versión), o cambiar a canal **Estable** si estabas en **Pre-releases**.

**Datos locales y compatibilidad:**

- Tus datos (pacientes, notas, indicaciones, historial de labs, respaldos JSON, ajustes) están en el `userData` de Electron — abre la carpeta desde **Ajustes → Datos en esta computadora → Abrir carpeta…**. **No se borran** al reinstalar una versión anterior.
- Si una release documenta un **cambio de formato incompatible**, importa tu respaldo `.json` más reciente desde **Ajustes → Respaldo local → Importar copia de seguridad…** después de reinstalar la versión anterior.
- En macOS, `electron-updater` requiere misma firma y `appId` (`com.hospitaluniversitario.cardionotas`) entre versiones. Si cambias manualmente entre una build firmada y otra ad-hoc, es normal que la auto-actualización falle: reinstala desde el `.dmg` para resolverlo.

---

**Autor:** Mauricio Salas
