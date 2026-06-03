/**
 * Demo-mode mock client factories.
 *
 * Returns Proxy objects that lazily route every method call through the
 * currently-active persona's MHR / MyChart client. This means a single
 * mock client instance handed to session-helpers.ts stays valid across
 * proxy switches — the next call simply hits the newly-active persona.
 *
 * Three MyChart methods are intercepted here rather than delegated:
 *   - switchToProxy(eid)      → mutates active context
 *   - switchToSelf()          → resets active context
 *   - getProxyAccessList()    → built dynamically from the persona registry
 *
 * And one MHR method is intercepted:
 *   - getUser()               → returns the logged-in user's profile (Self),
 *                               with selectedRecordId reflecting the active
 *                               persona. This matches real MHR behavior:
 *                               getUser() returns the account holder, not
 *                               whichever record they're viewing.
 */

import type { MHRClient } from '../../api/mhr-client.js';
import type { MyChartClient } from '../../api/mychart-client.js';
import type { UserProfile } from '../../types.js';
import {
  getActivePersona,
  setActivePersonaById,
  resetActivePersona,
} from './context.js';
import { getAllPersonas, getSelfPersona } from './personas/index.js';
import { DEMO_NOTE } from './shared.js';

export function createDemoMHRClient(): MHRClient {
  return new Proxy({} as MHRClient, {
    get(_target, prop) {
      if (prop === 'getUser') {
        return async () => buildDemoUserProfile();
      }
      const client = getActivePersona().mhrClient as unknown as Record<string | symbol, unknown>;
      const value = client[prop];
      return typeof value === 'function' ? (value as Function).bind(client) : value;
    },
  });
}

export function createDemoMyChartClient(): MyChartClient {
  return new Proxy({} as MyChartClient, {
    get(_target, prop) {
      if (prop === 'switchToProxy') {
        return async (proxyId: string) => {
          if (proxyId === 'self') {
            resetActivePersona();
            return;
          }
          const p = setActivePersonaById(proxyId);
          if (!p) {
            throw new Error(
              `[DEMO] Unknown proxy ID: ${proxyId}. Call mc_list_proxy_access to see available proxies.`,
            );
          }
        };
      }
      if (prop === 'switchToSelf') {
        return async () => {
          resetActivePersona();
        };
      }
      if (prop === 'getProxyAccessList') {
        return async () => buildProxyAccessList();
      }
      const client = getActivePersona().myChartClient as unknown as Record<string | symbol, unknown>;
      const value = client[prop];
      return typeof value === 'function' ? (value as Function).bind(client) : value;
    },
  });
}

function buildDemoUserProfile(): UserProfile {
  const self = getSelfPersona();
  const active = getActivePersona();
  const personas = getAllPersonas();
  return {
    personId: 'demo-user-123',
    name: self.displayName,
    selectedRecordId: active.recordId,
    defaultUserLanguage: 'en-CA',
    isEmergencyAccessMode: false,
    createdDateTimeUtc: '2023-01-15T00:00:00Z',
    authorizedRecords: personas.map(p => ({
      id: p.recordId,
      isCustodian: p.isCustodian,
      displayName: p.displayName,
      name: p.displayName,
      relationshipType: p.relationshipType,
      patientInfo: p.patientInfo,
    })),
  } as UserProfile;
}

function buildProxyAccessList(): unknown {
  const personas = getAllPersonas();
  const active = getActivePersona();
  return {
    ProxySubjects: personas.map(p => ({
      Name: p.displayName,
      Relationship: p.relationshipType,
      Age: p.age,
      DateOfBirth: p.dob,
      AccessLevel: p.accessLevel ?? 'Full',
      ProxyId: p.proxyEid,
      IsSelf: p.isSelf,
      IsSelected: p.id === active.id,
      Description: p.description,
      note: DEMO_NOTE,
    })),
    // mc_switch_context reads this name to determine the new context post-switch.
    ProxySubjectList: personas.map(p => ({
      DisplayName: p.displayName,
      Relationship: p.relationshipType,
      ProxyId: p.proxyEid,
      IsSelf: p.isSelf,
      IsSelected: p.id === active.id,
    })),
    CurrentContext: {
      Name: active.displayName,
      IsSelf: active.isSelf,
      ProxyId: active.proxyEid,
    },
    note: DEMO_NOTE,
  };
}
