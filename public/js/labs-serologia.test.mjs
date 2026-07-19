import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSerologiaBancoSangre_, procesarLabs } from './labs.js';

const MUESTRA_SEROL = `
Expediente:	2007285-3	Solicitud:	197462
Nombre:	MIGUEL ANGEL VELAZQUEZ GARCIA	Fecha Registro:	May 25 2026 5:07PM
Sexo:	MASCULINO	Ubicación:	MED.1
Edad:	50	Medico:	A QUIEN CORRESPONDA

BANCO DE SANGRE

Serologia

Estudio	Resultado	Unidades	Valor de Referencia

Anticuerpos anti HIV1/HIV2 Combo.	
0.070
NEGATIVO
S/CO	
Positivo >= 0.80S/CO
Indeterminado >= 0.90-0.99S/CO
Negativo <= 0.00S/CO

Anticuerpos anti virus de la Hepatitis C.	
0.170
NEGATIVO
S/CO	
Positivo >= 0.80S/CO
Indeterminado >= 0.90-0.99S/CO
Negativo <= 0.00S/CO

Antigeno de superficie del virus de la Hepatitis B	
0.260
NEGATIVO
S/CO	
Positivo >= 0.80S/CO
Indeterminado >= 0.90-0.99S/CO
Negativo <= 0.00S/CO
`;

test('parseSerologiaBancoSangre_ compacta VIH/VHC/HBsAg negativos con S/CO', () => {
  const out = parseSerologiaBancoSangre_(MUESTRA_SEROL);
  assert.match(out, /^SEROL\t/);
  assert.match(out, /VIH neg \(0\.07\)/);
  assert.match(out, /VHC neg \(0\.17\)/);
  assert.match(out, /HBsAg neg \(0\.26\)/);
});

test('parseSerologiaBancoSangre_ marca positivo e indeterminado', () => {
  const raw = `
BANCO DE SANGRE
Serologia
Anticuerpos anti HIV1/HIV2 Combo.
1.20
POSITIVO
S/CO
Anticuerpos anti virus de la Hepatitis C.
0.95
INDETERMINADO
S/CO
Antigeno de superficie del virus de la Hepatitis B
0.050
NEGATIVO
S/CO
`;
  const out = parseSerologiaBancoSangre_(raw);
  assert.match(out, /VIH pos\* \(1\.2\)/);
  assert.match(out, /VHC indet\* \(0\.95\)/);
  assert.match(out, /HBsAg neg \(0\.05\)/);
});

test('procesarLabs incluye bloque SEROL para banco de sangre', () => {
  const { resLabs, patient } = procesarLabs(MUESTRA_SEROL);
  const serol = resLabs.find((l) => l.startsWith('SEROL\t'));
  assert.ok(serol, 'debe incluir bloque SEROL');
  assert.equal(patient.expediente, '2007285-3');
  assert.equal(patient.name, 'MIGUEL ANGEL VELAZQUEZ GARCIA');
});
