import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileHistoriaClinicaNarrative,
  compileHistoriaClinicaPlainText,
} from './compile-narrative.mjs';
import { defaultGeneroBlock } from './genero-options.mjs';

const catalogs = {
  appConditions: { dm: 'Diabetes mellitus', hta: 'Hipertensión arterial' },
  ahfConditions: { dm: 'Diabetes mellitus' },
  ipasSystems: { general: 'General', tegumentos: 'Tegumentos' },
};

test('compile orders sections and formats APP conditions', () => {
  const data = {
    motivoConsulta: 'Sangrado por traqueostomía',
    app: {
      conditions: ['dm', 'hta'],
      descripcionDetallada: 'DM2 dx 2010.',
      medicamentosActuales: [
        {
          medication: 'Metformina',
          route: 'VO',
          dosage: '850 mg',
          frequency: 'c/12h',
        },
      ],
      hospitalizacionesPrevias: '',
    },
    apnp: { tabaquismo: 'Negado' },
    ahf: { conditions: [], descripcionDetallada: 'Madre: DM2.' },
    padecimientoActual: 'Paciente masculino de 49 años...',
    datosNegados: 'Fiebre, disnea.',
    ipas: {
      general: { checks: [], descripcion: 'Interrogado y negado', negado: true },
      tegumentos: { checks: [], descripcion: 'Interrogado y negado', negado: true },
    },
    signosVitalesIngreso: 'TA 120/60, FC 69',
    labAnchor: { egfr: 45, creatinineMgDl: 1.4, fecha: '24/05/26' },
  };
  const sections = compileHistoriaClinicaNarrative(data, catalogs);
  const titles = sections.map((s) => s.title);
  assert.ok(titles.indexOf('Motivo de consulta') < titles.indexOf('Antecedentes personales patológicos'));
  const appSec = sections.find((s) => s.id === 'app');
  assert.match(appSec.body, /Diabetes mellitus/);
  assert.match(appSec.body, /Metformina/);
});

test('compile omits empty hospitalizaciones', () => {
  const sections = compileHistoriaClinicaNarrative(
    {
      motivoConsulta: 'Dolor',
      app: {
        conditions: [],
        descripcionDetallada: '',
        medicamentosActuales: [],
        hospitalizacionesPrevias: '',
      },
      apnp: {},
      ahf: { conditions: [], descripcionDetallada: '' },
      padecimientoActual: '',
      datosNegados: '',
      ipas: {},
      signosVitalesIngreso: '',
    },
    catalogs
  );
  assert.ok(!sections.some((s) => s.body.trim() === ''));
});

test('compile collapses all-negado IPAS into single summary line', () => {
  const sections = compileHistoriaClinicaNarrative(
    {
      motivoConsulta: 'Dolor',
      ipas: {
        general: { checks: [], descripcion: 'Interrogado y negado', negado: true },
        tegumentos: { checks: [], descripcion: 'Interrogado y negado', negado: true },
      },
    },
    catalogs
  );
  const ipasSec = sections.find((s) => s.id === 'ipas');
  assert.equal(ipasSec.body, 'IPAS: interrogado y negado en todos los sistemas.');
});

test('compile género uses field text for positives', () => {
  const sections = compileHistoriaClinicaNarrative(
    {
      motivoConsulta: 'Dolor',
      genero: {
        prostata: { detalle: 'HPB en tratamiento.' },
        andropausia: {},
      },
      app: { conditions: [], descripcionDetallada: '', medicamentosActuales: [] },
      apnp: {},
      ahf: { conditions: [], descripcionDetallada: '' },
      padecimientoActual: '',
      datosNegados: '',
      ipas: {},
      signosVitalesIngreso: '',
    },
    {},
    { patientSex: 'M' }
  );
  const generoSec = sections.find((s) => s.id === 'genero');
  assert.match(generoSec.body, /Patología prostática/);
  assert.match(generoSec.body, /HPB/);
});

test('compile género default lists female interrogation topics', () => {
  const sections = compileHistoriaClinicaNarrative(
    {
      motivoConsulta: 'Dolor',
      genero: defaultGeneroBlock('F'),
      app: { conditions: [], descripcionDetallada: '', medicamentosActuales: [] },
      apnp: {},
      ahf: { conditions: [], descripcionDetallada: '' },
      padecimientoActual: '',
      datosNegados: '',
      ipas: {},
      signosVitalesIngreso: '',
    },
    {},
    { patientSex: 'F' }
  );
  const generoSec = sections.find((s) => s.id === 'genero');
  assert.match(generoSec.body, /Menarca/);
  assert.match(generoSec.body, /interrogado y negado/i);
});

test('compileHistoriaClinicaPlainText joins sections', () => {
  const text = compileHistoriaClinicaPlainText([
    { title: 'Motivo', body: 'Dolor' },
    { title: 'APP', body: 'DM' },
  ]);
  assert.match(text, /Motivo:\nDolor/);
});
