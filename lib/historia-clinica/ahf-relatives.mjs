/** @type {Array<{ id: string, label: string, group?: string }>} */
export const AHF_RELATIVES = [
  { id: 'madre', label: 'Madre', group: 'padres' },
  { id: 'padre', label: 'Padre', group: 'padres' },
  { id: 'abuela_paterna', label: 'Abuela paterna', group: 'abuelos' },
  { id: 'abuelo_paterno', label: 'Abuelo paterno', group: 'abuelos' },
  { id: 'abuela_materna', label: 'Abuela materna', group: 'abuelos' },
  { id: 'abuelo_materno', label: 'Abuelo materno', group: 'abuelos' },
  { id: 'hermano', label: 'Hermano', group: 'hermanos' },
  { id: 'hermana', label: 'Hermana', group: 'hermanos' },
  { id: 'hijo', label: 'Hijo', group: 'hijos' },
  { id: 'hija', label: 'Hija', group: 'hijos' },
];

const RELATIVE_LABELS = Object.fromEntries(AHF_RELATIVES.map((r) => [r.id, r.label]));

export function ahfRelativeLabel(id) {
  return RELATIVE_LABELS[id] || id;
}
