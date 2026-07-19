# Pacientes demo (modo presentación)

JSON generados desde el mismo seed que **Modo presentación** en la app.

## Forma más fácil (sin elegir archivo)

En **Ajustes → Ayuda → Tours**:

- **Importar DEMO PÉREZ (JSON incluido)**

Requiere `npm run build:ui` reciente (el JSON vive en `public/demo-patients/`).

## Archivos en disco

| Archivo | Uso en R+ |
|---------|-----------|
| **`demo-perez.json`** | **Importar paciente…** |
| **`demo-pitch-bundle.json`** | **Importar paciente…** (mismo paciente, formato bundle) |
| **`demo-pitch-rango.json`** | **Importar paciente…** o **Importar rango…** |

No uses **Importar copia de seguridad…** (espera `r-plus-backup`, respaldo completo de toda la app).

Formato: `r-plus-patient-export` v1 — mismos campos que **Exportar paciente** (`patient`, `note`, `indicaciones`, `labHistory`, `medReceta`).

## Regenerar

```bash
npm run export:demo-patients
```

## Importar

1. **Un paciente:** `demo-perez.json` → **Importar paciente…**
2. **Con listado + todos:** `demo-pitch-rango.json` → **Importar rango…**

Tras importar, R+ asigna un **id nuevo** (no conserva `demo-pitch`). La fecha de referencia del export es **10/05/2026** para archivos estables; en **modo presentación** el monitoreo (incluidas glucometrías) se ancla al día actual.
