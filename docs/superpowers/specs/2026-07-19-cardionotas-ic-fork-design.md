# Cardionotas — design (fork cardiología de R+)

**Date:** 2026-07-19  
**Status:** draft for review  
**Reference export:** formato de seguimiento intrahospitalario IC descompensada (docx Ma. Elena Contreras Alvarado 19.03.26) — **esquema inamovible**; solo se rellena contenido.

## 1. Goal

Cardionotas is a **dedicated Electron app** (fork of R+: clone and strip) for inpatient **heart-failure decongestion** follow-up. Residents capture structured day-to-day data (vitals, balance, congestion/POCUS, meds, labs, events) and export the **fixed IC follow-up .docx**.

**North star (Cardionotas):** paste/capture → fill the IC sheet → print, without rebuilding Word layouts.

## 2. Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Relation to R+ | Dedicated fork (not a mode inside R+) |
| MVP scope | IC follow-up + useful R+ pieces: labs/tendencias, HC, Estado actual, Eventualidades, **Pase local** |
| Out of MVP | Interconsulta, VPO, Receta HU, **LiveSync / LAN sync / mobile sync clients** |
| Build approach | Clone R+ and strip; rename product to Cardionotas |
| Eventualidades | Day-by-day capture; export concatenates **all** hospitalization entries |
| Congestión | Checklist + structured daily POCUS; **quick selectors** where possible; free text only where needed |
| Medicamentos | Live in **Manejo**; docx column schema; catalog/repo for types; dose-change history (implicit suspension) |
| Acumulados | Calculated with **manual override** (recalc does not stomp override until user asks) |
| Docx | Fixed template structure; fill only; never reorder sections |

## 3. Information architecture

```
Cardionotas
├── Pacientes (sidebar / censo)
├── Pase (local only — no LAN host)
└── Expediente (paciente activo)
    ├── Paciente
    ├── Clínico
    │   ├── Historia Clínica
    │   ├── Estado actual   ← vitals, balance, descongestión, congestión/POCUS, meds activos (RO)
    │   └── Eventualidades
    ├── Resultados          ← labs + tendencias
    ├── Manejo              ← fantásticos, otros meds, diuréticos (+ repo)
    └── Salida              ← Generar hoja IC (.docx)
```

## 4. What we keep / strip / add from R+

### Keep
- Local SQLCipher clinical store and patient list
- Historia Clínica (Sala)
- Estado actual core: signos vitales, balance hídrico, estado clínico, historial/tendencias locales
- Eventualidades (dated entries)
- Laboratorio / tendencias
- Local Pase / censo UI (without LiveSync wiring)

### Strip or hide in v1
- Interconsulta mode and related note/indicaciones/VPO paths as primary UX
- Valoración preoperatoria (VPO)
- Receta médica HU
- LiveSync: PIN host, mDNS/UDP discovery, delta sync, mobile `/mobile` `/interno` sync clients as product features (code may remain dead until later; UI off)

### Add
- Decongestion header + congestion/POCUS daily model in Estado actual
- Manejo tables: four pillars + other meds + diuretic dose timeline + medication catalog
- IC docx exporter bound to the fixed template
- Branding/package rename: Cardionotas (app id, window title, docs)

## 5. Estado actual (IC extensions)

### 5.1 Decongestion header
- **Fecha ingreso** (patient) → **días de internamiento** (calculated)
- **Fecha inicio descongestión** (editable) → **días en descongestión** (calculated)
- **Diuresis 24h** (from balance) + **diuresis acumulada** (sum of daily diuresis; override allowed)
- **Dosis furosemida acumulada (mg)** (sum from Manejo diuretic history; override allowed)

**Override rule:** once the user edits an accumulated field, mark `override=true` for that field; auto-recalc skips it until “Recalcular” clears the override.

### 5.2 Existing R+ blocks
Signos vitales, balance hídrico, estado clínico — behavior as in R+ unless a field conflicts with IC export naming (map at export time).

### 5.3 Congestión clínica (checklist, selectors)
Per day (or current snapshot that becomes the day’s record):
- PVY present/absent (or −/+)
- RHY present/absent
- Soplo: Sí/No (+ optional free-text description)
- Estertores/derrame: Sí/No + optional specify
- Ascitis/hepatomegalia: Sí/No
- Edema MI: Sí/No (+ optional grade/text)
- Llenado capilar: value (selector or short text)

### 5.4 POCUS diario (structured + free text)
One record per calendar day (history like reference docx 13.03→19.03):
- VCI (cm) + collapse behavior (selector / short text)
- VExUS score (0–3 selector)
- Congestion score (number) + which components sum (selectors / chips + optional note)
- US pulmonar: patrón A/B + líneas B density (selectors) + optional free text
- Stevenson: A / B / C / L
- Optional free-text POCUS note for anything selectors cannot express

### 5.5 Meds activos (read-only)
Derived from Manejo: regimens without implicit end (open last dose row). Display name + current dose. No editing in Estado actual.

## 6. Manejo (source of truth for meds)

