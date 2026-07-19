import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConflictDiffHtml,
  buildConflictDiffParts,
  buildConflictContextHtml,
  buildConflictModalTitle,
  conflictSnapshotsMatchForAutoResolve,
  pickDiffKeys,
  formatFieldLabel,
  summarizeConflictFieldValue,
} from './clinical-conflict-viewer.mjs';

test('highlights conflicting keys in both columns', () => {
  const parts = buildConflictDiffParts({
    conflictingKeys: ['cuarto'],
    localData: { cuarto: '101', cama: 'A' },
    serverData: { cuarto: '201', cama: 'A' },
  });
  const html = parts.summaryHtml + parts.detailHtml;
  assert.ok(html.includes('Cuarto'));
  assert.ok(html.includes('clinical-conflict-field-card--hot'));
  assert.ok(html.includes('101'));
  assert.ok(html.includes('201'));
  assert.ok(parts.summaryHtml.includes('1 sección'));
});

test('shows only conflicting keys when listed', () => {
  const html = buildConflictDiffHtml({
    conflictingKeys: ['cuarto'],
    localData: { cuarto: '101', cama: 'A' },
    serverData: { cuarto: '201', cama: 'A' },
  });
  assert.ok(!html.includes('cama'));
});

test('omits internal metadata when server has no value', () => {
  const keys = pickDiffKeys(
    ['id', 'version', 'cuarto'],
    { id: 'a', version: 1, cuarto: '101' },
    { cuarto: '201' }
  );
  assert.deepEqual(keys, ['cuarto']);
});

test('escapes HTML in field values', () => {
  const html = buildConflictDiffHtml({
    conflictingKeys: ['nombre'],
    localData: { nombre: '<script>' },
    serverData: { nombre: 'Ana' },
  });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});

test('context explains transport and versions', () => {
  const html = buildConflictContextHtml({
    entityType: 'historiaClinica',
    transport: 'http',
    localVersion: 2,
    serverVersion: 4,
    patientDisplayName: 'MARIO ARTURO MORALES',
  });
  assert.ok(html.includes('MARIO ARTURO'));
  assert.ok(html.includes('host'));
  assert.ok(html.includes('v2'));
  assert.ok(html.includes('v4'));
});

test('todo delete shows pendiente label not english Todo', () => {
  const html = buildConflictContextHtml({
    entityType: 'todo',
    intent: 'todo-delete',
    itemPreview: 'VIGILAR POTASIO',
    patientDisplayName: 'MIGUEL ANGEL VELAZQUEZ GARCIA',
    transport: 'ws',
  });
  assert.ok(html.includes('Pendiente'));
  assert.ok(html.includes('VIGILAR POTASIO'));
  assert.ok(html.includes('MIGUEL ANGEL'));
  assert.ok(!html.match(/\bTodo\b/));
});

test('formatFieldLabel maps known keys', () => {
  assert.equal(formatFieldLabel('motivoConsulta'), 'Motivo de consulta');
});

test('modal title for todo is plain spanish', () => {
  assert.equal(buildConflictModalTitle({ entityType: 'todo' }), 'Pendiente en la sala');
});

test('summarize HC AHF entries without JSON dump', () => {
  const text = summarizeConflictFieldValue('ahf', {
    conditions: [],
    customConditions: [],
    entries: [{ descripcionDetallada: 'MADRE: FINADA A LOS 83 AÑOS POR IAM' }],
  });
  assert.ok(text.includes('MADRE'));
  assert.ok(!text.includes('"conditions"'));
  assert.ok(!text.includes('{'));
});

test('diff html avoids raw JSON for structured APP', () => {
  const html = buildConflictDiffHtml({
    conflictingKeys: ['app'],
    localData: {
      app: {
        conditions: ['dm'],
        descripcionDetallada: 'Diabetes tipo 2 desde 2010',
        medicamentosActuales: 'Metformina',
      },
    },
    serverData: {
      app: {
        conditions: ['dm'],
        descripcionDetallada: 'Diabetes tipo 2 desde 2010 — actualizado en sala',
        medicamentosActuales: 'Metformina',
      },
    },
  });
  assert.ok(html.includes('Antecedentes patológicos') || html.includes('APP'));
  assert.ok(!html.includes('"conditions":'));
});

test('conflictSnapshotsMatchForAutoResolve when previews match', () => {
  const data = {
    identificacion: { dx: 'Neumonía', cama: '12' },
    motivoConsulta: 'Fiebre',
  };
  assert.equal(
    conflictSnapshotsMatchForAutoResolve({
      conflictingKeys: ['identificacion', 'motivoConsulta'],
      localData: data,
      serverData: data,
    }),
    true
  );
  assert.equal(
    conflictSnapshotsMatchForAutoResolve({
      conflictingKeys: ['motivoConsulta'],
      localData: { motivoConsulta: 'Fiebre' },
      serverData: { motivoConsulta: 'Tos' },
    }),
    false
  );
});
