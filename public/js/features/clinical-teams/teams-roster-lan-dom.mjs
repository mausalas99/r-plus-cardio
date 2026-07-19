/** LAN directorio modal DOM accessors. */

export function lanUsersModalBackdropEl() {
  return document.getElementById('clinical-lan-users-backdrop');
}

export function lanUsersModalBodyEl() {
  return document.getElementById('clinical-lan-users-panel-body');
}

export function isLanDirectoryModalOpen() {
  const bd = lanUsersModalBackdropEl();
  return !!(bd && bd.classList.contains('open'));
}
