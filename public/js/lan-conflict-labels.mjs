const FIELD_LABELS = {
  identificacion: 'Identificación',
  motivoConsulta: 'Motivo de consulta',
  apnp: 'Antecedentes no patológicos',
  app: 'Antecedentes patológicos',
  ahf: 'Antecedentes heredofamiliares',
  genero: 'Género',
  sexual: 'Salud sexual',
  padecimientoActual: 'Padecimiento actual',
  datosNegados: 'Datos negados',
  ipas: 'IPAS',
  signosVitalesIngreso: 'Signos vitales de ingreso',
  labsAtAdmission: 'Labs de ingreso',
  labAnchor: 'Ancla de laboratorio',
  meta: 'Metadatos',
  labLookbackHours: 'Ventana de labs (h)',
  eventualidades: 'Eventualidades',
  nombre: 'Nombre',
  cuarto: 'Cuarto',
  cama: 'Cama',
  sexo: 'Sexo',
  edad: 'Edad',
  agenda: 'Agenda',
  todos: 'Pendientes',
  text: 'Descripción',
  completed: 'Completado',
  priority: 'Prioridad',
  createdAt: 'Fecha de creación',
  updatedAt: 'Última actualización',
  _deleted: 'Eliminado',
  entries: 'Entradas',
  manejo: 'Manejo',
};

export function formatFieldLabel(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (FIELD_LABELS[k]) return FIELD_LABELS[k];
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
