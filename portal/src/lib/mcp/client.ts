/**
 * MCP Client for connecting to the Alberta Health MCP server.
 *
 * Establishes a connection to the MCP HTTP server and provides
 * methods to call health data tools.
 *
 * Used by the chat API route to invoke MCP tools when the AI
 * decides to fetch health data.
 */

const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "http://localhost:3001/mcp";

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/**
 * Call an MCP tool on the health MCP server.
 *
 * Uses the MCP Streamable HTTP transport to send JSON-RPC requests.
 * Each call creates a new session if no session ID is provided.
 */
export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
  sessionId?: string,
  serverUrl?: string
): Promise<{ result: McpToolResult; sessionId?: string }> {
  const url = serverUrl || MCP_SERVER_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  // JSON-RPC request to call a tool
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `MCP server error: ${response.status} ${response.statusText}`
    );
  }

  const newSessionId =
    response.headers.get("mcp-session-id") || sessionId;

  // Handle SSE or JSON response
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE response
    const text = await response.text();
    const lines = text.split("\n");
    let result: McpToolResult | null = null;

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.result) {
            result = data.result;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    if (!result) {
      throw new Error("No result received from MCP server");
    }

    return { result, sessionId: newSessionId };
  }

  // JSON response
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "MCP tool call failed");
  }

  return { result: data.result, sessionId: newSessionId };
}

/**
 * Initialize MCP session (sends initialize + initialized).
 * Required before making tool calls on a new session.
 */
export async function initMcpSession(serverUrl?: string): Promise<string | undefined> {
  const url = serverUrl || MCP_SERVER_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const initBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ab-health-portal", version: "1.0.0" },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(initBody),
  });

  if (!response.ok) {
    throw new Error(`MCP init failed: ${response.status}`);
  }

  const sessionId = response.headers.get("mcp-session-id") || undefined;

  // Send initialized notification
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  return sessionId;
}

/**
 * List available MCP tools.
 */
export async function listMcpTools(
  sessionId?: string,
  serverUrl?: string
): Promise<{ tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>; sessionId?: string }> {
  const url = serverUrl || MCP_SERVER_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/list",
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP list tools failed: ${response.status}`);
  }

  const newSessionId = response.headers.get("mcp-session-id") || sessionId;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.result?.tools) {
            return { tools: data.result.tools, sessionId: newSessionId };
          }
        } catch {
          // Skip
        }
      }
    }
    return { tools: [], sessionId: newSessionId };
  }

  const data = await response.json();
  return { tools: data.result?.tools || [], sessionId: newSessionId };
}
