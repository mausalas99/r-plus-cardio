export const CURRICULUM_VERSION = 10;

export const SALA_CHAPTERS = [
  {
    id: 'ch-patient-lab',
    title: 'Paciente y laboratorio',
    stepIds: [
      'map_sidebar',
      'map_tabs',
      'map_lab_teaser',
      'lab_parse',
      'lab_view',
      'servicio_default',
    ],
  },
  {
    id: 'ch-chart',
    title: 'Expediente · Clínico',
    stepIds: [
      'sala_expediente_tabs',
      'historia_clinica',
      'estado_actual',
      'estado_actual_registro',
      'estado_actual_review',
      'eventualidades',
    ],
  },
  {
    id: 'ch-results',
    title: 'Resultados',
    stepIds: ['sala_tend', 'sala_tend_chart'],
  },
  {
    id: 'ch-salida',
    title: 'Medicamentos y salida',
    stepIds: ['sala_med', 'listado_problemas', 'sala_vpo', 'sala_receta_hu'],
  },
  {
    id: 'ch-agenda',
    title: 'Agenda',
    stepIds: ['sala_agenda'],
  },
  {
    id: 'ch-team',
    title: 'Equipo',
    stepIds: ['livesync_desktop', 'livesync_mobile', 'wrap'],
  },
];

/** Interconsulta: lab block first (sin servicio_default en v1). */
export const IC_CHAPTERS = [
  {
    id: 'ch-ic-lab',
    title: 'Paciente y laboratorio',
    stepIds: [
      'map_sidebar',
      'map_tabs',
      'map_lab_teaser',
      'lab_parse',
      'lab_view',
    ],
  },
  {
    id: 'ch-ic-chart',
    title: 'Expediente y clínico',
    stepIds: [
      'ic_expediente_tabs',
      'sala_tend',
      'sala_tend_chart',
      'sala_soap',
      'sala_med',
      'ic_nota',
      'ic_indica',
    ],
  },
  {
    id: 'ch-ic-settings',
    title: 'Ajustes y perfil',
    stepIds: ['ic_exports', 'profile'],
  },
  {
    id: 'ch-ic-team',
    title: 'Equipo',
    stepIds: ['livesync_desktop', 'livesync_mobile', 'wrap'],
  },
];

export const GUARDIA_V7_CHAPTERS = [
  {
    id: 'ch-guardia-modo',
    title: 'Modo Guardia',
    stepIds: [
      'gv7_guardia_chip',
      'gv7_guardia_tab',
      'gv7_guardia_scope',
      'gv7_guardia_toggle',
      'gv7_guardia_exit',
    ],
  },
  {
    id: 'ch-guardia-censo',
    title: 'Censo y alcance',
    stepIds: ['gv7_censo_r1', 'gv7_censo_r4', 'gv7_censo_sync'],
  },
  {
    id: 'ch-guardia-entrega',
    title: 'Modo Entrega',
    stepIds: [
      'gv7_entrega_phase',
      'gv7_entrega_patient',
      'gv7_entrega_roster',
      'gv7_entrega_pendientes',
    ],
  },
  {
    id: 'ch-guardia-lan',
    title: 'LAN y equipos',
    stepIds: [
      'gv7_lan_wifi',
      'gv7_lan_pin',
      'gv7_lan_directorio',
      'gv7_lan_rotacion',
    ],
  },
  {
    id: 'ch-guardia-movil',
    title: 'iPad y móvil',
    stepIds: ['gv7_mobile_link', 'gv7_mobile_scope', 'gv7_mobile_vs_sala'],
  },
];

export const QUICK_ROUTE_CHAPTERS = [
  {
    id: 'ch-quick-route',
    title: 'Ruta rápida',
    stepIds: [
      'map_lab_teaser',
      'lab_parse',
      'gv7_guardia_chip',
      'gv7_lan_wifi',
      'gv7_entrega_phase',
      'quick_wrap',
    ],
  },
];

export const QUICK_ROUTE_HUB_MODULE = {
  id: 'ch-quick-route',
  label: 'Ruta rápida · turno en 5 min',
  chapterId: 'ch-quick-route',
  branch: 'quick-route',
  stepCount: QUICK_ROUTE_CHAPTERS[0].stepIds.length,
};

export const GUARDIA_V7_HUB_MODULES = GUARDIA_V7_CHAPTERS.map((ch) => ({
  id: ch.id,
  label: ch.title,
  chapterId: ch.id,
  branch: 'guardia-v7',
  stepCount: ch.stepIds.length,
}));

