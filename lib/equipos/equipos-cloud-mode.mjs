/** Detect cloud-hosted equipos pages (Worker + Assets). */

export function isCloudEquiposMode() {
  return typeof window !== 'undefined' && window.__EQUIPOS_API_MODE__ === 'cloud';
}
