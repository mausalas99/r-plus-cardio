# Demo IC — caso completo (hoja de seguimiento)

Ejemplo basado en el formato institucional de seguimiento IC descompensada.  
**Solo se anonimizó identidad**; el contenido clínico (POCUS diario, diuréticos, labs, eventos) es el de un caso real de referencia, listo para ver cómo se llena todo.

| Archivo | Uso |
|---------|-----|
| **`demo-ic-seguimiento.json`** | Importar en la app → paciente completo → **Generar hoja IC** |
| **`demo-ic-hoja-ejemplo.docx`** | Abrir en Word: hoja ya llena (ejemplo visual) |

## Identidad demo (anonimizada)

| Campo | Valor |
|-------|--------|
| Nombre | Rosa María Delgado Vázquez |
| Registro | DEMO-IC-0001 |
| Residente | Dra. Ana Laura Méndez Soto |
| Ingreso → corte | 13/03/2026 → 19/03/2026 |

## En la app

**Ajustes → Ayuda → Tours → Importar DEMO IC (caso completo)**

O **Importar paciente…** y elige `demo-ic-seguimiento.json` (también en `data/demo-patients/` y `public/demo-patients/`).

Luego: selecciona la paciente → **Expediente → Salida → Generar hoja IC** (fecha de corte `2026-03-19`).

## Regenerar el .docx de ejemplo

```bash
# Copia el docx de referencia y solo cambia identidad (script ad-hoc):
python3 -c "
# ver data/demo-patients/README.md en git history / agent notes
"
```

El `.docx` de ejemplo se generó desde el Word de referencia cambiando únicamente nombre, registro y residente.
