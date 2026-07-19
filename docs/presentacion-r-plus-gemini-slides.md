# R+ — Brief para Gemini (Google Slides)

> **Uso:** Copia todo el bloque **「PROMPT MAESTRO」** en Gemini (Gemini → Crear con Gemini en Google Slides, o pega el brief completo y pide «Genera la presentación siguiendo este formato»). Ajusta `[TU NOMBRE]`, `[SERVICIO]` y `[FECHA]` antes de enviar.

---

## Índice

- [PROMPT MAESTRO](#prompt-maestro-copiar-desde-aqui)
- [DIAPOSITIVAS](#diapositivas-contenido-fuente)
  - [Diapositiva 1 — Portada](#diapositiva-1-—-portada)
  - [Diapositiva 2 — El problema](#diapositiva-2-—-el-problema-que-resolvemos)
  - [Diapositiva 3 — Qué es (y qué NO es)](#diapositiva-3-—-que-es-y-que-no-es)
  - [Diapositiva 4 — Arquitectura](#diapositiva-4-—-arquitectura-en-30-segundos)
  - [Diapositiva 5 — Flujo clínico](#diapositiva-5-—-flujo-clinico-principal)
  - [Diapositiva 6 — Seguridad paciente](#diapositiva-6-—-seguridad-del-paciente-ingenieria-clinica)
  - [Diapositiva 7 — Integridad del dato](#diapositiva-7-—-integridad-del-dato-varios-residentes)
  - [Diapositiva 8 — Seguridad de red](#diapositiva-8-—-seguridad-de-red-lan)
  - [Diapositiva 9 — Auditoría](#diapositiva-9-—-auditoria-y-trazabilidad-alcance-actual)
  - [Diapositiva 10 — Limitaciones](#diapositiva-10-—-limitaciones-y-riesgos-slide-obligatorio)
  - [Diapositiva 11 — Roadmap](#diapositiva-11-—-roadmap:-planes-frente-a-cada-limitacion)
  - [Diapositiva 12 — Propuesta de piloto](#diapositiva-12-—-propuesta-de-piloto)
  - [Diapositiva 13 — Cierre](#diapositiva-13-—-cierre)
- [APÉNDICE — Roadmap detallado](#apendice-—-roadmap-detallado-referencia-para-el-presentador)
- [APÉNDICE — FAQs](#apendice-—-preguntas-frecuentes-slide-opcional-14)
- [APÉNDICE — Instrucciones Gemini](#apendice-—-instrucciones-extra-para-gemini)
- [Checklist](#checklist-antes-de-presentar)

---

## PROMPT MAESTRO (copiar desde aquí)

```
Eres un diseñador de presentaciones institucionales en salud. Genera una presentación en español (México) de 14 diapositivas para Google Slides, audiencia: jefe de departamento / comité clínico de un hospital universitario.

REGLAS DE DISEÑO (obligatorias):
- Estilo: clínico-institucional, sobrio, confiable. Sin gradientes llamativos ni stock photos genéricos de médicos sonriendo.
- Paleta (alineada al producto R+):
  - Fondo principal: #ECEEF2 (gris papel)
  - Superficie / tarjetas: #FFFFFF
  - Texto principal: #1A2332
  - Texto secundario: #5C6778
  - Acento / botones / íconos destacados: #4A52E8 (índigo clínico)
  - Éxito / controles implementados: #047857 sobre fondo #ECFDF5
  - Advertencia / límites / riesgos: #C62828 sobre fondo #FEF2F2
  - Planificado / roadmap: #4A52E8 con badge «Fase 2» o «Fase 3» en pill pequeña
  - Ya implementado: #047857 con check ✓
  - Depende del hospital (legal/IT): #5C6778 con icono edificio
- Tipografía: sans-serif (Inter, Source Sans 3 o equivalente en Slides). Títulos 28–32 pt semibold; cuerpo 16–18 pt; notas al pie 12 pt en #5C6778.
- Layout: mucho espacio en blanco; máximo 5 viñetas por slide; una idea principal por diapositiva.
- Elementos visuales: iconos lineales simples (escudo, laptop, red local, checklist, advertencia); diagramas en bloques con bordes redondeados 10px; sin más de 2 colores de acento por slide.
- Pie de diapositiva (todas excepto portada y cierre): texto pequeño «R+ · Herramienta clínica de escritorio · Uso bajo revisión institucional».
- Marca: título del producto siempre «R+» (con signo más), subtítulo «Laboratoriazo + documentación clínica».

TONO DEL CONTENIDO:
- Honesto: R+ NO es un EMR certificado del hospital; es coadyuvante de documentación y decisión en guardia.
- Destacar seguridad clínica y controles LAN ya implementados.
- Incluir slide explícito de limitaciones (diapositiva 10) y, justo después, slide de ROADMAP (diapositiva 11) que mapee cada limitación a un plan con fase y estado (Implementado / Planificado / Con el hospital).
- Evitar afirmar HIPAA, NOM-024 o LFPDPPP sin evaluación formal; en roadmap, marcar cumplimiento normativo como «evaluación institucional», no como feature de software.

Genera cada diapositiva con: TÍTULO, CUERPO (viñetas o tabla), ELEMENTO VISUAL SUGERIDO, NOTAS DEL PRESENTADOR (2–3 frases).
La diapositiva 11 debe ser una TABLA de 4 columnas: Limitación | Plan de remediación | Fase | Estado.
```

---

## DIAPOSITIVAS (contenido fuente)

### Diapositiva 1 — Portada
**Título:** R+  
**Subtítulo:** Documentación clínica y apoyo a decisiones en guardia  
**Línea 3:** Presentación a `[SERVICIO]` · `[FECHA]`  
**Presenta:** `[TU NOMBRE]` · Residente / Médico adscrito  

**Visual:** Logo textual «R+» grande en índigo #4A52E8; fondo #ECEEF2; línea decorativa fina índigo.

**Notas del presentador:** Aclarar desde el inicio que no es un reemplazo del EMR institucional. Objetivo: acordar piloto y requisitos de gobernanza.

---

### Diapositiva 2 — El problema que resolvemos
**Título:** Por qué existe R+

**Viñetas:**
- El flujo en guardia mezcla labs SOME, notas, indicaciones y calculadoras en herramientas dispersas.
- Pérdida de tiempo y riesgo de error en dosis, electrolitos y documentos Word sueltos.
- Varios residentes atienden al mismo paciente sin control de versiones.

**Visual:** Tres iconos en fila (reloj, alerta médica, personas).

**Notas:** Enfocar dolor operativo del servicio, no tecnología por tecnología.

---

### Diapositiva 3 — Qué es (y qué NO es)
**Título:** Alcance del producto

| Es | No es |
|----|--------|
| Estación de escritorio para notas, indicaciones y labs | EMR oficial del hospital |
| Sincronización opcional en red local de la sala | Plataforma en la nube con PHI |
| Apoyo con reglas de seguridad clínica | Sustituto de dictamen legal / NOM-024 |

**Visual:** Tabla de dos columnas; columna «No es» con fondo #FEF2F2 suave.

**Notas:** Esta slide evita que el jefe cierre la conversación por expectativa equivocada.

---

### Diapositiva 4 — Arquitectura en 30 segundos
**Título:** Cómo funciona técnicamente

**Viñetas:**
- App **Electron** (Mac/Windows): interfaz en `localhost:3738`.
- Servidor embebido en la misma laptop: UI + generación de DOCX/PDF + API de sala en vivo.
- Datos del turno en disco local (`userData`); sincronización solo dentro de la **LAN hospitalaria**.
- iPad u otra Mac se unen con invitación temporal → token Bearer (no contraseña en URL).

**Visual:** Diagrama simple: [Laptop anfitrión] ↔ Wi‑Fi hospital ↔ [iPad / 2.ª Mac]. Flechas bidireccionales. Puerto «3738» en etiqueta pequeña.

**Notas:** Residencia de datos en equipos del hospital; sin vendor cloud de expediente.

---

### Diapositiva 5 — Flujo clínico principal
**Título:** Qué hace el médico en el día a día

**Viñetas:**
- **Expediente:** labs (SOME), tendencias, cultivos, estado actual, manejo.
- **Documentos:** nota de evolución e indicaciones en DOCX desde plantillas.
- **Historia clínica de ingreso:** secciones versionadas (ficha, AHF, APP, etc.).
- **Sala en vivo:** mismo censo de pacientes del turno entre dispositivos.

**Visual:** Bento de 4 tarjetas blancas sobre fondo gris papel.

**Notas:** Mencionar VPO/censo solo si el servicio los usa.

---

### Diapositiva 6 — Seguridad del paciente (ingeniería clínica)
**Título:** Protecciones contra error médico

**Viñetas:**
- Topes en calculadoras (ej. vancomicina, K⁺ fraccionado en bolsas, bicarbonato).
- Catálogo de **reglas de alto riesgo** (fármaco + contexto de laboratorio).
- El usuario debe **confirmar** antes de guardar con riesgo documentado.
- Reconocimientos quedan en **audit_log**, no solo en texto libre.

**Visual:** Icono escudo verde #047857 + checklist.

**Notas:** Esto suele interesar más al jefe clínico que el firewall.

---

### Diapositiva 7 — Integridad del dato (varios residentes)
**Título:** Edición concurrente sin sobrescritura silenciosa

**Viñetas:**
- Cada entidad clínica tiene **versión**; el servidor valida antes de guardar.
- Si dos editan el mismo campo → **conflicto 409** + visor de diferencias.
- Borrador local (IndexedDB) para no perder trabajo.
- Cola de escritura atómica en historia clínica + auditoría.

**Visual:** Dos siluetas de usuario → flecha a «merge» o «conflicto».

**Notas:** Analogía: «como control de versiones en el expediente del turno».

---

### Diapositiva 8 — Seguridad de red (LAN)
**Título:** Controles ya implementados en la sala en vivo

**Viñetas:**
- Token de equipo **64 caracteres** (criptográfico); se rechaza «1234» y tokens débiles.
- API solo con **`Authorization: Bearer`** (no secreto en URL).
- Emparejamiento: ticket/PIN de un solo uso con TTL (~5 min).
- **Rate limiting** en API y generación de documentos.
- Logs con **redacción de secretos**.

**Visual:** Candado índigo + tabla mini de «Implementado ✓».

**Notas:** Aclarar: tráfico LAN en HTTP sin TLS — red hospitalaria de confianza, no Internet público.

---

### Diapositiva 9 — Auditoría y trazabilidad (alcance actual)
**Título:** Qué queda registrado hoy

**Viñetas:**
- `audit_log` por paciente/sala: acciones, secciones, alertas de seguridad con contexto de labs.
- Tope rotativo de **500 entradas** por log (buffer local).
- Exportación de documentos: tipo, registro, estado (sin cuerpo completo de la nota en log).
- Identificador de cliente (`clientId`) — **no** login individual por usuario aún.

**Visual:** Lista con icono de documento; badge «Local» en ámbar suave.

**Notas:** Ser transparente: no es auditoría empresarial centralizada.

---

### Diapositiva 10 — Limitaciones y riesgos (slide obligatorio)
**Título:** Lo que aún NO cumple un EMR regulado

**Viñetas (fondo advertencia suave):**
- Estado en disco: **JSON sin cifrado SQLCipher** (mitigación: FileVault/BitLocker).
- **Sin RBAC** ni SSO: token compartido del turno.
- **Sin TLS** en LAN; no exponer puerto 3738 fuera del hospital.
- Sin cadena antimanipulación ni retención legal centralizada.
- Sin dictamen formal HIPAA / NOM-024 / LFPDPPP.

**Visual:** Triángulo de advertencia #C62828; máximo 5 líneas.

**Notas:** Mostrar madurez profesional; invita a colaboración de IT y legal. Transición: «En la siguiente diapositiva mostramos el plan documentado para cerrar cada brecha».

---

### Diapositiva 11 — Roadmap: planes frente a cada limitación
**Título:** Plan de remediación (documentado en el proyecto)

**Subtítulo:** Programa en 3 fases · especificación interna mayo 2026

**Tabla (4 columnas — usar en Slides):**

| Limitación actual | Plan de remediación | Fase | Estado |
|-------------------|---------------------|------|--------|
| Datos en JSON en texto plano en disco | Migrar a **SQLite + SQLCipher**; script de migración desde estado actual; respaldos | Fase 2 · Arquitectura | Planificado |
| Token compartido del turno (sin usuario nominal) | **RBAC** (médico, enfermería, admin, auditor); sesiones con timeout; cada cambio ligado a usuario autenticado | Fase 3 · Listo para operación | Planificado |
| Auditoría local (500 entradas, sin antimanipulación) | **Log criptográfico** con hash encadenado; export seguro para revisión medicolegal / regulador | Fase 3 | Planificado |
| HTTP sin TLS en LAN (3738) | **WSS** y cabeceras de seguridad (CSP, HSTS donde aplique); decisión conjunta con TI sobre VLAN y certificados | Fase 2–3 + **Hospital** | Planificado · requiere TI |
| NOM-024, LFPDPPP, HIPAA | **Evaluación formal** con legal y protección de datos del hospital; mapeo de controles, no solo código | **Institucional** | Con el hospital |
| Integración como EMR oficial | Definir alcance: **coadyuvante** vs interfaz al EMR institucional (fuera del alcance v1 del producto) | **Institucional** | Por acordar |

**Viñetas bajo la tabla (logros Fase 1 ya entregados):**
- ✓ Seguridad LAN: token criptográfico, Bearer, tickets/PIN, rate limit, redacción de logs.
- ✓ Seguridad clínica: topes en calculadoras, reglas de alto riesgo, auditoría en historia de ingreso.
- ✓ Documentos nativos en JavaScript (sin subprocesos Python en notas/indicaciones/listado).
- ✓ Versionado y resolución de conflictos (base para CRDT **Yjs/Automerge** en Fase 2).

**Visual:** Línea de tiempo horizontal con 3 bloques — **Fase 1** (verde, «Mayoría completada») → **Fase 2** (índigo, «Arquitectura») → **Fase 3** (índigo oscuro, «Operación y cumplimiento»). La tabla ocupa el 60 % inferior del slide.

**Notas del presentador:** El roadmap no son promesas vagas: está en `docs/superpowers/specs/2026-05-30-r-plus-security-architecture-remediation-design.md`. Fase 1 ya cubre lo que más impacta errores de medicación y acceso LAN. Fases 2–3 requieren tiempo de desarrollo y, para TLS y normativa, participación activa de TI y legal. El piloto puede arrancar con mitigaciones de hoy (cifrado de disco + política de LAN) mientras avanza Fase 2.

---

### Diapositiva 12 — Propuesta de piloto
**Título:** Qué pedimos al departamento

**Viñetas:**
1. **Uso autorizado:** coadyuvante de documentación vs parte del expediente legal.
2. **IT:** VLAN/firewall para puerto 3738; cifrado de disco obligatorio en laptops del turno.
3. **Privacidad:** revisión LFPDPPP / oficial de protección de datos.
4. **Piloto:** una sala, 4–6 semanas, política escrita y contacto de incidentes.

**Visual:** Timeline horizontal de 4 fases.

**Notas:** Pedir decisión concreta al final, no solo «opinión».

---

### Diapositiva 13 — Cierre
**Título:** Resumen y siguientes pasos

**Viñetas:**
- R+ mejora velocidad y seguridad clínica en guardia con controles reales ya construidos.
- No sustituye al EMR; requiere marco institucional para datos y acceso.
- **Siguiente paso propuesto:** reunión con TI + privacidad + acuerdo de piloto en `[SERVICIO]`.

**Contacto:** `[TU CORREO]` · `[EXTENSIÓN / WHATSAPP PROFESIONAL]`

**Visual:** Fondo índigo suave; texto blanco en título; CTA «Agendar piloto».

**Notas:** Dejar 5 min para preguntas; tener laptop con demo offline lista.

---

## APÉNDICE — Roadmap detallado (referencia para el presentador)

Fuente: `docs/superpowers/specs/2026-05-30-r-plus-security-architecture-remediation-design.md` y planes de implementación asociados.

### Fase 1 — Entorno hospitalario inmediato (semanas 1–2)

| Objetivo | Detalle técnico | Estado en producto (v6.4.x) |
|----------|-----------------|----------------------------|
| Calculadoras seguras | Topes vanco/K⁺/bicarbonato; `ClinicalSafetyError` | Implementado |
| Auth LAN | Sin «1234»; token 64 hex; rotación sin borrar pacientes | Implementado |
| Red | Bearer en headers; tickets; WS auth frame; rate limiting | Implementado |
| Validación de entrada | Límites JSON; sanitización en rutas host | Parcial / en expansión |
| Historia clínica | Reglas + `audit_log` en guardado | Implementado (módulo reciente) |

### Fase 2 — Mejoras de arquitectura (semanas 3–4)

| Objetivo | Detalle técnico | Estado |
|----------|-----------------|--------|
| Cifrado en reposo | SQLCipher, esquema normalizado, migración desde JSON | Planificado |
| Sincronización | CRDT (Yjs o Automerge) además del resolver versionado actual | Planificado |
| Documentos | Generación 100 % JS (nota, indicaciones, listado) | Implementado |
| Tokens | Almacenamiento local cifrado con expiración | Planificado |
| Transporte | Evaluar **wss://** en LAN con certificados internos | Planificado + TI |

### Fase 3 — Operación y madurez regulatoria (semanas 5–6)

| Objetivo | Detalle técnico | Estado |
|----------|-----------------|--------|
| Auditoría | Log inmutable, atribución por usuario, export | Planificado |
| RBAC | Matriz de permisos por rol clínico | Planificado |
| Monitoreo | CSP, HSTS, respuestas de error sin fugas | Planificado |
| Pruebas | Pentest básico, validación farmacéutica de calculadoras | Planificado |

### Decisiones abiertas (mencionar si preguntan «cuándo»)

- Biblioteca CRDT: Yjs vs Automerge (sin fecha cerrada).
- Auth hospitalaria: usuario/contraseña vs certificado institucional.
- UI: migración incremental a React vs SPA actual (no bloquea piloto).
- Cumplimiento NOM-024: requiere dictamen del hospital, no solo releases de R+.

### Mensaje clave para el jefe

«Las limitaciones de la diapositiva 10 tienen dueño y fase en un plan escrito. Lo crítico para seguridad del paciente y acceso LAN ya está en producción; lo que falta para parecerse a un EMR regulado es sobre todo **cifrado, identidad de usuario y gobernanza institucional** — y eso lo alineamos con el piloto.»

---

## APÉNDICE — Preguntas frecuentes (slide opcional 14)

Si Gemini permite una diapositiva extra:

| Pregunta | Respuesta corta |
|----------|-----------------|
| ¿HIPAA? | Herramienta local; sin certificación HIPAA; alineable a políticas hospitalarias. |
| ¿Quién accedió? | Token del turno + clientId; no usuario nominal aún. |
| ¿Laptop robada? | Hoy: FileVault/BitLocker. Futuro: SQLCipher (Fase 2). |
| ¿Desde casa? | No recomendado; diseñado para LAN hospitalaria. |
| ¿Cuándo RBAC? | Fase 3 del plan de remediación; piloto puede usar token de turno + política escrita. |
| ¿Van a certificar NOM-024? | Solo con evaluación conjunta legal/TI del hospital; R+ entrega controles técnicos progresivos. |

---

## APÉNDICE — Instrucciones extra para Gemini

Pega después del prompt maestro si quieres refinar:

```
- Usa tema claro (no dark mode).
- En slides 3, 10 y 11 usa tablas nativas de Google Slides.
- Slide 11: tabla roadmap con columna Estado en color (verde Implementado, índigo Planificado, gris Con el hospital).
- En slide 4 genera un diagrama con formas, no imagen externa.
- Numeración de diapositivas abajo a la derecha excepto portada.
- Exporta también un guion de 10–12 minutos en párrafos separados bajo cada slide (más tiempo en slides 10–11).
```

---

## Checklist antes de presentar

- [ ] Sustituir placeholders `[SERVICIO]`, `[FECHA]`, `[TU NOMBRE]`, contacto.
- [ ] Demo en laptop con paciente de prueba (sin PHI real si política lo exige).
- [ ] Confirmar FileVault/BitLocker activo en la Mac de demo.
- [ ] Tener impreso o en notas: puerto 3738 y política «solo LAN».
- [ ] Acordar con el jefe si graban la sesión (PHI en demo).

---

*Documento generado para presentación institucional de R+ v6.4.x. Actualizar si cambia arquitectura de seguridad.*
