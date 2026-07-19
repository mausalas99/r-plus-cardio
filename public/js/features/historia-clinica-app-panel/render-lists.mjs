import { createRenderErcMeds, createRenderAlergias } from './render-erc-alergias.mjs';
import { createRenderTrauma, createRenderTransfusiones } from './render-trauma-tf.mjs';
import { createRenderMedicamentos } from './render-medicamentos.mjs';
import { createRenderCirugias, createRenderHosps } from './render-procedures.mjs';

/**
 * @param {{ container: HTMLElement, app: object, emit: () => void, getErcDetail: () => object }} ctx
 */
export function createListRenderers(ctx) {
  const renderers = {};
  renderers.renderMedicamentos = createRenderMedicamentos(ctx, renderers);
  renderers.renderErcMeds = createRenderErcMeds(ctx, renderers);
  renderers.renderAlergias = createRenderAlergias(ctx);
  renderers.renderTrauma = createRenderTrauma(ctx);
  renderers.renderTransfusiones = createRenderTransfusiones(ctx);
  renderers.renderCirugias = createRenderCirugias(ctx);
  renderers.renderHosps = createRenderHosps(ctx);
  return renderers;
}
