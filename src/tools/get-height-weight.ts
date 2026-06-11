/**
 * MCP Tool: get_height_weight
 *
 * Returns height, weight, and BMI measurements.
 *
 * APIs:
 *   GET /api/phr/v1/myhealth/height-data-manager (CMID: 7749)
 *   GET /api/phr/v1/myhealth/weight-data-manager (CMID: 7750)
 *   GET /api/phr/v1/bmi (CMID: 7748)
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const getHeightWeightTool = {
  name: 'get_height_weight',
  description: 'Height, weight, and BMI from MHR. Shows trends over time.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date_range: {
        type: 'string',
        enum: ['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear'],
        description: 'Date range filter. Defaults to All.',
      },
    },
  },
  handler: async (args: { date_range?: string }) => {
    try {
      const client = await ensureSession();
      const data = await client.getHeightWeight({ dateRange: args.date_range ?? 'All' });

      return {
        content: [
          formattingDirective('trend_table', ['Date', 'Measurement', 'Value', 'Unit']),
          {
            type: 'text' as const,
            text: JSON.stringify({
              heightRecords: Array.isArray(data.height) ? data.height.length : 0,
              weightRecords: Array.isArray(data.weight) ? data.weight.length : 0,
              bmiRecords: Array.isArray(data.bmi) ? data.bmi.length : 0,
              height: data.height,
              weight: data.weight,
              bmi: data.bmi,
              disclaimer: MEDICAL_DISCLAIMER_SHORT,
            }),
          },
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
