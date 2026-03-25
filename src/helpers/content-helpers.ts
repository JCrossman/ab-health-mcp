/**
 * Shared PDF/image content handling for download tools.
 *
 * Both download_attachment (MHR) and mc_download_document (MyChart)
 * need to convert binary downloads into MCP content blocks.
 */

import * as mupdf from 'mupdf';
import { logger } from '../utils/logger.js';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType: string; blob: string } };

/**
 * Extract text content from a PDF buffer using mupdf.
 * Returns the extracted text or null if the PDF is image-based (scanned).
 */
export function extractPdfText(buffer: Buffer): string | null {
  try {
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    const pageCount = doc.countPages();
    const parts: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const text = page.toStructuredText().asText();
      if (text?.trim()) {
        parts.push(text.trim());
      }
    }

    const fullText = parts.join('\n\n---\n\n');
    if (fullText.length < 10) {
      logger.info('PDF text extraction returned empty/minimal text — likely a scanned document');
      return null;
    }
    return fullText;
  } catch (error) {
    logger.warn(`PDF text extraction failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

/**
 * Render PDF pages as PNG images using mupdf (WASM — no native deps).
 * Used for scanned PDFs without text layers so Claude's vision can read them.
 */
export function renderPdfAsImages(buffer: Buffer): Array<{ data: string; page: number }> | null {
  try {
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    const pageCount = doc.countPages();
    const pages: Array<{ data: string; page: number }> = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      // Scale 2x for readable text quality
      const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
      const png = pixmap.asPNG();
      pages.push({
        data: Buffer.from(png).toString('base64'),
        page: i + 1,
      });
    }

    return pages.length > 0 ? pages : null;
  } catch (error) {
    logger.warn(`PDF rendering failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  }
}

/**
 * Convert a binary buffer into MCP content blocks based on MIME type.
 * Handles images (inline display), PDFs (text extraction + image fallback), and other files.
 */
export function binaryToContentBlocks(
  buffer: Buffer,
  mimeType: string,
  displayName: string,
): ContentBlock[] {
  const sizeKB = Math.round(buffer.length / 1024);
  const blocks: ContentBlock[] = [];

  const isImage = IMAGE_MIME_TYPES.some(m => mimeType.includes(m));
  const isPdf = mimeType.includes('pdf');

  if (isImage) {
    blocks.push({ type: 'image' as const, data: buffer.toString('base64'), mimeType });
    blocks.push({ type: 'text' as const, text: `Image: ${displayName} (${sizeKB}KB, ${mimeType})` });
  } else if (isPdf) {
    const extractedText = extractPdfText(buffer);
    if (extractedText) {
      blocks.push({ type: 'text' as const, text: `# ${displayName}\n\n${extractedText}` });
    } else {
      const pageImages = renderPdfAsImages(buffer);
      if (pageImages && pageImages.length > 0) {
        blocks.push({
          type: 'text' as const,
          text: `# ${displayName} (${pageImages.length} page${pageImages.length > 1 ? 's' : ''}, rendered as images — scanned document)`,
        });
        for (const img of pageImages) {
          blocks.push({ type: 'image' as const, data: img.data, mimeType: 'image/png' });
        }
      } else {
        blocks.push({
          type: 'text' as const,
          text: `Downloaded ${displayName} (${sizeKB}KB PDF) but could not extract text or render pages.`,
        });
      }
    }
  } else {
    blocks.push({
      type: 'text' as const,
      text: `Downloaded ${displayName} (${sizeKB}KB, ${mimeType}). File type not displayable inline.`,
    });
  }

  return blocks;
}
