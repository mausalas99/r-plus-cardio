export function gluRescueFieldsHtml() {
  return (
    '<label class="ea-glu-altered-toggle">' +
    '<input type="checkbox" class="ea-glu-altered-input" data-ea-glu-altered aria-label="Glucometría alterada">' +
    '<span>Alterada</span>' +
    '</label>' +
    '<div class="ea-glu-rescue-wrap ea-glu-rescue-wrap--hidden" data-ea-glu-rescue-wrap hidden>' +
    '<div class="ea-glu-rescue-box">' +
    '<span class="ea-glu-rescue-box-title">Rescate</span>' +
    '<div class="ea-glu-rescue-box-fields">' +
    '<label class="ea-glu-rescue-field">' +
    '<span class="ea-label">Unidades</span>' +
    '<span class="ea-input-affix">' +
    '<input type="number" class="ea-input ea-glu-rescue-input" data-ea-glu-rescue-units min="0" step="0.5" placeholder="0" inputmode="decimal" aria-label="Unidades de rescate">' +
    '<span class="ea-input-affix-suffix" aria-hidden="true">U</span>' +
    '</span>' +
    '</label>' +
    '<label class="ea-glu-rescue-field">' +
    '<span class="ea-label">DXT post-rescate</span>' +
    '<span class="ea-input-affix">' +
    '<input type="number" class="ea-input ea-glu-post-rescue-input" data-ea-glu-post-rescue-value min="0" step="1" placeholder="0" inputmode="numeric" aria-label="Destroxía post-rescate">' +
    '<span class="ea-input-affix-suffix" aria-hidden="true">mg/dL</span>' +
    '</span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}
