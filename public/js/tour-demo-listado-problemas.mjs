/**
 * Listado de problemas de demostración para el tour guiado (DEMO PÉREZ).
 * Formato clínico A) B) C) en mayúsculas; valores inventados.
 */
import { emptyListado, addProblema } from './listado-problemas-core.mjs';

/** @type {Readonly<string>} */
export const TOUR_DEMO_PERITONITIS_BLOCK =
  'PERITONITIS ASOCIADA A DIÁLISIS PERITONEAL\n' +
  'A) CLÍNICA: SOMNOLENCIA EXCESIVA DESDE 04/05/2026, NÁUSEA DESDE 06/05/2026, VÓMITO (1 EPISODIO 06/05/2026), DOLOR ABDOMINAL LEVE 5/10 DESDE 06/05/2026, LÍQUIDO DE DIÁLISIS TURBIO CON FIBRINA DESDE 05/05/2026\n' +
  'B) EXPLORACIÓN FÍSICA: ABDOMEN DISTENDIDO, DOLOR A LA PALPACIÓN SUPERFICIAL Y PROFUNDA DIFUSO CON PREDOMINIO EN HIPOGASTRIO Y FOSA ILÍACA DERECHA, SIGNO DE BLUMBERG POSITIVO, SITIO DE INSERCIÓN DE CATÉTER SIN DATOS DE INFECCIÓN LOCAL\n' +
  'C) PARACLÍNICA: LÍQUIDO PERITONEAL CON 4650 CÉLULAS, 94% POLIMORFONUCLEARES, GLUCOSA 300 MG/DL, LEUCOCITOSIS 18,000/UL, PCR 21 MG/L ELEVADA, CULTIVO PENDIENTE';

export function buildTourDemoListadoProblemas(fecha, hora) {
  var l = emptyListado(fecha, hora);
  l = addProblema(l, 'activos', {
    fecha: '06/05/2026',
    descripcion: TOUR_DEMO_PERITONITIS_BLOCK,
  });
  l = addProblema(l, 'activos', {
    fecha: '15/01/2024',
    descripcion:
      'DIABETES MELLITUS TIPO 2\n' +
      'A) CLÍNICA: POLIURIA Y POLIDIPSIA DE 2 SEMANAS, GLUCOMETRÍAS CAPILARES 180–220 MG/DL\n' +
      'B) EXPLORACIÓN FÍSICA: PACIENTE ALERTA, MUCOSAS HÚMEDAS\n' +
      'C) PARACLÍNICA: HBA1C 8.2%, GLUCOSA EN AYUNO 198 MG/DL',
  });
  l = addProblema(l, 'inactivos', {
    fecha: '08/02/2026',
    descripcion:
      'NEUMONÍA ADQUIRIDA EN LA COMUNIDAD (RESUELTA)\n' +
      'A) CUADRO FEBRIL Y TOS PRODUCTIVA HOSPITALIZADO EN FEBRERO/2026, ALTA CON MEJORÍA CLÍNICA',
  });
  return l;
}
