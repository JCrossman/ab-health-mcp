import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const mcGetDocumentsTool = {
  name: 'mc_get_documents',
  description: 'Get clinical documents from MyChart — includes discharge summaries, progress notes, and procedure reports. Use document_id to get a specific document.',
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
          content: [
            formattingDirective('detail'),
            { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
          ],
        };
      }

      const data = await client.getDocuments();
      return {
        content: [
          formattingDirective('table', ['Date', 'Document', 'Type', 'Actions']),
          { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
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
