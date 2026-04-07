/**
 * MCP Tool: get_health_overview
 *
 * Composite tool that fetches a broad health snapshot from both MHR and MyChart
 * in parallel. Saves 4-6 sequential tool calls for questions like
 * "give me a complete health summary."
 *
 * Uses Promise.allSettled so partial failures don't block the whole response.
 */

import { ensureSession, ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER, formattingDirective } from './tool-factory.js';

export const getHealthOverviewTool = {
  name: 'get_health_overview',
  description: 'Get a comprehensive health overview from both MHR and MyChart in a single call — includes user profile, medications, allergies, recent lab results, health issues, and immunizations. Use this for broad health questions instead of calling individual tools.',
  handler: async () => {
    try {
      // Establish both sessions (MyChart failure is non-fatal)
      const mhrClient = await ensureSession();
      let mcClient: Awaited<ReturnType<typeof ensureMyChartSession>> | null = null;
      try {
        mcClient = await ensureMyChartSession();
      } catch {
        // MyChart not available — continue with MHR only
      }

      // Fire all API calls in parallel
      const allergiesPromise = mcClient ? mcClient.getAllergies() : Promise.reject('MyChart not connected');
      const healthIssuesPromise = mcClient ? mcClient.getHealthIssues() : Promise.reject('MyChart not connected');
      const immunizationsPromise = mcClient ? mcClient.getImmunizations() : Promise.reject('MyChart not connected');

      const [profile, mhrMeds, labs, allergies, healthIssues, immunizations] =
        await Promise.allSettled([
          mhrClient.getUser(),
          mhrClient.getMedications(),
          mhrClient.getLabResults({
            dateRange: 'Last3Months',
            startDate: '',
            endDate: '',
          }),
          allergiesPromise,
          healthIssuesPromise,
          immunizationsPromise,
        ]);

      const extract = (result: PromiseSettledResult<unknown>) =>
        result.status === 'fulfilled' ? result.value : null;

      const overview = {
        profile: extract(profile),
        medications_mhr: extract(mhrMeds),
        recent_lab_results: extract(labs),
        allergies_mychart: extract(allergies),
        health_issues_mychart: extract(healthIssues),
        immunizations_mychart: extract(immunizations),
        sources: {
          mhr: true,
          myChart: mcClient !== null,
        },
        _displayHint: 'summary_sections',
        hint: 'For more detail on any section, use the specific tool (e.g., get_lab_results, mc_get_allergies). For attachments/PDFs in lab results, use download_attachment.',
        disclaimer: MEDICAL_DISCLAIMER,
      };

      return {
        content: [
          formattingDirective('summary_sections'),
          { type: 'text' as const, text: JSON.stringify(overview) },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
