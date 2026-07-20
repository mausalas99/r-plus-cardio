/** Perfil — modal open/close. */
import { isMobileWeb } from "../mobile-web.mjs";
import { closeModalAnimated } from "../ui-motion.mjs";
import { loadSettings } from "./profile-load.mjs";

export function openProfileModal() {
  if (isMobileWeb()) return;
  var modal = document.getElementById("profile-modal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  queueMicrotask(function () {
    loadSettings();
    var first = document.getElementById("profile-doctor");
    if (first) {
      try {
        first.focus({ preventScroll: true });
      } catch {
        /* focus optional */
      }
    }
  });
}

export function closeProfileModal() {
  closeModalAnimated(document.getElementById("profile-modal"));
}

export function toggleProfileSection() {
  var modal = document.getElementById("profile-modal");
  if (!modal) return;
  if (modal.classList.contains("open")) closeProfileModal();
  else openProfileModal();
}

export function syncProfileSectionVisibility() {
  /* No-op desde 3.0 */
}

export function openProfileFromHeader(ev) {
  if (ev) ev.preventDefault();
  openProfileModal();
}
