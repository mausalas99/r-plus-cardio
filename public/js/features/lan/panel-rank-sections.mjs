/**
 * LAN panel rank sections (R1/R2/R4) — extracted from panel.mjs.
 */
import { filterJoinedTeams } from '../clinical-teams.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { patients } from '../../app-state.mjs';
import { LIVE_SYNC_SALA_DEFS } from '../../lan-join-link.mjs';

function teamSalaKey(team) {
  return String(team && team.sala || '').trim();
}

async function openR4TeamCreationModal(runtime) {
  try {
    var mod = await import('../clinical-teams.mjs');
    if (typeof mod.openClinicalTeamsPanel === 'function') {
      mod.openClinicalTeamsPanel();
    } else {
      runtime().showToast('Panel de equipos no disponible.', 'error');
    }
  } catch {
    runtime().showToast('Panel de equipos no disponible.', 'error');
  }
}

async function refreshClinicalSessionTeams(getClinicalUserUserId) {
  var api = typeof window !== 'undefined' ? (window.rplusDb || window.electronAPI) : null;
  if (!api) return;
  if (typeof api.dbClinicalScopeContext === 'function') {
    var userId = getClinicalUserUserId();
    var res = await api.dbClinicalScopeContext({ userId: userId });
    if (res && res.ok && Array.isArray(res.context?.teams)) {
      clinicalSessionContext.teams = res.context.teams;
      if (res.context && typeof res.context === 'object') {
        clinicalSessionContext.scopeContext = res.context;
      }
      return;
    }
  }
  if (typeof api.dbClinicalTeamsList === 'function') {
    var listRes = await api.dbClinicalTeamsList();
    if (listRes && listRes.ok && Array.isArray(listRes.teams)) {
      clinicalSessionContext.teams = listRes.teams;
    }
  }
}

