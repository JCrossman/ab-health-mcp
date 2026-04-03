/**
 * MCP Tool: mc_download_document
 *
 * Downloads a document or scan image from MyChart (AHS Connect) by its dcsId.
 * Works for test result scans (colonoscopy images, lab PDFs), clinical documents, etc.
 *
 * Flow:
 * 1. Call GetDocumentDetails(dcsId, fileExtension) → get downloadUrl + metadata
 * 2. GET the downloadUrl → binary content
 * 3. Return as MCP image (JPG/PNG) or extracted PDF text
 *
 * The dcsId comes from:
 * - Test result details: results[0].scans[].dcsId
 * - Document listings: documents[].dcsId
 */

import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { binaryToContentBlocks } from '../helpers/content-helpers.js';
import { logger } from '../utils/logger.js';

export const mcDownloadDocumentTool = {
  name: 'mc_download_document',
  description: 'Download a document or image scan from MyChart. Use with dcsId and fileExtension from test result scans or clinical documents. Returns images inline and extracts text from PDFs.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      dcs_id: {
        type: 'string',
        description: 'Document content service ID (dcsId) from test result scans or document listings.',
      },
      file_extension: {
        type: 'string',
        description: 'File extension (e.g., JPG, PNG, PDF). From the scan/document metadata.',
      },
    },
    required: ['dcs_id', 'file_extension'],
  },
  handler: async (params: { dcs_id: string; file_extension: string }) => {
    try {
      if (!params.dcs_id || !params.file_extension) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Both dcs_id and file_extension are required. These come from the scans[] array in test result details or from document listings.',
          }],
          isError: true,
        };
      }

      const client = await ensureMyChartSession();

      // Step 1: Get document metadata including download URL
      const docDetails = await client.getDocumentDetails(params.dcs_id, params.file_extension) as Record<string, unknown>;

      const downloadUrl = docDetails.downloadUrl as string | undefined;
      const displayName = (docDetails.displayName as string) || `document.${params.file_extension}`;
      const mimeType = (docDetails.mimeType as string) || 'application/octet-stream';

      if (!downloadUrl) {
        return {
          content: [{
            type: 'text' as const,
            text: `Document metadata retrieved but no download URL available.\n\nDetails: ${JSON.stringify(docDetails)}`,
          }],
        };
      }

      // Step 2: Download the binary content
      const { buffer, contentType } = await client.downloadDocumentBinary(downloadUrl);
      const effectiveMime = contentType || mimeType;

      logger.info(`Downloaded document: ${Math.round(buffer.length / 1024)}KB, ${effectiveMime}`);

      // Step 3: Convert to MCP content blocks
      const contentBlocks = binaryToContentBlocks(buffer, effectiveMime, displayName);
      return { content: contentBlocks };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
