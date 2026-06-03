/**
 * Demo mode active-context state.
 *
 * Tracks which persona's data the mock clients are returning. Mutated by
 * the demo MyChart client's switchToProxy() — wired in clients.ts so that
 * a real call to mc_switch_context flips the active persona for ALL
 * subsequent MHR and MyChart calls.
 *
 * Demo-mode divergence note: real MHR selects a record at sign-in and
 * cannot switch mid-session. In demo mode, the MHR client follows the
 * MyChart proxy switch so the user can explore each persona's data
 * without re-authenticating. This divergence is surfaced in the
 * mc_switch_context response payload when demo mode is active.
 */

import { type Persona, getSelfPersona, getPersonaById } from './personas/index.js';

let activePersona: Persona = getSelfPersona();

export function getActivePersona(): Persona {
  return activePersona;
}

export function setActivePersonaById(id: string): Persona | undefined {
  const p = getPersonaById(id);
  if (!p) return undefined;
  activePersona = p;
  return p;
}

export function resetActivePersona(): void {
  activePersona = getSelfPersona();
}
