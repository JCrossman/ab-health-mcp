/**
 * Alberta Health MCP Server — Stdio Entry Point
 *
 * Provides passthrough access to Alberta's My Health Records (MHR) portal
 * and MyChart (AHS Connect) via the Model Context Protocol (stdio transport).
 *
 * For HTTP transport (multi-user web portal), see src/server/http-index.ts.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils/logger.js';
import { createMcpServer } from './server/create-server.js';

const server = createMcpServer();

async function main(): Promise<void> {
  logger.info('Starting Alberta Health MCP server (MHR + MyChart)...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server running on stdio');
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(`Server failed to start: ${error}`);
  process.exit(1);
});