export const SALA_HUB_MODULES = [
  { id: 'mod-ch1', chapterId: 'ch-patient-lab', label: 'Laboratorio y pacientes', branch: 'sala' },
  { id: 'mod-ch2', chapterId: 'ch-chart', label: 'Expediente · Clínico', branch: 'sala' },
  { id: 'mod-ch3', chapterId: 'ch-results', label: 'Resultados (tendencias)', branch: 'sala' },
  { id: 'mod-ch4', chapterId: 'ch-salida', label: 'Medicamentos y salida', branch: 'sala' },
  { id: 'mod-ch5', chapterId: 'ch-agenda', label: 'Agenda del turno', branch: 'sala' },
  { id: 'mod-ch6', chapterId: 'ch-team', label: 'Equipo (LiveSync + móvil)', branch: 'sala' },
];

export const IC_HUB_MODULES = IC_CHAPTERS.map((ch) => ({
  id: ch.id,
  label: ch.title,
  chapterId: ch.id,
  branch: 'interconsulta',
  stepCount: ch.stepIds.length,
}));

/** @deprecated Use SALA_HUB_MODULES — kept for legacy imports */
export const HUB_MODULES = SALA_HUB_MODULES;

function chaptersForBranch(branch) {
  if (branch === 'interconsulta') return IC_CHAPTERS;
  if (branch === 'guardia-v7') return GUARDIA_V7_CHAPTERS;
  if (branch === 'quick-route') return QUICK_ROUTE_CHAPTERS;
  return SALA_CHAPTERS;
}

export function getSalaTourSteps() {
  return SALA_CHAPTERS.flatMap((c) => c.stepIds.slice());
}

export function getInterconsultaTourSteps() {
  return IC_CHAPTERS.flatMap((c) => c.stepIds.slice());
}

export function getGuardiaV7TourSteps() {
  return GUARDIA_V7_CHAPTERS.flatMap((c) => c.stepIds.slice());
}

export function getQuickRouteTourSteps() {
  return QUICK_ROUTE_CHAPTERS.flatMap((c) => c.stepIds.slice());
}

export function getChapterForStep(stepId, branch) {
  const chapters = chaptersForBranch(branch);
  for (const ch of chapters) {
    if (ch.stepIds.includes(stepId)) return ch;
  }
  return { id: 'unknown', title: '' };
}

export function getChapterProgressLabel(stepId, branch) {
  if (branch === 'quick-route') {
    const steps = getQuickRouteTourSteps();
    const idx = steps.indexOf(stepId);
    const ch = QUICK_ROUTE_CHAPTERS[0];
    return {
      chapterTitle: ch?.title || 'Ruta rápida',
      stepInChapter: idx >= 0 ? idx + 1 : 1,
      chapterSteps: steps.length,
      chapterIndex: 1,
      chapterCount: 1,
      isCompanion: false,
    };
  }

  const ch = getChapterForStep(stepId, branch);
  const chapters = chaptersForBranch(branch);
  const chapter = chapters.find((c) => c.id === ch.id);
  if (!chapter) {
    const linear =
      branch === 'guardia-v7'
        ? getGuardiaV7TourSteps()
        : branch === 'interconsulta'
          ? getInterconsultaTourSteps()
          : getSalaTourSteps();
    const linearIdx = linear.indexOf(stepId);
    return {
      chapterTitle: ch.title || '',
      stepInChapter: linearIdx >= 0 ? linearIdx + 1 : 1,
      chapterSteps: linear.length,
      chapterIndex: 1,
      chapterCount: chapters.length,
      isCompanion: false,
    };
  }
  const stepInChapter = chapter.stepIds.indexOf(stepId) + 1;
  return {
    chapterTitle: chapter.title,
    stepInChapter,
    chapterSteps: chapter.stepIds.length,
    chapterIndex: chapters.findIndex((c) => c.id === chapter.id) + 1,
    chapterCount: chapters.length,
    isCompanion: false,
  };
}

export function getFirstStepIdForChapter(chapterId, branch) {
  const ch = getChapterById(chapterId, branch);
  return ch && ch.stepIds.length ? ch.stepIds[0] : null;
}

export function getChapterById(chapterId, branch) {
  return chaptersForBranch(branch).find((c) => c.id === chapterId) || null;
}

export function getTourStepsForChapter(chapterId, branch) {
  const ch = getChapterById(chapterId, branch);
  return ch ? ch.stepIds.slice() : [];
}

export function isValidStepForBranch(stepId, branch, _mode) {
  if (branch === 'guardia-v7') return getGuardiaV7TourSteps().includes(stepId);
  if (branch === 'quick-route') return getQuickRouteTourSteps().includes(stepId);
  const steps = branch === 'interconsulta' ? getInterconsultaTourSteps() : getSalaTourSteps();
  return steps.includes(stepId);
}

/** Maps legacy tour step ids after curriculum merges. */
export function migrateTourStepId(stepId, _branch) {
  if (
    stepId === 'estado_actual_snapshot' ||
    stepId === 'estado_actual_charts' ||
    stepId === 'estado_actual_historial'
  ) {
    return 'estado_actual_review';
  }
  return stepId;
}
