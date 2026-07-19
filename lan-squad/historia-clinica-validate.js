'use strict';

const {
  validateHistoriaClinicaPut,
} = require('./historia-clinica-validate-put.js');
const {
  migrateLegacyHistoriaData,
  SECTION_KEYS,
  NESTED_SECTION_KEYS,
  LEGACY_SECTION_KEYS,
} = require('./historia-clinica-validate-core.js');

module.exports = {
  validateHistoriaClinicaPut,
  migrateLegacyHistoriaData,
  SECTION_KEYS,
  NESTED_SECTION_KEYS,
  LEGACY_SECTION_KEYS,
};
