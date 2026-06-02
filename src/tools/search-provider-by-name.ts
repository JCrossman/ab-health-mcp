/**
 * MCP Tool: search_provider_by_name
 *
 * Look up an Alberta physician or nurse practitioner by name (partial OK).
 * Returns matching providers with their clinic affiliations and PCN.
 * Public data — no auth.
 */

import { searchPhysiciansByName } from '../api/find-a-provider-client.js';
import { formattingDirective } from './tool-factory.js';

interface SearchByNameArgs {
  name: string;
  include_nurse_practitioners?: boolean;
  doctors_only?: boolean;
  nurse_practitioners_only?: boolean;
}

interface DirectoryResponse {
  items?: unknown[];
  total?: number;
  [k: string]: unknown;
}

export const searchProviderByNameTool = {
  name: 'search_provider_by_name',
  description:
    'Search Alberta physicians and nurse practitioners by name (partial matches OK — e.g. "Smith", "Mahdavi", "Linda"). Returns each provider with their clinic, PCN, languages, and accepting-new-patients status. Public data — no Alberta account needed. Use for "find Dr. Smith\'s clinic" or "is there a Dr. Mahdavi in Edmonton?".',
  handler: async (args: SearchByNameArgs) => {
    try {
      if (!args.name || args.name.trim().length < 2) {
        throw new Error('Please provide a name with at least 2 characters.');
      }
      const includeNps = args.nurse_practitioners_only
        ? true
        : args.doctors_only
          ? false
          : (args.include_nurse_practitioners ?? true);
      const includeDoctors = !args.nurse_practitioners_only;

      const calls: Promise<unknown>[] = [];
      if (includeDoctors) calls.push(searchPhysiciansByName({ name: args.name, isNursePractitioner: 0 }));
      if (includeNps) calls.push(searchPhysiciansByName({ name: args.name, isNursePractitioner: 1 }));

      const results = await Promise.all(calls);
      const merged: Array<Record<string, unknown>> = [];
      let upstreamTotal = 0;
      for (const r of results) {
        const resp = r as DirectoryResponse;
        if (Array.isArray(resp.items)) merged.push(...(resp.items as Array<Record<string, unknown>>));
        if (typeof resp.total === 'number') upstreamTotal += resp.total;
      }

      // The upstream `public-find` parameter is a multi-field LIKE search
      // (matches names, addresses, clinic names, PCNs, etc.), so e.g.
      // searching "Smith" returns clinics on "Smith Street". Post-filter
      // to keep only entries whose actual provider name contains the query.
      const needle = args.name.trim().toLowerCase();
      const nameMatches = merged.filter((p) => {
        const friendly = String(p.friendly_name ?? '').toLowerCase();
        const clinical = String(p.clinical_name ?? '').toLowerCase();
        const first = String(p.first_name ?? '').toLowerCase();
        const last = String(p.last_name ?? '').toLowerCase();
        return (
          friendly.includes(needle) ||
          clinical.includes(needle) ||
          first.includes(needle) ||
          last.includes(needle)
        );
      });

      return {
        content: [
          formattingDirective('table', ['Name', 'Type', 'Clinic', 'City', 'PCN', 'Accepting new patients']),
          {
            type: 'text' as const,
            text: JSON.stringify({
              source: 'albertafindaprovider.ca (public directory)',
              query: args.name,
              upstreamMatches: upstreamTotal,
              nameMatches: nameMatches.length,
              providers: nameMatches,
              note:
                'Results post-filtered to providers whose name actually contains the query (the upstream API does a broader multi-field search). Accepting-new-patients status is set per clinic — check it on each entry. Always confirm directly with the provider before visiting.',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Unknown error during provider name search.',
          },
        ],
        isError: true,
      };
    }
  },
};
