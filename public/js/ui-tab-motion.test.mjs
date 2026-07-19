import test from 'node:test';
import assert from 'node:assert/strict';
import { TAB_INDICATOR_BASE_PX, tabIndicatorTransform, innerTabButtonId } from './ui-tab-motion.mjs';

test('tabIndicatorTransform: translateX + scaleX sobre el ancho base', () => {
  assert.equal(tabIndicatorTransform(120, 80), 'translateX(120px) scaleX(1)');
  assert.equal(tabIndicatorTransform(0, 40), 'translateX(0px) scaleX(0.5)');
  assert.equal(tabIndicatorTransform(24, 112, 80), 'translateX(24px) scaleX(1.4)');
});

test('tabIndicatorTransform: clamp de valores inválidos', () => {
  assert.equal(tabIndicatorTransform(-5, -10), 'translateX(0px) scaleX(0)');
  assert.equal(tabIndicatorTransform(NaN, NaN), 'translateX(0px) scaleX(0)');
});

test('tabIndicatorTransform: base por defecto exportada', () => {
  assert.equal(TAB_INDICATOR_BASE_PX, 80);
  assert.equal(
    tabIndicatorTransform(10, TAB_INDICATOR_BASE_PX),
    'translateX(10px) scaleX(1)'
  );
});

test('innerTabButtonId: consolidado mapea granular → tab contenedor', () => {
  assert.equal(innerTabButtonId('tend', { consolidated: true }), 'itab-resultados');
  assert.equal(innerTabButtonId('recetaHu', { consolidated: true }), 'itab-salida');
  assert.equal(innerTabButtonId('recetaHu'), 'itab-receta-hu');
});