async function joinClinicalTeam(deps, teamId) {
  var api = typeof window !== 'undefined' ? (window.rplusDb || window.electronAPI) : null;
  if (!api || typeof api.dbClinicalTeamsMemberAdd !== 'function') {
    deps.runtime().showToast('Base de datos no disponible.', 'error');
    return;
  }
  var userId = deps.getClinicalUserUserId();
  if (!userId) {
    deps.runtime().showToast('No hay sesión clínica activa.', 'error');
    return;
  }

  var addRes = await api.dbClinicalTeamsMemberAdd({ teamId: teamId, userId: userId });
  if (!addRes || addRes.ok === false) {
    deps.runtime().showToast(addRes?.error || 'No se pudo unir al equipo.', 'error');
    return;
  }

  var rank = deps.getClinicalRank();
  if (rank === 'R2' && api && typeof api.dbClinicalTeamsPromoteLeader === 'function') {
    var promoteRes = await api.dbClinicalTeamsPromoteLeader({ teamId: teamId, userId: userId });
    if (!promoteRes || promoteRes.ok === false) {
      deps.runtime().showToast('Unido al equipo pero no se pudo asignar como líder.', 'warn');
    }
  }

  deps.runtime().showToast('Unido al equipo.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await refreshClinicalSessionTeams(deps.getClinicalUserUserId);
  deps.renderLanPanel({ force: true });
}

function buildAvailableTeamsSection(deps, root, userSala) {
  var teams = clinicalSessionContext.teams || [];
  var user = clinicalSessionContext.user || {};
  var salaKey = String(userSala || '').trim();
  var alreadyInIds = filterJoinedTeams(teams, user).map(function (t) {
    return String(t.team_id);
  });
  var available = teams.filter(function (t) {
    return teamSalaKey(t) === salaKey && !t.archived_at && alreadyInIds.indexOf(String(t.team_id)) === -1;
  });

  if (!available.length) {
    var empty = document.createElement('p');
    empty.className = 'lan-connect-card-hint';
    empty.textContent = 'No hay equipos disponibles en tu Sala.';
    root.appendChild(empty);
    return;
  }

  var list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '0';
  available.forEach(function (t) {
    var li = document.createElement('li');
    li.style.display = 'flex';
    li.style.gap = '8px';
    li.style.alignItems = 'center';
    li.style.marginBottom = '6px';

    var info = document.createElement('span');
    info.style.flex = '1';
    info.style.fontSize = '12px';
    var cycle = t.sub_area_fraction ? String(t.sub_area_fraction) : '';
    info.textContent =
      (t.name || 'Equipo') +
      ' · ' +
      (t.service || '') +
      (cycle ? ' · ciclo ' + cycle : '');

    var joinBtn = document.createElement('button');
    joinBtn.type = 'button';
    joinBtn.className = 'btn-lan-secondary';
    joinBtn.style.flex = '0 0 auto';
    joinBtn.textContent = 'Unirse';
    joinBtn.onclick = function () {
      void joinClinicalTeam(deps, String(t.team_id));
    };

    li.appendChild(info);
    li.appendChild(joinBtn);
    list.appendChild(li);
  });
  root.appendChild(list);
}

function buildR1Section(deps, root) {
  var userSala = deps.getUserSala();
  var user = clinicalSessionContext.user || {};
  var joined = filterJoinedTeams(clinicalSessionContext.teams || [], user);
  var myTeam = joined[0] || null;

  var row = document.createElement('div');
  row.className = 'settings-card';
  var copy = document.createElement('div');
  copy.className = 'settings-card__copy';
  var title = document.createElement('p');
  title.className = 'settings-card__title';
  title.textContent = 'Mi equipo';
  copy.appendChild(title);

  if (myTeam) {
    var teamName = document.createElement('p');
    teamName.className = 'settings-card__desc';
    teamName.textContent = myTeam.name || 'Sin nombre';
    copy.appendChild(teamName);
  } else {
    var noTeam = document.createElement('p');
    noTeam.className = 'settings-card__desc';
    noTeam.innerHTML =
      'Sin equipo — <button type="button" class="lan-hub-link-btn" id="lan-hub-join-team">Unirse a un equipo</button>';
    copy.appendChild(noTeam);
  }

  row.appendChild(copy);
  root.appendChild(row);

  var joinTeamBtn = row.querySelector('#lan-hub-join-team');
  if (joinTeamBtn) {
    joinTeamBtn.onclick = function () {
      var availCard = document.getElementById('lan-hub-available-teams');
      if (availCard) {
        availCard.remove();
        return;
      }
      var avail = document.createElement('div');
      avail.id = 'lan-hub-available-teams';
      avail.className = 'lan-connect-card';
      avail.innerHTML = '<div class="lan-connect-card-title">Equipos disponibles</div>';
      buildAvailableTeamsSection(deps, avail, userSala);
      row.parentNode.insertBefore(avail, row.nextSibling);
    };
  }
}

function buildR2Section(deps, root) {
  buildR1Section(deps, root);

  var user = clinicalSessionContext.user || {};
  var myTeam = filterJoinedTeams(clinicalSessionContext.teams || [], user)[0] || null;

  if (!myTeam) return;

  var entregaCard = document.createElement('div');
  entregaCard.className = 'lan-connect-card lan-hub-entrega-card';
  entregaCard.innerHTML = '<div class="lan-connect-card-title">Solicitar entrega</div>';

  var guardiasForTeam = (clinicalSessionContext.guardias || []).filter(function (g) {
    return g && String(g.source_team_id) === String(myTeam.team_id);
  });

  if (!guardiasForTeam.length) {
    var emptyHint = document.createElement('p');
    emptyHint.className = 'lan-connect-card-hint';
    emptyHint.textContent = 'No hay pacientes entregados por tu equipo.';
    entregaCard.appendChild(emptyHint);
  } else {
    var entregaList = document.createElement('ul');
    entregaList.style.listStyle = 'none';
    entregaList.style.padding = '0';
    entregaList.style.margin = '0';
    guardiasForTeam.forEach(function (g) {
      var li = document.createElement('li');
      li.style.marginBottom = '6px';
      li.style.fontSize = '12px';
      li.textContent = 'Paciente ' + String(g.patient_id || '').slice(0, 8) + '\u2026' + ' \u2014 ' + (g.covering_user_id || '');
      entregaList.appendChild(li);
    });
    entregaCard.appendChild(entregaList);
  }

  root.appendChild(entregaCard);
}

async function handleFinalizarRotacion(deps) {
  var api = typeof window !== 'undefined' ? (window.rplusDb || window.electronAPI) : null;
  if (!api || typeof api.dbRotationNueva !== 'function') {
    deps.runtime().showToast('Operación no disponible.', 'error');
    return;
  }
  var user = typeof clinicalSessionContext !== 'undefined' ? clinicalSessionContext.user : null;
  var userId = user ? String(user.user_id || '') : '';
  var res = await api.dbRotationNueva({ userId: userId });
  if (res && res.ok) {
    deps.runtime().showToast('Rotación finalizada. Crea nuevos equipos para el siguiente mes.', 'success');
    document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
    deps.renderLanPanel({ force: true });
  } else {
    deps.runtime().showToast(res && res.error || 'No se pudo finalizar la rotación.', 'error');
  }
}

function buildR4Section(deps, root) {
  var teamCard = document.createElement('div');
  teamCard.className = 'lan-connect-card lan-hub-team-create-card';
  teamCard.innerHTML = '<div class="lan-connect-card-title">Crear equipos del mes</div>';

  var btnCreate = document.createElement('button');
  btnCreate.type = 'button';
  btnCreate.className = 'btn-lan-primary';
  btnCreate.style.width = '100%';
  btnCreate.textContent = 'Crear equipos del mes';
  btnCreate.onclick = function () {
    openR4TeamCreationModal(deps.runtime);
  };
  teamCard.appendChild(btnCreate);
  root.appendChild(teamCard);

  var censusCard = document.createElement('div');
  censusCard.className = 'lan-connect-card lan-hub-census-card';
  censusCard.innerHTML = '<div class="lan-connect-card-title">Censo global</div>';

  var teams = clinicalSessionContext.teams || [];
  var allPatients = patients || [];
  var salas = LIVE_SYNC_SALA_DEFS.map(function (d) { return d.key; });

  salas.forEach(function (salaName) {
    var salaTeams = teams.filter(function (t) {
      return teamSalaKey(t) === salaName;
    });
    var salaPatientCount = allPatients.filter(function (p) {
      return p && String(p.sala || '') === salaName;
    }).length;

    var row = document.createElement('p');
    row.className = 'lan-connect-card-hint';
    row.style.marginBottom = '4px';
    row.textContent =
      salaName + ': ' + salaTeams.length + ' equipos · ' + salaPatientCount + ' pacientes';
    censusCard.appendChild(row);
  });

  var viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'btn-lan-secondary';
  viewBtn.style.width = '100%';
  viewBtn.style.marginTop = '8px';
  viewBtn.textContent = 'Ver censo en lista de pacientes';
  viewBtn.onclick = function () {
    try {
      localStorage.setItem('clinical.browseSala', '__all__');
      localStorage.setItem('clinical.censusFilterSala', '__all__');
    } catch (_e) { void _e; }
    document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
    if (typeof deps.runtime().renderPatientList === 'function') deps.runtime().renderPatientList();
    deps.runtime().showToast('Censo global — usa los filtros en la lista de pacientes.', 'info');
  };
  censusCard.appendChild(viewBtn);

  root.appendChild(censusCard);

  var rotCard = document.createElement('div');
  rotCard.className = 'lan-connect-card lan-hub-rotation-card';
  rotCard.innerHTML = '<div class="lan-connect-card-title">Rotación</div>';
  var btnFinalizar = document.createElement('button');
  btnFinalizar.type = 'button';
  btnFinalizar.className = 'btn-lan-secondary';
  btnFinalizar.style.width = '100%';
  btnFinalizar.style.color = 'var(--danger)';
  btnFinalizar.textContent = 'Finalizar rotación (archivar equipos)';
  btnFinalizar.onclick = function () {
    void handleFinalizarRotacion(deps);
  };
  rotCard.appendChild(btnFinalizar);
  root.appendChild(rotCard);
}

/** @param {{ runtime: () => object, getUserSala: () => string, getClinicalRank: () => string, getClinicalUserUserId: () => string, renderLanPanel: (opts?: object) => void }} deps */
export function createPanelRankSections(deps) {
  return {
    buildR1Section: function (root) {
      buildR1Section(deps, root);
    },
    buildR2Section: function (root) {
      buildR2Section(deps, root);
    },
    buildR4Section: function (root) {
      buildR4Section(deps, root);
    },
    refreshClinicalSessionTeams: function () {
      return refreshClinicalSessionTeams(deps.getClinicalUserUserId);
    },
    joinClinicalTeam: function (teamId) {
      return joinClinicalTeam(deps, teamId);
    },
  };
}
