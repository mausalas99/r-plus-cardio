/** Etiquetas en español para UI VPO (catálogos internos conservan labelEn). */

/** @param {{ key: string, asaClass: string, labelEn: string }} a */
export function asaOptionLabel(a) {
  var es = {
    'asa-i': 'Sin enfermedad sistémica',
    'asa-ii': 'Enfermedad sistémica leve controlada',
    'asa-iii': 'Enfermedad sistémica grave',
    'asa-iv': 'Enfermedad grave, amenaza constante a la vida',
    'asa-v': 'Moribundo, no se espera sobrevivir sin cirugía',
  };
  return 'ASA ' + a.asaClass + ' — ' + (es[a.key] || a.labelEn);
}

/** @param {{ key: string, labelEn: string }} f */
export function functionalLabel(f) {
  var es = {
    independent: 'Independiente',
    'partially-dependent': 'Parcialmente dependiente',
    'totally-dependent': 'Totalmente dependiente',
  };
  return es[f.key] || f.labelEn;
}

const PROCEDURE_ES = {
  'gupta-anorectal': 'Anorrectal',
  'gupta-aortic': 'Aórtica',
  'gupta-bariatric': 'Bariátrica',
  'gupta-brain': 'Cerebral',
  'gupta-breast': 'Mama',
  'gupta-cardiac': 'Cardíaca',
  'gupta-ent': 'ORL (excepto tiroides/paratiroides)',
  'gupta-foregut-hpb': 'Esofagogástrica / hepatopancreatobiliar (excepto colecistectomía aislada)',
  'gupta-gallbladder-appendix': 'Vesícula biliar / apéndice / suprarrenales / bazo',
  'gupta-hernia': 'Hernia',
  'gupta-intestinal': 'Intestinal bajo duodeno',
  'gupta-neck-thyroid': 'Cuello (incl. tiroides/paratiroides)',
  'gupta-ob-gyn': 'Obstétrica / ginecológica',
  'gupta-orthopedic': 'Ortopédica',
  'gupta-abdomen-other': 'Abdomen — otra',
  'gupta-peripheral-vascular': 'Vascular periférica',
  'gupta-skin': 'Piel',
  'gupta-spine': 'Columna',
  'gupta-thoracic': 'Torácica no esofágica',
  'gupta-vein': 'Vena',
  'gupta-urology': 'Urología',
};

/** @param {{ id: string, labelEn: string }} p */
export function procedureLabel(p) {
  return PROCEDURE_ES[p.id] || p.labelEn;
}

/** Texto de búsqueda (español + inglés). @param {{ id: string, labelEn: string }} p */
export function procedureSearchText(p) {
  return procedureLabel(p) + ' ' + p.labelEn;
}
