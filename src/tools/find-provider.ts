/**
 * MCP Tool: find_provider
 *
 * Geo-radius search of Alberta clinics and physicians via the public
 * `albertafindaprovider.ca` API. Pass-through — no PHI involved, no auth.
 *
 * Always real, even in demo mode.
 */

import {
  findClinics,
  geocode,
  resolveLanguage,
  resolvePcn,
  resolveServices,
} from '../api/find-a-provider-client.js';
import { formattingDirective } from './tool-factory.js';

interface FindProviderArgs {
  postal_code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  accepting_new_patients?: boolean;
  gender_preference?: 'male' | 'female';
  language?: string;
  pcn?: string;
  services?: string[];
  walk_in_only?: boolean;
}

export const findProviderTool = {
  name: 'find_provider',
  description:
    'Search for Alberta clinics and family doctors by location. Returns clinics with their physicians, services, contact info, and geographic details. Public data — no Alberta account or login needed. Use to answer "find a doctor near me", "find a clinic accepting new patients in T6G 1L7", "find a female doctor who speaks Mandarin within 10km of downtown Calgary". One of postal_code, address, or latitude+longitude is required.',
  handler: async (args: FindProviderArgs) => {
    try {
      let lat = args.latitude;
      let lng = args.longitude;
      let resolvedAddress: string | undefined;

      if (lat == null || lng == null) {
        const query = args.postal_code ?? args.address;
        if (!query) {
          throw new Error(
            'You must provide one of: postal_code (e.g. "T6G 1L7"), address, or latitude+longitude.',
          );
        }
        const geo = await geocode(query);
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddress = geo.displayName;
      }

      const data = await findClinics({
        lat,
        lng,
        radiusKm: args.radius_km ?? 10,
        acceptingNewPatients: args.accepting_new_patients,
        genderPreference:
          args.gender_preference === 'male' ? 'm' : args.gender_preference === 'female' ? 'f' : undefined,
        languageId: args.language ? resolveLanguage(args.language) : undefined,
        pcnId: args.pcn ? resolvePcn(args.pcn) : undefined,
        serviceIds: args.services ? resolveServices(args.services) : undefined,
        walkInOnly: args.walk_in_only,
        address: resolvedAddress,
      });

      return {
        content: [
          formattingDirective('grouped_tables'),
          {
            type: 'text' as const,
            text: JSON.stringify({
              source: 'albertafindaprovider.ca (public directory)',
              searchCenter: { lat, lng, resolvedAddress },
              results: data,
              note:
                'This is public Alberta provider directory data. Always confirm hours, accepting-new-patients status, and services directly with the clinic before visiting.',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Unknown error during provider search.',
          },
        ],
        isError: true,
      };
    }
  },
};