### 6.1 Cuatro fantásticos
Fixed four class slots (IECA/ARA/ARNI, SGLT2i, betabloqueador, MRA), each with:
- Drug name (catalog + free text)
- Inicio
- Dosis
- Tolerancia (suggestions + free text)

Export columns match docx: **Tipo | Inicio | Dosis | Tolerancia**.

### 6.2 Otros medicamentos
App model: ordered **dose segments** per drug:
- `tipo` (from repo or free text → can save to repo)
- `inicio` (date this dose started)
- `dosis` (text, e.g. `40 mg cada 12h`)
- `indicacion` (suggestions + free text)
- Closing a segment / starting a new dose = history; ending without successor = **implicit suspension**

Export columns match docx: **Tipo | Inicio | Dosis | Indicación** (no suspensión column). Export lists dose segments as rows (as in the reference “otros medicamentos” / diuretic strategy tables).

### 6.3 Diuréticos
Same segment model; primary agent for cumulative mg is furosemida (IV/VO). Other loop diuretics may be catalogued; cumulative “furosemida acumulada” converts or tracks furosemida-equivalent only if we define a simple rule in implementation — **v1 default:** sum only explicit furosemida mg from segments; note other loops in table without adding to that counter unless user override.

### 6.4 Medication repository
User-extendable catalog of medication **Tipo** (and optional default indication hints) for quick select next time — shared pattern for fantásticos drug names and “otros”.

## 7. Eventualidades

Unchanged model vs R+: `{ id, at, text }`.  
Export block **Eventos:** all entries for the admission, chronological, dated (e.g. `14.03.26 …`).

## 8. Resultados

Reuse R+ lab paste/historial/tendencias.  
Export **LABORATORIOS:** group by date into the fixed docx sections; empty days omitted; do not invent values.

## 9. Export — hoja IC (fixed schema)

- Template file checked into the repo (binary .docx matching institutional layout).
- Generator fills content controls / bookmarks / known paragraph anchors — implementation detail in the plan; **constraint:** section order and labels stay identical to the reference.
- Empty fields: blank or `—` per template convention; never delete sections.
- Export “as of” date: selectable in Salida (default today); drives which POCUS/vitals day is “actual” while still including full histories where the template expects them (POCUS series, events, labs, diuretic strategy).

### Data → template mapping (summary)

| Docx region | Source |
| --- | --- |
| ID / ingreso / fenotipo | Paciente + HC |
| PEEA / antecedentes | HC |
| Días / descongestión / acumulados | Estado actual header |
| Vitals / checklist congestión | Estado actual (as-of day) |
| POCUS series | Estado actual POCUS history |
| Esquema diuréticos / acumulada | Manejo diuréticos + EA |
| Fantásticos / otros | Manejo |
| Eventos | Eventualidades |
| Labs | Resultados |
| Impresión diagnóstica | HC / problemas |

## 10. Data model (logical)

```
Patient
  identity, ingresoDate, …
  hc: ClinicalHistory
  monitoreo: EstadoActual  // vitals, balance, clinico, congestionByDay[], pocusByDay[], overrides
  eventualidades: { entries[] }
  labs: …
  manejo:
    fantasticos: { class, drug, inicio, dosis, tolerancia }[4]
    medSegments: { tipo, inicio, dosis, indicacion, endedAt? }[]
    diureticSegments: same shape
  medCatalog: { tipo, defaultIndicacion? }[]
```

Persistence: extend R+ SQLCipher / JSON patient blob patterns already used for `monitoreo` and eventualidades — exact tables in the implementation plan.

## 11. Non-goals (v1)

- LAN LiveSync / multi-Mac host
- Broader cardiology templates (ACS, device clinic) beyond IC sheet
- Changing the institutional docx layout
- Autonomous dosing or diagnostic suggestions
- Cloud PHI

## 12. Success criteria

1. Clone/strip produces a runnable Cardionotas app with Pase local and no LiveSync UX.
2. User can document a case equivalent to the Ma. Elena reference across days.
3. **Generar hoja IC** yields a .docx whose **structure matches** the reference template; content populated from app data.
4. Accumulated diuresis/furosemida and day counts match hand calculation unless overridden.
5. Labs and eventualidades appear in the export in chronological order.

## 13. Implementation order (preview; detail in plan)

1. Bootstrap repo from R+ (clone into Cardionotas), rename, strip LiveSync/Interconsulta/VPO UX.
2. Data model + UI: descongestión header + congestion/POCUS in Estado actual.
3. Manejo tables + catalog + dose segments; wire activos RO into EA.
4. IC docx template + exporter mapping.
5. Fixture patient (Ma. Elena-shaped) + export golden check (structure/smoke).
6. Docs / onboarding copy for Cardionotas.

## 14. Open points deferred to implementation plan

- Exact docx fill mechanism (OOXML bookmarks vs paragraph replace vs docx library used by R+).
- Whether stripped LiveSync code is deleted or feature-flagged dead.
- Furosemida-equivalent for non-furosemide loops (v1: furosemida-only sum).
