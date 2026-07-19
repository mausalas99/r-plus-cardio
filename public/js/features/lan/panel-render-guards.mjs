/**
 * Early-return guard cards for LAN panel render (extracted from panel.mjs).
 */

/**
 * @param {HTMLElement} root
 * @param {{
 *   registered: boolean,
 *   clinicalUserId: string,
 *   userSala: string|null|undefined,
 *   rankConfigured: boolean,
 *   isElevated: boolean,
 * }} ctx
 * @returns {boolean} true when render should stop after guard cards
 */
export function appendLanPanelGuardCards_(root, ctx) {
  if (!ctx.registered && !ctx.clinicalUserId) {
    var unregCard = document.createElement('div');
    unregCard.className = 'lan-connect-card';
    unregCard.innerHTML =
      '<p class="lan-connect-card-hint">Desbloquea la base de datos y completa <strong>Configura tu rotación</strong> para acceder a la red del hospital.</p>';
    root.appendChild(unregCard);
    return true;
  }

  if (!ctx.registered && ctx.clinicalUserId) {
    var preRegCard = document.createElement('div');
    preRegCard.className = 'lan-connect-card';
    preRegCard.innerHTML =
      '<p class="lan-connect-card-hint">Opcional: activa la red del turno y pulsa <strong>Unirse</strong> en tu sala para sincronizar con el equipo. Puedes registrar <strong>@usuario</strong> sin ⇄ si no hay red.</p>';
    root.appendChild(preRegCard);
  }

  if (ctx.registered && !ctx.userSala && !ctx.isElevated) {
    var noSalaCard = document.createElement('div');
    noSalaCard.className = 'lan-connect-card';
    noSalaCard.innerHTML =
      '<p class="lan-connect-card-hint">No tienes una Sala asignada. Contacta a un R4 o Admin.</p>';
    root.appendChild(noSalaCard);
    return true;
  }

  if (ctx.registered && !ctx.rankConfigured) {
    var needRankCard = document.createElement('div');
    needRankCard.className = 'lan-connect-card';
    needRankCard.innerHTML =
      '<p class="lan-connect-card-hint">Primero completa <strong>Configura tu rotación</strong> (rango y sala). Después R+ buscará al anfitrión del turno en la Wi\u2011Fi.</p>';
    root.appendChild(needRankCard);
    return true;
  }

  return false;
}
