import { runLabRepoFetch } from './fetch-run.mjs';

/**
 * @param {{ registro?: string, desde?: Date | string, hasta?: Date | string }} payload
 */
export async function fetchLabRepoStudies(payload) {
  const registro = String(payload?.registro || '').trim();
  if (!registro) throw new Error('lab-repo-missing-registro');
  if (!payload?.desde || !payload?.hasta) {
    throw new Error('lab-repo-missing-range');
  }

  return runLabRepoFetch({
    registro,
    desde: payload.desde,
    hasta: payload.hasta,
  });
}
