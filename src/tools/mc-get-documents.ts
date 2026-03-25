import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const mcGetDocumentsTool = {
  name: 'mc_get_documents',
  description: 'Clinical documents (MyChart).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      document_id: {
        type: 'string',
        description: 'DCS ID of a specific document to retrieve.',
      },
      file_extension: {
        type: 'string',
        description: 'File extension for the document. Defaults to PDF.',
      },
    },
  },
  handler: async (params: { document_id?: string; file_extension?: string }) => {
    try {
      const client = await ensureMyChartSession();

      if (params.document_id) {
        const ext = params.file_extension ?? 'PDF';
        const data = await client.getDocumentDetails(params.document_id, ext);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER }) }],
        };
      }

      const data = await client.getDocuments();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER }) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
