/**
 * LAN host patient census — CTA to open the full dashboard modal.
 */

import { isLanSessionConfiguredForRest } from './transport.mjs';
import { openLanHostCensusDashboard } from './host-patients-dashboard.mjs';

export { annotateLanHostPatientRows } from './host-patients-annotate.mjs';
export { fetchLanHostCensusSnapshot } from './host-patients-snapshot.mjs';

/**
 * @param {HTMLElement} root
 * @param {{ showToast?: Function, onChanged?: Function }} [opts]
 */
export async function appendLanHostPatientsSection(root, opts) {
  if (!root || !isLanSessionConfiguredForRest()) return;
  const showToast =
    typeof opts?.showToast === 'function'
      ? opts.showToast
      : function () {};
  const onChanged = opts?.onChanged;

  if (root.querySelector('.lan-host-patients-panel')) return;

  const row = document.createElement('div');
  row.className = 'settings-card lan-host-patients-panel';

  const copy = document.createElement('div');
  copy.className = 'settings-card__copy';
  const title = document.createElement('p');
  title.className = 'settings-card__title';
  title.textContent = 'Censo LAN';
  const desc = document.createElement('p');
  desc.className = 'settings-card__desc';
  desc.textContent = 'Pacientes en el servidor';
  copy.appendChild(title);
  copy.appendChild(desc);

  const action = document.createElement('div');
  action.className = 'settings-card__action';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-settings-row';
  btn.textContent = 'Abrir';
  btn.addEventListener('click', function () {
    void openLanHostCensusDashboard({ showToast: showToast, onChanged: onChanged });
  });
  action.appendChild(btn);

  row.appendChild(copy);
  row.appendChild(action);
  root.appendChild(row);
}
