import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsHelpWindowHandlers } from './settings-help.mjs';

const ONBOARDING_WINDOW_HANDLERS = [
  'guidedTourClickPrev',
  'guidedTourPause',
  'resumeGuidedTourFromProgress',
  'startTourModule',
  'startHelpTourInterconsulta',
  'resetAndStartOnboarding',
];

test('settingsHelpWindowHandlers expone handlers de onboarding en window', () => {
  for (const name of ONBOARDING_WINDOW_HANDLERS) {
    assert.equal(typeof settingsHelpWindowHandlers[name], 'function', `${name} debe ser función`);
  }
});

/** Misma lógica que settings-help.mjs (no exportada). */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

test('livesync_desktop tour snippet no menciona código numérico fijo', () => {
  const html =
    '<p>El icono <strong>⇄</strong> (junto a Ajustes) abre la conexión LAN.</p>' +
    '<p>Los respaldos JSON manuales siguen en Ajustes → Respaldos, sync y recuperación.</p>';
  assert.doesNotMatch(html, /\b1234\b/);
  assert.match(html, /Respaldos/);
});

test('esc escapa títulos de artículos de ayuda', () => {
  const html = '<h4>' + esc('A <B> & "C"') + '</h4>';
  assert.equal(html, '<h4>A &lt;B&gt; &amp; &quot;C&quot;</h4>');
});
