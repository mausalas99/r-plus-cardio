/** Pause background host discovery after repeated misses; resume on explicit user action. */

export const MAX_AUTO_HOST_DETECT_ATTEMPTS = 5;

let _missCount = 0;
let _paused = false;

export function isAutoHostDetectPaused() {
  return _paused;
}

export function canAttemptAutoHostDetect() {
  return !_paused;
}

export function recordAutoHostDetectMiss() {
  _missCount += 1;
  if (_missCount >= MAX_AUTO_HOST_DETECT_ATTEMPTS) {
    _paused = true;
  }
}

export function recordAutoHostDetectSuccess() {
  _missCount = 0;
  _paused = false;
}

export function resumeAutoHostDetect() {
  _missCount = 0;
  _paused = false;
}

export function getAutoHostDetectMissCount() {
  return _missCount;
}
