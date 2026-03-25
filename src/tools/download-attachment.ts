/**
 * MCP Tool: download_attachment
 *
 * Downloads a PDF or file attachment from a lab result or diagnostic imaging
 * report. Handles multiple content types:
 * - PDFs: extracts text so Claude can read the report content
 * - Images (JPG/PNG/GIF): returns as MCP image content so Claude displays them inline
 * - Other: returns as base64 resource
 *
 * API: GET /api/phr/v1/attachment/{thingId}/download?bName={filename}
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { binaryToContentBlocks } from '../helpers/content-helpers.js';

export const downloadAttachmentTool = {
  name: 'download_attachment',
  description: 'Download a PDF report or file attachment from a lab result or diagnostic imaging report (MHR). Extracts text from PDFs and displays images inline. Use the thing_id and filename from the attachment metadata returned by get_lab_results or get_diagnostic_imaging.',
  handler: async (args: { thing_id: string; filename: string }) => {
    try {
      if (!args.thing_id || !args.filename) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Both thing_id and filename are required. These are provided in the attachment metadata from get_lab_results or get_diagnostic_imaging.',
          }],
          isError: true,
        };
      }

      const client = await ensureSession();
      const { buffer, contentType } = await client.downloadAttachment(args.thing_id, args.filename);

      const contentBlocks = binaryToContentBlocks(buffer, contentType, args.filename);
      return { content: contentBlocks };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
