/** Pitch demo PÉREZ payload (extracted for max-lines budget). */
import { buildDemoPerezPayload } from './pitch-demo-export-perez-data.mjs';

/** @param {Date} ref @param {Date} fallbackRef */
export function buildDemoPerez(ref, fallbackRef) {
  return buildDemoPerezPayload(ref, fallbackRef);
}
