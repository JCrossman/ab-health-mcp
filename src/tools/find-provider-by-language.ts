/**
 * MCP Tool: find_provider_by_language
 *
 * Find clinics with at least one physician who speaks a specific language,
 * within a geographic radius. Returns the same clinic shape as
 * `find_provider` but pre-focuses the LLM on the language match.
 *
 * Public data — no auth.
 */

import {
  findClinics,
  geocode,
  resolveLanguage,
  LANGUAGES,
} from '../api/find-a-provider-client.js';
import { formattingDirective } from './tool-factory.js';

interface FindByLanguageArgs {
  language: string;
  postal_code?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  accepting_new_patients?: boolean;
}

interface ClinicResponse {
  items?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

export const findProviderByLanguageTool = {
  name: 'find_provider_by_language',
  description:
    'Find Alberta clinics that have at least one physician who speaks a specific language (e.g. "Mandarin", "Punjabi", "Arabic", "Spanish"), near a given location. Returns each matching clinic with the specific physician(s) who speak that language called out. Public data — no Alberta account needed. Use for "find me a doctor who speaks Mandarin near T6G 1L7".',
  handler: async (args: FindByLanguageArgs) => {
    try {
      if (!args.language) {
        throw new Error(
          `Please specify a language. Supported: ${Object.values(LANGUAGES).join(', ')}.`,
        );
      }
      const languageId = resolveLanguage(args.language);
      const languageName = LANGUAGES[languageId];

      let lat = args.latitude;
      let lng = args.longitude;
      let resolvedAddress: string | undefined;
      if (lat == null || lng == null) {
        const query = args.postal_code ?? args.address;
        if (!query) {
          throw new Error('You must provide one of: postal_code, address, or latitude+longitude.');
        }
        const geo = await geocode(query);
        lat = geo.lat;
        lng = geo.lng;
        resolvedAddress = geo.displayName;
      }

      const data = (await findClinics({
        lat,
        lng,
        radiusKm: args.radius_km ?? 10,
        acceptingNewPatients: args.accepting_new_patients,
        languageId,
        address: resolvedAddress,
      })) as ClinicResponse;

      // Highlight the matching physicians in each clinic so the LLM
      // doesn't have to re-scan the languages array on every entry.
      const clinics = Array.isArray(data?.items) ? data.items : [];
      const annotated = clinics.map((c) => {
        const physicians = (c.physicians as Array<Record<string, unknown>> | undefined) ?? [];
        const matching = physicians.filter((p) => {
          const langs = (p.languages as Array<{ id?: number; name?: string }> | undefined) ?? [];
          return langs.some((l) => l.id === languageId);
        });
        return {
          ...c,
          physiciansSpeakingLanguage: matching.map((p) => ({
            id: p.id,
            name: p.friendly_name ?? p.clinical_name,
            gender: p.gender,
            isNursePractitioner: !!p.nurse_practitioner,
          })),
        };
      });

      return {
        content: [
          formattingDirective('grouped_tables'),
          {
            type: 'text' as const,
            text: JSON.stringify({
              source: 'albertafindaprovider.ca (public directory)',
              language: languageName,
              searchCenter: { lat, lng, resolvedAddress },
              clinicsMatching: annotated.length,
              results: { ...data, items: annotated },
              note: `Each clinic listed has at least one physician who speaks ${languageName}. The 'physiciansSpeakingLanguage' field on each clinic identifies which specific providers. Always confirm language availability and accepting-new-patients status directly with the clinic before visiting.`,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Unknown error during language-based provider search.',
          },
        ],
        isError: true,
      };
    }
  },
};
