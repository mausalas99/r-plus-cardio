/**
 * LWW overwrite toast preference row for ⇄ connection stack.
 */
import { storage } from '../../storage.js';

function readInitialLwwToastPref() {
  return typeof storage.getLanLwwOverwriteToast === 'function' && storage.getLanLwwOverwriteToast();
}

/**
 * @param {HTMLElement} stack
 */
export function appendLanLwwToastRow(stack) {
  var row = document.createElement('div');
  row.className = 'settings-card settings-card--toggle';

  var copy = document.createElement('div');
  copy.className = 'settings-card__copy';
  var title = document.createElement('p');
  title.className = 'settings-card__title';
  title.textContent = 'Avisar sobrescritura concurrente';
  var desc = document.createElement('p');
  desc.className = 'settings-card__desc';
  desc.textContent = 'Cuando la sala sobrescribió un cambio concurrente (LWW)';
  copy.appendChild(title);
  copy.appendChild(desc);

  var action = document.createElement('label');
  action.className = 'settings-card__action settings-card__toggle-label';
  action.setAttribute('for', 'settings-lan-lww-toast');
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'settings-card__toggle';
  cb.id = 'settings-lan-lww-toast';
  cb.checked = !!readInitialLwwToastPref();
  action.appendChild(cb);

  row.appendChild(copy);
  row.appendChild(action);
  stack.appendChild(row);
}
