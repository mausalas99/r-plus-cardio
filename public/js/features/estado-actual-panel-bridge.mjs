/** Late-bound render/registrar to avoid registro ↔ render ↔ actions cycles. */
export const eaPanelBridge = {
  renderEstadoActualPanel(_opts) {},
  registrarEstadoActualMedicion() {},
};
