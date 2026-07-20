export const CURRICULUM_VERSION = 12;

/** Fundamentos — flujo R+ Cardio (Sala local, sin LiveSync / Interconsulta). */
export const SALA_CHAPTERS = [
  {
    id: 'ch-patient-lab',
    title: 'Pacientes y laboratorio',
    stepIds: [
      'map_sidebar',
      'map_tabs',
      'map_lab_teaser',
      'lab_parse',
      'lab_view',
    ],
  },
  {
    id: 'ch-chart',
    title: 'Expediente · Clínico',
    stepIds: [
      'sala_expediente_tabs',
      'historia_clinica',
      'estado_actual',
      'cardio_descongestion',
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
    id: 'ch-manejo',
    title: 'Manejo',
    stepIds: ['sala_manejo', 'sala_med'],
  },
  {
    id: 'ch-salida',
    title: 'Hoja IC',
    stepIds: ['sala_ic_hoja'],
  },
  {
    id: 'ch-agenda',
    title: 'Agenda',
    stepIds: ['sala_agenda', 'wrap'],
  },
];

/** @deprecated Interconsulta no es producto en R+ Cardio; se mantiene vacío para imports legacy. */
export const IC_CHAPTERS = [];

/**
 * Módulos cortos del hub (track «Empezar aquí»).
 * Branch id sigue siendo `guardia-v7` por compatibilidad de progreso/LS.
 */
export const GUARDIA_V7_CHAPTERS = [
  {
    id: 'ch-cardio-labs',
    title: 'Laboratorio y tendencias',
    stepIds: ['sala_tend', 'sala_tend_chart'],
  },
  {
    id: 'ch-cardio-descongestion',
    title: 'Descongestión y Estado actual',
    stepIds: ['estado_actual', 'cardio_descongestion', 'estado_actual_review'],
  },
  {
    id: 'ch-cardio-manejo',
    title: 'Manejo (fantásticos y diuréticos)',
    stepIds: ['sala_manejo'],
  },
  {
    id: 'ch-cardio-hoja',
    title: 'Generar hoja IC',
    stepIds: ['sala_ic_hoja'],
  },
  {
    id: 'ch-cardio-agenda',
    title: 'Agenda',
    stepIds: ['sala_agenda'],
  },
];

export const QUICK_ROUTE_CHAPTERS = [
  {
    id: 'ch-quick-route',
    title: 'Ruta rápida',
    stepIds: [
      'cardio_demo_intro',
      'cardio_descongestion',
      'sala_manejo',
      'sala_ic_hoja',
      'quick_wrap',
    ],
  },
];

export const QUICK_ROUTE_HUB_MODULE = {
  id: 'ch-quick-route',
  label: 'Ruta rápida · caso IC en 5 min',
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
  { id: 'mod-ch1', chapterId: 'ch-patient-lab', label: 'Pacientes y laboratorio', branch: 'sala' },
  { id: 'mod-ch2', chapterId: 'ch-chart', label: 'Expediente · Clínico', branch: 'sala' },
  { id: 'mod-ch3', chapterId: 'ch-results', label: 'Resultados (tendencias)', branch: 'sala' },
  { id: 'mod-ch4', chapterId: 'ch-manejo', label: 'Manejo IC', branch: 'sala' },
  { id: 'mod-ch5', chapterId: 'ch-salida', label: 'Generar hoja IC', branch: 'sala' },
  { id: 'mod-ch6', chapterId: 'ch-agenda', label: 'Agenda', branch: 'sala' },
];

export const IC_HUB_MODULES = [];

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
  if (stepId === 'sala_vpo' || stepId === 'sala_receta_hu' || stepId === 'listado_problemas') {
    return 'sala_ic_hoja';
  }
  if (stepId === 'livesync_desktop' || stepId === 'livesync_mobile') {
    return 'wrap';
  }
  if (stepId === 'servicio_default') {
    return 'lab_view';
  }
  if (String(stepId || '').indexOf('gv7_') === 0) {
    return 'map_lab_teaser';
  }
  if (stepId === 'map_lab_teaser' || stepId === 'lab_parse') {
    return 'cardio_demo_intro';
  }
  return stepId;
}
