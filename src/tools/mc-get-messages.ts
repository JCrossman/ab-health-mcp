import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER, formattingDirective } from './tool-factory.js';

export const mcGetMessagesTool = {
  name: 'mc_get_messages',
  description: 'Get patient messages and conversations from AHS Connect (MyChart) — includes messages from your care team, appointment notifications, and test result letters. Use page parameter to load older messages.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      folder: {
        type: 'string',
        enum: ['inbox', 'sent', 'all'],
        description: 'Message folder to retrieve. Defaults to inbox.',
      },
      message_id: {
        type: 'string',
        description: 'Conversation ID to get full details.',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination. Defaults to 1.',
      },
    },
  },
  handler: async (params: { folder?: string; message_id?: string; page?: number }) => {
    try {
      const client = await ensureMyChartSession();
      const folder = params.folder ?? 'inbox';
      const page = params.page ?? 1;

      if (params.message_id) {
        const data = await client.getConversationDetails(params.message_id);
        return {
          content: [
            formattingDirective('detail'),
            { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER }) },
          ],
        };
      }

      let data;
      if (folder === 'inbox') {
        data = await client.getConversationList(1, page);
      } else if (folder === 'sent') {
        data = await client.getConversationList(7, page);
      } else {
        const [inbox, sent] = await Promise.all([
          client.getConversationList(1, page),
          client.getConversationList(7, page),
        ]);
        data = { inbox, sent };
      }

      return {
        content: [
          formattingDirective('table', ['Date', 'From', 'Subject', 'Status']),
          { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER }) },
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
