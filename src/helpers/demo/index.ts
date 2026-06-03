/**
 * Demo mode public API.
 *
 * Re-exports the surface that the rest of the codebase consumed from the
 * legacy src/helpers/demo-data.ts: setDemoMode / isDemoMode flags, and
 * mock MHR + MyChart client factories.
 *
 * See:
 *   - personas/             individual persona data + per-persona mock clients
 *   - context.ts            active-persona state mutated by mc_switch_context
 *   - clients.ts            Proxy-based mock clients that route through context
 *   - shared.ts             DEMO_NOTE and other shared constants
 */

import { resetActivePersona } from './context.js';

export { createDemoMHRClient, createDemoMyChartClient } from './clients.js';
export { getAllPersonas, getPersonaById, getSelfPersona, type Persona } from './personas/index.js';
export { getActivePersona } from './context.js';
export { DEMO_NOTE } from './shared.js';

let _runtimeDemoMode = false;

export function setDemoMode(enabled: boolean): void {
  _runtimeDemoMode = enabled;
  if (!enabled) {
    // Always start a fresh demo session from Self.
    resetActivePersona();
  }
}

export function isDemoMode(): boolean {
  return _runtimeDemoMode;
}
