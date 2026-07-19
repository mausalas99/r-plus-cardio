import {
  blankAhfEntry,
  ensureAhf,
  entriesForCondition,
} from './historia-clinica-ahf-panel-render.mjs';

function findEntry(ahf, id) {
  return (ahf.entries || []).find(function (e) {
    return e && e.id === id;
  });
}

function applyEntryFieldChange(entry, row, el) {
  const field = el.getAttribute('data-ahf-field');
  if (field === 'ageAtDeath') {
    const n = Number(el.value);
    entry.ageAtDeath = Number.isFinite(n) ? n : null;
    return;
  }
  if (field === 'vitalStatus') {
    entry.vitalStatus = el.value;
    const deathWrap = row.querySelector('.hc-ahf-death-fields');
    if (deathWrap) {
      deathWrap.classList.toggle('hc-ahf-death-fields--hidden', el.value !== 'fallecido');
    }
    if (el.value !== 'fallecido') {
      entry.ageAtDeath = null;
      entry.causeOfDeath = '';
    }
    return;
  }
  entry[field] = el.value;
}

function wireConditionCheckboxes(container, ahf, catalog, onChange, remount) {
  container.querySelectorAll('.hc-check-chip-input[data-ahf-cond]').forEach(function (el) {
    el.addEventListener('change', function () {
      const cid = el.getAttribute('data-ahf-cond');
      if (el.checked) {
        if ((ahf.conditions || []).indexOf(cid) < 0) {
          ahf.conditions = (ahf.conditions || []).concat([cid]);
        }
        if (!entriesForCondition(ahf, cid).length) {
          ahf.entries = ahf.entries || [];
          ahf.entries.push(blankAhfEntry(cid));
        }
      } else {
        ahf.conditions = (ahf.conditions || []).filter(function (id) {
          return id !== cid;
        });
        ahf.entries = (ahf.entries || []).filter(function (e) {
          return e.conditionId !== cid;
        });
      }
      remount();
      onChange(ensureAhf(ahf));
    });
  });
}

function wireCustomConditionAdd(container, ahf, catalog, onChange, remount) {
  const addCustom = container.querySelector('#hc-ahf-add-custom');
  if (!addCustom) return;
  addCustom.onclick = function () {
    const input = container.querySelector('#hc-ahf-custom-label');
    const label = input && input.value ? input.value.trim() : '';
    if (!label) return;
    const id = 'custom_' + Date.now().toString(36);
    ahf.customConditions = ahf.customConditions || [];
    ahf.customConditions.push({ id, label });
    ahf.conditions = (ahf.conditions || []).concat([id]);
    ahf.entries = ahf.entries || [];
    ahf.entries.push(blankAhfEntry(id));
    if (input) input.value = '';
    remount();
    onChange(ensureAhf(ahf));
  };
}

function wireAddRelativeButtons(container, ahf, onChange, remount) {
  container.querySelectorAll('[data-ahf-add-relative]').forEach(function (btn) {
    btn.onclick = function () {
      const cid = btn.getAttribute('data-ahf-add-relative');
      ahf.entries = ahf.entries || [];
      ahf.entries.push(blankAhfEntry(cid));
      remount();
      onChange(ensureAhf(ahf));
    };
  });
}

function wireEntryRow(container, row, ahf, onChange, remount) {
  const entryId = row.getAttribute('data-entry-id');
  const entry = findEntry(ahf, entryId);
  if (!entry) return;

  row.querySelectorAll('[data-ahf-field]').forEach(function (el) {
    function apply() {
      applyEntryFieldChange(entry, row, el);
      onChange(ensureAhf(ahf));
    }
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });

  const relSel = row.querySelector('.hc-ahf-relative');
  if (relSel) {
    relSel.addEventListener('change', function () {
      entry.relativeId = relSel.value;
      onChange(ensureAhf(ahf));
    });
  }

  const removeBtn = row.querySelector('[data-ahf-remove]');
  if (removeBtn) {
    removeBtn.onclick = function () {
      ahf.entries = (ahf.entries || []).filter(function (e) {
        return e.id !== entryId;
      });
      if (!entriesForCondition(ahf, entry.conditionId).length) {
        ahf.conditions = (ahf.conditions || []).filter(function (id) {
          return id !== entry.conditionId;
        });
      }
      remount();
      onChange(ensureAhf(ahf));
    };
  }
}

function wireNotesField(container, ahf, onChange) {
  const notes = container.querySelector('[data-ahf-field="descripcionDetallada"]');
  if (!notes) return;
  notes.addEventListener('input', function () {
    ahf.descripcionDetallada = notes.value;
    onChange(ensureAhf(ahf));
  });
}

/**
 * @param {HTMLElement} container
 * @param {object} ahf
 * @param {Record<string,string>} catalog
 * @param {(next: object) => void} onChange
 * @param {() => void} remount
 */
export function wireAhfPanelInteractions(container, ahf, catalog, onChange, remount) {
  wireConditionCheckboxes(container, ahf, catalog, onChange, remount);
  wireCustomConditionAdd(container, ahf, catalog, onChange, remount);
  wireAddRelativeButtons(container, ahf, onChange, remount);
  container.querySelectorAll('.hc-ahf-entry').forEach(function (row) {
    wireEntryRow(container, row, ahf, onChange, remount);
  });
  wireNotesField(container, ahf, onChange);
}
