/**
 * Reportes SOME de cultivos para el tour pitch (DEMO PÉREZ).
 * Informes multipaciente con varios MICROORGANISMO por muestra y sourceText completo para chips S/I/R/ESBL.
 */

const PITCH_HEADER =
  'Expediente:\t0008421-7\tSolicitud:\t2605000001\n' +
  'Nombre:\tDEMO PÉREZ JUAN\tFecha Registro:\t11/04/2026 08:00:00 a. m.\n' +
  'Sexo:\tMASCULINO\tUbicación:\tSERVICIO DEMO\n' +
  'Edad:\t67\tMedico:\tSERVICIO DEMO\n';

function hdr(fecha, solicitud) {
  return (
    'Expediente:\t0008421-7\tSolicitud:\t' +
    solicitud +
    '\n' +
    'Nombre:\tDEMO PÉREZ JUAN\tFecha Registro:\t' +
    fecha +
    '\n' +
    'Sexo:\tMASCULINO\tUbicación:\tSERVICIO DEMO\n' +
    'Edad:\t67\tMedico:\tSERVICIO DEMO\n'
  );
}

/** Líquido peritoneal — Pseudomonas (caso peritonitis). */
export const PITCH_CULTIVO_PERITONEAL_SOME =
  hdr('07/05/2026 02:04:18 p. m.', '2605071010') +
  '\nBACTERIOLOGIA\n' +
  'LIQUIDO PERITONEAL\n' +
  'PRODUCTO\n*\n' +
  'EN FRASCO DE HEMOCULTIVO ANAEROBIO\n' +
  'MICROORGANISMO\n*\n' +
  'Pseudomonas aeruginosa\n' +
  'CUENTA\n*\n' +
  '120,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'CEFTAZIDIMA\n>16\tR\n' +
  'CIPROFLOXACINA\n<=1\tS\n' +
  'CEFEPIMA\n>16\tR\n' +
  'IMIPENEM\n2\tS\n' +
  'LEVOFLOXACINA\n<=2\tS\n' +
  'MEROPENEM\n<=1\tS\n' +
  'PIP/TAZO\n>64\tR\n' +
  'TOBRAMICINA\n<=4\tS\n';

/** Urocultivo — Pseudomonas con carbapenemasa (antibiograma completo). */
export const PITCH_CULTIVO_URO_SOME =
  hdr('05/05/2026 06:16:18 p. m.', '2605050805') +
  '\nBACTERIOLOGIA\n' +
  'UROCULTIVO POR SONDA\n' +
  'PRODUCTO\n*\n' +
  'MICROORGANISMO\n*\n' +
  'Pseudomonas aeruginosa\n' +
  'COMENTARIO:\n*\n' +
  'SE DETECTO CARBAPENEMASA. (METODO DE INACTIVACION DE DISCO)\n' +
  'CUENTA DE KASS\n*\n' +
  '50,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'AMIKACINA\n>32\tR\n' +
  'AZTREONAM\n>16\tR\n' +
  'CEFTAZIDIMA\n>16\tR\n' +
  'CIPROFLOXACINA\n>2\tR\n' +
  'CEFEPIMA\n>16\tR\n' +
  'CEFTAZIDIMA/AVIBACTAM\n>16\tR\n' +
  'IMIPENEM\n>4\tR\n' +
  'LEVOFLOXACINA\n>4\tR\n' +
  'MEROPENEM\n>8\tR\n' +
  'PIP/TAZO\n<=16\tS\n' +
  'TOBRAMICINA\n>8\tR\n';

