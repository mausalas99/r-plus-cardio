import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOutputDirError,
  handleOutputDirFallback,
} from './output-dir-fallback.mjs';

test('isOutputDirError detecta carpeta inexistente o sin permisos', () => {
  assert.equal(isOutputDirError('La carpeta seleccionada ya no existe. Cambia la ruta en Mi Perfil.'), true);
  assert.equal(isOutputDirError('No se puede escribir en la carpeta seleccionada.'), true);
  assert.equal(isOutputDirError('Error Python'), false);
});

test('handleOutputDirFallback selecciona carpeta, guarda y reintenta', async () => {
  const events = [];
  const result = await handleOutputDirFallback({
    response: { ok: false, error: 'La carpeta seleccionada ya no existe. Cambia la ruta en Mi Perfil.' },
    selectOutputDir: async () => 'C:\\Users\\Medico\\Documents',
    saveOutputDir: (dir) => events.push(['save', dir]),
    retry: async (dir) => {
      events.push(['retry', dir]);
      return { ok: true, fileName: 'Nota.docx' };
    },
    onSuccess: (data) => events.push(['success', data.fileName]),
    onError: (message) => events.push(['error', message]),
    onPrompt: () => events.push(['prompt']),
    onCancel: () => events.push(['cancel']),
  });

  assert.equal(result.status, 'retried');
  assert.deepEqual(events, [
    ['prompt'],
    ['save', 'C:\\Users\\Medico\\Documents'],
    ['retry', 'C:\\Users\\Medico\\Documents'],
    ['success', 'Nota.docx'],
  ]);
});

test('handleOutputDirFallback avisa cancelación sin guardar ni reintentar', async () => {
  const events = [];
  const result = await handleOutputDirFallback({
    response: { ok: false, error: 'No se puede escribir en la carpeta seleccionada.' },
    selectOutputDir: async () => undefined,
    saveOutputDir: () => events.push(['save']),
    retry: async () => ({ ok: true }),
    onSuccess: () => events.push(['success']),
    onError: (message) => events.push(['error', message]),
    onPrompt: () => events.push(['prompt']),
    onCancel: () => events.push(['cancel']),
  });

  assert.equal(result.status, 'cancelled');
  assert.deepEqual(events, [
    ['prompt'],
    ['cancel'],
  ]);
});
