/**
 * Demo persona registry.
 *
 * Each persona is a self-contained mock identity with its own MHR + MyChart
 * data clients. The active persona is tracked in context.ts and mutated by
 * mc_switch_context (which calls switchToProxy on the demo MyChart client).
 *
 * Phase A: only Self is populated. Mother, Spouse, Child stubs appear in
 * Phase B once their narratives are reviewed and approved.
 */

import type { MHRClient } from '../../../api/mhr-client.js';
import type { MyChartClient } from '../../../api/mychart-client.js';

import { selfPersona } from './self.js';
import { motherPersona } from './mother.js';
import { spousePersona } from './spouse.js';
import { childPersona } from './child.js';

export interface Persona {
  /** Stable id used as the proxy "EID" in mc_switch_context. */
  id: string;
  /** MHR authorizedRecord ID. */
  recordId: string;
  /** MyChart proxy EID (== id for consistency). */
  proxyEid: string;
  displayName: string;
  /** Relationship to the logged-in user, e.g. 'Self' | 'Mother' | 'Spouse' | 'Child'. */
  relationshipType: string;
  isCustodian: boolean;
  isSelf: boolean;
  dob: string;
  age?: number;
  patientInfo: string;
  accessLevel?: 'Full' | 'Limited';
  description?: string;
  /** Mock MHR client returning this persona's data. */
  mhrClient: MHRClient;
  /** Mock MyChart client returning this persona's data. */
  myChartClient: MyChartClient;
}

/**
 * Ordered list of personas in the demo registry.
 * Self is always first. Others are appended as they are authored.
 */
const PERSONA_LIST: Persona[] = [
  selfPersona,
  motherPersona,
  spousePersona,
  childPersona,
];

const PERSONA_BY_ID: Map<string, Persona> = new Map(PERSONA_LIST.map(p => [p.id, p]));

export function getAllPersonas(): Persona[] {
  return PERSONA_LIST.slice();
}

export function getPersonaById(id: string): Persona | undefined {
  return PERSONA_BY_ID.get(id);
}

export function getSelfPersona(): Persona {
  return selfPersona;
}
