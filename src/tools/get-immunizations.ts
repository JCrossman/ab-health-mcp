/**
 * MCP Tool: get_immunizations
 *
 * Returns immunization records from My Health Records.
 * Endpoint confirmed via HAR capture.
 *
 * API: GET /api/phr/v1/myhealth/immunization-data-manager
 * Control-Mapping-Id: 7695
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';
import type { ImmunizationRecord } from '../types.js';

export const getImmunizationsTool = {
  name: 'get_immunizations',
  description: 'Immunization records from MHR — vaccine name, date, source.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date_range: {
        type: 'string',
        enum: ['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear'],
        description: 'Predefined date range filter. Defaults to All.',
      },
      start_date: {
        type: 'string',
        description: 'Custom start date in YYYY-MM-DD format.',
      },
      end_date: {
        type: 'string',
        description: 'Custom end date in YYYY-MM-DD format.',
      },
    },
  },
  handler: async (args: {
    date_range?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    try {
      const client = await ensureSession();
      const results = await client.getImmunizations({
        dateRange: args.date_range ?? 'All',
        startDate: args.start_date,
        endDate: args.end_date,
      });

      const formatted = formatImmunizations(results);

      return {
        content: [
          formattingDirective('table', ['Date', 'Vaccine', 'Administrator', 'Source']),
          {
            type: 'text' as const,
            text: JSON.stringify({
              ...formatted,
              disclaimer: MEDICAL_DISCLAIMER_SHORT,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: formatError(error),
        }],
        isError: true,
      };
    }
  },
};

function formatImmunizations(records: ImmunizationRecord[]) {
  if (!Array.isArray(records)) return { totalRecords: 0, immunizations: [] };

  const immunizations = records.map(record => {
    const values = record.values ?? [];
    const getValue = (name: string) =>
      values.find(v => v.name === name)?.displayString ?? '';

    return {
      date: getValue('date-administered'),
      name: getValue('name'),
      administrator: getValue('administrator'),
      source: getValue('source'),
      thingId: record.itemKey?.thingId,
      isReadOnly: record.isReadOnly,
    };
  });

  return {
    totalRecords: immunizations.length,
    immunizations,
  };
}
