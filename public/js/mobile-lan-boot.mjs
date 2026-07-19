/**
 * Mobile PWA: defer LAN join/sync until after first paint (bundle + sync no longer block UI).
 */
import { isMobileWeb } from './mobile-web.mjs';

/** @param {() => void | Promise<void>} fn */
export function scheduleMobileLanWork(fn) {
  if (!isMobileWeb()) {
    void Promise.resolve().then(fn);
    return;
  }
  const run = () => {
    try {
      void Promise.resolve(fn());
    } catch (e) {
      console.warn('[R+] mobile LAN boot:', e && e.message);
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 800 });
      } else {
        setTimeout(run, 50);
      }
    });
  } else {
    setTimeout(run, 50);
  }
}
