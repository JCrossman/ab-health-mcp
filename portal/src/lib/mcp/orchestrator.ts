/**
 * MCP Orchestrator — manages connections to multiple MCP servers per user.
 *
 * Discovers tools from enabled MCP servers and exposes them as AI SDK tools
 * with namespaced tool names to prevent conflicts between servers.
 */

import { tool } from "ai";
import { z } from "zod";
import { getUserMcps, type McpServerConfig } from "./registry";
import { callMcpTool, initMcpSession, listMcpTools } from "./client";

interface McpConnection {
  url: string;
  sessionId?: string;
  tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
  connectedAt: number;
  lastUsed: number;
}

// Per-user MCP connections: userId -> serverId -> connection
const connections = new Map<string, Map<string, McpConnection>>();

// Connection TTL: 30 minutes
const CONNECTION_TTL = 30 * 60 * 1000;

function getUserConnections(userId: string): Map<string, McpConnection> {
  if (!connections.has(userId)) {
    connections.set(userId, new Map());
  }
  return connections.get(userId)!;
}

function isConnectionStale(conn: McpConnection): boolean {
  return Date.now() - conn.lastUsed > CONNECTION_TTL;
}

/**
 * Connect to an MCP server and discover its tools.
 */
async function connectToMcp(
  url: string,
  apiKey?: string
): Promise<McpConnection> {
  // Initialize session
  const sessionId = await initMcpSession(url);

  // Discover tools
  const { tools } = await listMcpTools(sessionId, url);

  return {
    url,
    sessionId,
    tools,
    connectedAt: Date.now(),
    lastUsed: Date.now(),
  };
}

/**
 * Call a tool on a specific MCP server.
 */
async function callRemoteTool(
  connection: McpConnection,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  connection.lastUsed = Date.now();

  const { result } = await callMcpTool(
    toolName,
    args,
    connection.sessionId,
    connection.url
  );

  if (result.isError) {
    const errorText =
      result.content.find(
        (c: { type: string; text?: string }) => c.type === "text"
      )?.text || "Tool call failed";
    return `Error: ${errorText}`;
  }

  return result.content
    .filter(
      (c: { type: string; text?: string }) => c.type === "text" && c.text
    )
    .map((c: { type: string; text?: string }) => c.text)
    .join("\n");
}

/**
 * Convert a JSON Schema to a Zod schema for AI SDK tools.
 * Handles basic types; complex schemas fall back to z.record.
 */
function jsonSchemaToZod(
  schema?: Record<string, unknown>
): z.ZodObject<z.ZodRawShape> {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const properties = schema.properties as Record<
    string,
    { type?: string; description?: string; enum?: string[] }
  >;
  const required = (schema.required as string[]) || [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodTypeAny;
    if (prop.enum) {
      field = z.enum(prop.enum as [string, ...string[]]);
    } else {
      switch (prop.type) {
        case "number":
        case "integer":
          field = z.number();
          break;
        case "boolean":
          field = z.boolean();
          break;
        case "array":
          field = z.array(z.unknown());
          break;
        default:
          field = z.string();
      }
    }

    if (prop.description) {
      field = field.describe(prop.description);
    }

    if (!required.includes(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape) as z.ZodObject<z.ZodRawShape>;
}

/**
 * Get all dynamically discovered tools from user's enabled MCPs.
 *
 * Returns AI SDK tool definitions that can be spread into streamText's tools.
 * Tool names are prefixed with the server ID to avoid conflicts.
 *
 * @param userId - The authenticated user ID
 * @param excludeServerIds - Server IDs to exclude (e.g., "ab-health" which has static tools)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrchestatedTools(
  userId: string,
  excludeServerIds: string[] = ["ab-health"]
): Promise<Record<string, any>> {
  const userMcps = getUserMcps(userId);
  const enabledMcps = userMcps.filter(
    (mcp) => mcp.enabled && mcp.url && !excludeServerIds.includes(mcp.id)
  );

  if (enabledMcps.length === 0) {
    return {};
  }

  const userConns = getUserConnections(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Connect to each enabled MCP in parallel
  const connectionResults = await Promise.allSettled(
    enabledMcps.map(async (mcp) => {
      let conn = userConns.get(mcp.id);

      // Reuse existing connection if fresh
      if (conn && !isConnectionStale(conn) && conn.url === mcp.url) {
        return { mcp, conn };
      }

      // Establish new connection
      try {
        conn = await connectToMcp(mcp.url);
        userConns.set(mcp.id, conn);
        return { mcp, conn };
      } catch (err) {
        console.error(
          `[MCP Orchestrator] Failed to connect to ${mcp.name} (${mcp.url}):`,
          err instanceof Error ? err.message : err
        );
        return null;
      }
    })
  );

  for (const result of connectionResults) {
    if (result.status !== "fulfilled" || !result.value) continue;

    const { mcp, conn } = result.value;
    const prefix = mcp.id.replace(/[^a-z0-9_]/g, "_");

    for (const remoteTool of conn.tools) {
      const namespacedName = `${prefix}__${remoteTool.name}`;
      const inputSchema = jsonSchemaToZod(
        remoteTool.inputSchema as Record<string, unknown> | undefined
      );

      tools[namespacedName] = tool({
        description: `[${mcp.name}] ${remoteTool.description || remoteTool.name}`,
        inputSchema,
        execute: async (args: Record<string, unknown>) =>
          callRemoteTool(conn, remoteTool.name, args),
      });
    }
  }

  return tools;
}

/**
 * Disconnect all MCP connections for a user.
 */
export function disconnectUserMcps(userId: string): void {
  connections.delete(userId);
}

/**
 * Build a system prompt supplement describing available external MCPs.
 */
export function getOrchestrationPrompt(
  userId: string,
  excludeServerIds: string[] = ["ab-health"]
): string {
  const userMcps = getUserMcps(userId);
  const enabledMcps = userMcps.filter(
    (mcp) => mcp.enabled && mcp.url && !excludeServerIds.includes(mcp.id)
  );

  if (enabledMcps.length === 0) return "";

  const userConns = getUserConnections(userId);
  const lines = ["\n\nAdditional connected services:"];

  for (const mcp of enabledMcps) {
    const conn = userConns.get(mcp.id);
    if (!conn) continue;

    lines.push(`- ${mcp.name}: ${mcp.description}`);
    if (conn.tools.length > 0) {
      const prefix = mcp.id.replace(/[^a-z0-9_]/g, "_");
      lines.push(
        `  Tools (prefixed with ${prefix}__): ${conn.tools.map((t) => t.name).join(", ")}`
      );
    }
  }

  return lines.join("\n");
}
