/** Late-bound bridge to break circular imports between patient modules. */
export const patientsBridge = {
  renderPatientList(_opts) {},
  selectPatient(_id, _opts) {},
};