/** Aspirado traqueal 18/05 — E. coli BLEE + A. baumannii (mismo informe). */
export const PITCH_CULTIVO_ASPIRADO_1805_SOME =
  hdr('18/05/2026 04:58:48 p. m.', '2605181061') +
  '\nBACTERIOLOGIA\n' +
  'ASPIRADO TRAQUEAL\n' +
  'PRODUCTO\n*\n' +
  'TINCION DE GRAM\n*\n' +
  'ABUNDANTES COCOBACILOS GRAM NEGATIVO\n' +
  'MICROORGANISMO\n*\n' +
  'Escherichia coli\n' +
  'COMENTARIO:\n*\n' +
  'AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)\n' +
  'CUENTA\n*\n' +
  '50,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'AMP/SULBACTAM\n>16/8\tR\n' +
  'AMIKACINA\n<=16\tS\n' +
  'AMPICILINA\n>16\tR\n' +
  'AZTREONAM\n>16\tESBL\n' +
  'CEFTRIAXONA\n>32\tESBL\n' +
  'CEFTAZIDIMA\n>16\tESBL\n' +
  'CEFOTAXIMA\n>16\tESBL\n' +
  'CEFOXITINA\n16\tI\n' +
  'CIPROFLOXACINA\n>2\tR\n' +
  'CEFEPIMA\n>16\tR\n' +
  'CEFTAZIDIMA/AVIBACTAM\n16\tR\n' +
  'ERTAPENEM\n<=0.5\tS\n' +
  'GENTAMICINA\n>8\tR\n' +
  'IMIPENEM\n<=1\tS\n' +
  'LEVOFLOXACINA\n>4\tR\n' +
  'MEROPENEM\n<=1\tS\n' +
  'PIP/TAZO\n>64\tR\n' +
  'TRIMET/SULFA\n>2/38\tR\n' +
  'TETRACICLINA\n>8\tR\n' +
  'TOBRAMICINA\n>8\tR\n' +
  'MICROORGANISMO\n*\n' +
  'Acinetobacter baumannii complex\n' +
  'CUENTA\n*\n' +
  '80,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'COLISTINA\n<=2\tI\n' +
  'AMP/SULBACTAM\n>16/8\tR\n' +
  'AMIKACINA\n>32\tR\n' +
  'CEFTRIAXONA\n>32\tR\n' +
  'CEFTAZIDIMA\n>16\tR\n' +
  'CIPROFLOXACINA\n>2\tR\n' +
  'CEFEPIMA\n16\tI\n' +
  'GENTAMICINA\n>8\tR\n' +
  'IMIPENEM\n>4\tR\n' +
  'MEROPENEM\n>8\tR\n' +
  'TRIMET/SULFA\n>2/38\tR\n' +
  'TOBRAMICINA\n>8\tR\n';

