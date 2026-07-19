const PIPE_SEP = '\\|+';

/** cama (206-2 o 213) | nombre | edad (AÑOS opcional) | registro | resumenDx */
const PIPE_WITH_CAMA_RE = new RegExp(
  `^(\\d+(?:-\\d+)?)\\s*${PIPE_SEP}\\s*(.+?)\\s*${PIPE_SEP}\\s*(\\d+)\\s*(?:AÑOS)?\\s*${PIPE_SEP}\\s*([\\d-]+)\\s*${PIPE_SEP}\\s*(.+)$`,
  'i',
);

/** nombre | edad (AÑOS opcional) | registro | resumenDx (sin cama) */
const PIPE_NAME_FIRST_RE = new RegExp(
  `^(.+?)\\s*${PIPE_SEP}\\s*(\\d+)\\s*(?:AÑOS)?\\s*${PIPE_SEP}\\s*([\\d-]+)\\s*${PIPE_SEP}\\s*(.+)$`,
  'i',
);

const FICHA_KV_RE = /^([A-ZÁÉÍÓÚÑ\s]+)\s*:\s*(.+)$/i;

/**
 * @param {string} line
 * @returns {{ cama: string, nombre: string, edad: string, registro: string, resumenDx: string } | null}
 */
function parsePipeLine(line) {
  const t = String(line || '').trim();
  if (!t.includes('|')) return null;

  const withCama = PIPE_WITH_CAMA_RE.exec(t);
  if (withCama) {
    return {
      cama: withCama[1].trim(),
      nombre: withCama[2].trim(),
      edad: withCama[3].trim(),
      registro: withCama[4].trim(),
      resumenDx: withCama[5].trim(),
    };
  }

  const nameFirst = PIPE_NAME_FIRST_RE.exec(t);
  if (nameFirst && !/^\d+(?:-\d+)?$/.test(nameFirst[1].trim())) {
    return {
      cama: '',
      nombre: nameFirst[1].trim(),
      edad: nameFirst[2].trim(),
      registro: nameFirst[3].trim(),
      resumenDx: nameFirst[4].trim(),
    };
  }

  return null;
}

/**
 * @param {string[] | string} firstLines
 * @returns {{ cama: string, nombre: string, edad: string, registro: string, resumenDx: string } | null}
 */
export function parsePipeHeader(firstLines) {
  const lines = Array.isArray(firstLines) ? firstLines : String(firstLines || '').split('\n');
  for (const raw of lines.slice(0, 12)) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const parsed = parsePipeLine(line);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * @param {string} block
 * @returns {{ identificacion: Record<string, string>, sexo: 'M' | 'F' | '' }}
 */
export function parseFichaIdentificacion(block) {
  /** @type {Record<string, string>} */
  const identificacion = {};
  let sexo = '';
  const lines = String(block || '').split('\n');
  const keyMap = {
    NOMBRE: 'nombre',
    EDAD: 'edad',
    SEXO: 'sexo',
    REGISTRO: 'registro',
    ORIGEN: 'lugarNacimiento',
    'LUGAR DE NACIMIENTO': 'lugarNacimiento',
    'FECHA DE NACIMIENTO': 'fechaNacimiento',
    RESIDENCIA: 'residencia',
    OCUPACIÓN: 'ocupacionActual',
    OCUPACION: 'ocupacionActual',
    'OCUPACIÓN ACTUAL': 'ocupacionActual',
    'OCUPACION ACTUAL': 'ocupacionActual',
    'OCUPACIÓN ANTERIOR': 'ocupacionAnterior',
    'OCUPACION ANTERIOR': 'ocupacionAnterior',
    ESCOLARIDAD: 'escolaridad',
    'ESTADO CIVIL': 'estadoCivil',
    RELIGIÓN: 'religion',
    RELIGION: 'religion',
    RESPONSABLE: 'informante',
    'TELÉFONO FAMILIAR': 'telefonoFamiliar',
    'TELEFONO FAMILIAR': 'telefonoFamiliar',
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = FICHA_KV_RE.exec(line);
    if (!m) continue;
    const label = m[1].trim().toUpperCase();
    const value = m[2].trim();
    const field = keyMap[label];
    if (field) {
      identificacion[field] = value;
      if (field === 'sexo') {
        if (/FEMENIN/i.test(value)) sexo = 'F';
        else if (/MASCULIN/i.test(value)) sexo = 'M';
      }
    }
  }

  if (identificacion.nombre && !identificacion.informante) {
    identificacion.informante = identificacion.nombre;
  }

  return { identificacion, sexo };
}

/**
 * @param {{ cama?: string, nombre?: string, edad?: string, registro?: string, resumenDx?: string } | null} pipe
 * @param {{ identificacion: Record<string, string>, sexo: string }} ficha
 * @returns {{ cama: string, nombre: string, edad: string, registro: string, resumenDx: string, sexo: string, identificacion: Record<string, string> }}
 */
function resolveHeaderEdad(idEdad, pipeEdad) {
  const edadMatch = /(\d+)/.exec(String(idEdad || ''));
  return edadMatch ? edadMatch[1] : pipeEdad || '';
}

export function mergeHeader(pipe, ficha) {
  const id = ficha.identificacion || {};
  return {
    cama: pipe?.cama || '',
    nombre: id.nombre || pipe?.nombre || '',
    edad: resolveHeaderEdad(id.edad, pipe?.edad),
    registro: id.registro || pipe?.registro || '',
    resumenDx: pipe?.resumenDx || '',
    sexo: ficha.sexo || '',
    identificacion: Object.assign({}, id),
  };
}
