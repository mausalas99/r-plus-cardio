/** Skeleton placeholder helpers (premium UI phase 1). */

export function buildLabPanelSkeletonHtml() {
  return (
    '<div class="lab-panel-skeleton" id="lab-panel-loading" aria-busy="true" aria-label="Cargando Laboratorio">' +
    '<div class="skel-line lab-panel-skeleton-title"></div>' +
    '<div class="skel-card"></div>' +
    '<div class="skel-line" style="width:72%"></div>' +
    '<div class="skel-line" style="width:58%"></div>' +
    '<div class="skel-line" style="width:84%"></div>' +
  '</div>'
  );
}

export function buildTextSkeletonPanel(className, lines) {
  const cls = className || 'skel-panel';
  const count = Math.max(1, Number(lines) || 3);
  let html = '<div class="' + cls + '" aria-busy="true">';
  for (let i = 0; i < count; i++) {
    const width = 55 + ((i * 17) % 35);
    html += '<div class="skel-line" style="width:' + width + '%"></div>';
  }
  html += '</div>';
  return html;
}