/** Aspirado traqueal 28/04 — E. coli + S. aureus + P. mirabilis (mismo informe). */
export const PITCH_CULTIVO_ASPIRADO_2804_SOME =
  hdr('28/04/2026 01:45:42 p. m.', '2604280886') +
  '\nBACTERIOLOGIA\n' +
  'ASPIRADO TRAQUEAL\n' +
  'PRODUCTO\n*\n' +
  'MICROORGANISMO\n*\n' +
  'Escherichia coli\n' +
  'COMENTARIO:\n*\n' +
  'AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)\n' +
  'CUENTA\n*\n' +
  '100,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'AMP/SULBACTAM\n>16/8\tR\n' +
  'AMIKACINA\n<=16\tS\n' +
  'AMPICILINA\n>16\tR\n' +
  'CEFTRIAXONA\n>32\tESBL\n' +
  'CEFOTAXIMA\n>16\tESBL\n' +
  'CEFOXITINA\n<=8\tS\n' +
  'CIPROFLOXACINA\n>2\tR\n' +
  'CEFEPIMA\n>16\tR\n' +
  'CEFTAZIDIMA/AVIBACTAM\n<=8\tS\n' +
  'ERTAPENEM\n<=0.5\tS\n' +
  'GENTAMICINA\n>8\tR\n' +
  'IMIPENEM\n<=1\tS\n' +
  'LEVOFLOXACINA\n>4\tR\n' +
  'MEROPENEM\n<=1\tS\n' +
  'PIP/TAZO\n64\tI\n' +
  'TRIMET/SULFA\n>2/38\tR\n' +
  'TETRACICLINA\n>8\tR\n' +
  'TOBRAMICINA\n>8\tR\n' +
  'MICROORGANISMO\n*\n' +
  'Staphylococcus aureus\n' +
  'CUENTA\n*\n' +
  '20,000 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'CLINDAMICINA\n0.5\tS\n' +
  'SCREENING DE CEFOXITINA\n<=4\tNEG\n' +
  'ERITROMICINA\n>4\tR\n' +
  'INDUCCION CLINDAMICINA\n<=4/0.5\tNEG\n' +
  'LINEZOLID\n<=2\tS\n' +
  'OXACILINA\n1\tS\n' +
  'PENICILINA\n>8\tBLAC\n' +
  'RIFAMPICINA\n<=1\tS\n' +
  'TRIMET/SULFA\n<=0.5/9.5\tS\n' +
  'TETRACICLINA\n>8\tR\n' +
  'VANCOMICINA\n1\tS\n' +
  'MICROORGANISMO\n*\n' +
  'Proteus mirabilis\n' +
  'COMENTARIO:\n*\n' +
  'AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)\n' +
  'CUENTA\n*\n' +
  '100 UFC/mL\n' +
  'ANTIBIOGRAMA\n*\n' +
  'AMP/SULBACTAM\n>16/8\tR\n' +
  'AMIKACINA\n<=16\tS\n' +
  'AMPICILINA\n>16\tR\n' +
  'CEFTRIAXONA\n>32\tR\n' +
  'CEFOTAXIMA\n>16\tESBL\n' +
  'CEFOXITINA\n<=8\tS\n' +
  'CIPROFLOXACINA\n>2\tR\n' +
  'CEFEPIMA\n>16\tR\n' +
  'CEFTAZIDIMA/AVIBACTAM\n<=8\tS\n' +
  'ERTAPENEM\n<=0.5\tS\n' +
  'GENTAMICINA\n<=4\tS\n' +
  'LEVOFLOXACINA\n>4\tR\n' +
  'MEROPENEM\n<=1\tS\n' +
  'PIP/TAZO\n<=16\tS\n' +
  'TRIMET/SULFA\n>2/38\tR\n' +
  'TETRACICLINA\n>8\tR\n' +
  'TOBRAMICINA\n>8\tR\n';

/** Hemocultivo — Pseudomonas BLEE. */
export const PITCH_CULTIVO_HEMO_SOME =
  PITCH_HEADER +
  '\nBACTERIOLOGIA\n' +
  'HEMOCULTIVO\n' +
  'PRODUCTO\n*\n' +
  'PERIFERICO IZQUIERDO\n' +
  'MICROORGANISMO\n*\n' +
  'Pseudomonas aeruginosa\n' +
  'COMENTARIO:\n*\n' +
  'AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)\n' +
  'CUENTA\n*\n' +
  '2 colonias\n' +
  'ANTIBIOGRAMA\n*\n' +
  'CEFTAZIDIMA\n>16\tR\n' +
  'CEFEPIMA\n16\tI\n' +
  'CIPROFLOXACINA\n<=1\tS\n' +
  'MEROPENEM\n<=1\tS\n' +
  'PIP/TAZO\n64\tS\n';

/** Entradas de historial solo-cultivo para el pitch (fecha, id, texto). */
export const PITCH_CULTIVO_LAB_SPECS = [
  { id: 'pitch-lab-cult-at-1805', fecha: '18/05/2026', report: PITCH_CULTIVO_ASPIRADO_1805_SOME },
  { id: 'pitch-lab-cult-peritonitis', fecha: '07/05/2026', report: PITCH_CULTIVO_PERITONEAL_SOME },
  { id: 'pitch-lab-cult-uro', fecha: '05/05/2026', report: PITCH_CULTIVO_URO_SOME },
  { id: 'pitch-lab-cult-at-2804', fecha: '28/04/2026', report: PITCH_CULTIVO_ASPIRADO_2804_SOME },
  { id: 'pitch-lab-cult-hemo', fecha: '11/04/2026', report: PITCH_CULTIVO_HEMO_SOME },
];
