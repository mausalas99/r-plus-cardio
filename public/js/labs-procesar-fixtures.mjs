// Characterization fixtures for procesarLabs (Phase 6, audit M2.2).
// demoSome / olderDemoSome are the real anonymized SOME reports already in the repo.
// gasoVenosaSolo mirrors MUESTRA_GASO_VENOSA from labs-gases.test.mjs (esSoloGaso path).
// headerVariants exercises sexo/edad/ubicación normalization with no parseable sections.
import { DEMO_SOME_LAB_REPORT, OLDER_DEMO_SOME_LAB_REPORT } from './tour-demo-some-lab.mjs';

export const GASO_VENOSA_SOLO = `
Expediente:\t2213511-4\tSolicitud:\t2605070398
Nombre:\tBENITO CASTILLO JUAREZ\tFecha Registro:\tMay 7 2026 6:43AM
Sexo:\tMASCULINO\tUbicación:\tSERVICIO CLÍNICO 1
Edad:\t58\tMedico:\tA QUIEN CORRESPONDA


GASOMETRIAS
GASOMETRIA VENOSA PARCIAL
Estudio\t\tResultado\tUnidades\tValor de Referencia
PH\t*\t7.39\t\t7.32 - 7.43
pCO2\tB\t35\tmmHg\t40 - 45
pO2\tA\t60\tmmHg\tN/A
Lactato\tB\t0.7\tmmol/L\t0.9 - 1.9
HCO3\tB\t21.2\tmmol/L\t24.0 - 30.0
EX. BASE\tB\t-3.4\tmmol/L\t-2.0 - 2.0
SAT 02\tA\t90\t%\t0 - 0
OBSERVACIONES\t*\tCa++ IONIZADO: 0.92 mmol/L\t&
`;

export const HEADER_VARIANTS = `
Expediente:\t9988776-1\tSolicitud:\t2606110001
Nombre:\tMARIA LOPEZ HERNANDEZ\tFecha Registro:\tJun 11 2026 9:15AM
Sexo:\tFEMENINO\tUbicación:\tURGENCIAS PEDIATRIA\tMedico:\tA QUIEN CORRESPONDA
Edad:\t8 meses
`;

/** @type {Record<string, string>} */
export const PROCESAR_LABS_FIXTURES = {
  demoSome: DEMO_SOME_LAB_REPORT,
  olderDemoSome: OLDER_DEMO_SOME_LAB_REPORT,
  gasoVenosaSolo: GASO_VENOSA_SOLO,
  headerVariants: HEADER_VARIANTS,
};
