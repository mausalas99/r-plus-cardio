import * as ficha from './profiles/drive-ficha-hc-v1.mjs';
import * as pipe from './profiles/drive-pipe-hc-v1.mjs';
import * as evOnly from './profiles/drive-eventos-only-v1.mjs';
import * as fragment from './profiles/drive-fragment-v1.mjs';

/** @type {Array<{ id: string, label: string, score: Function, mapHc: Function }>} */
export const PROFILES = [ficha, pipe, evOnly, fragment];

const SPECIFICITY = {
  'drive-ficha-hc-v1': 4,
  'drive-pipe-hc-v1': 3,
  'drive-eventos-only-v1': 2,
  'drive-fragment-v1': 1,
};

/**
 * @param {Record<string, string>} sections
 * @param {unknown} header
 * @returns {{ profileId: string, scored: Array<{ id: string, label: string, score: number }> }}
 */
export function detectProfile(sections, header) {
  const scored = PROFILES.map((p) => ({
    id: p.id,
    label: p.label,
    score: p.score(sections, header),
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (SPECIFICITY[b.id] || 0) - (SPECIFICITY[a.id] || 0);
  });
  const top = scored[0];
  const profileId = top && top.score >= 40 ? top.id : 'drive-fragment-v1';
  return { profileId, scored };
}

/**
 * @param {string} profileId
 */
export function getProfile(profileId) {
  return PROFILES.find((p) => p.id === profileId) || fragment;
}

export function listProfiles() {
  return PROFILES.map((p) => ({ id: p.id, label: p.label }));
}
