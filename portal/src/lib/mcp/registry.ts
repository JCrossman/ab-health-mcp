/**
 * MCP server registry — curated + custom MCP servers.
 *
 * Curated MCPs are vetted health-related servers that enhance
 * the AI's ability to provide contextual health information.
 *
 * Custom MCPs allow advanced users to add their own MCP servers.
 */

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  category: "health" | "research" | "reference" | "custom";
  url: string;
  transport: "stdio" | "http";
  curated: boolean;
  requiresAuth: boolean;
  authType?: "api-key" | "oauth" | "none";
  canadianHosted?: boolean;
  toolCount?: number;
  iconEmoji: string;
}

export const CURATED_MCPS: McpServerConfig[] = [
  {
    id: "ab-health",
    name: "Alberta Health Records",
    description: "Access My Health Records and AHS MyChart data (lab results, medications, immunizations, vitals, imaging, visits)",
    category: "health",
    url: "http://localhost:3001/mcp",
    transport: "http",
    curated: true,
    requiresAuth: true,
    authType: "none",
    canadianHosted: true,
    toolCount: 44,
    iconEmoji: "🏥",
  },
  {
    id: "pubmed",
    name: "PubMed",
    description: "Search medical literature, clinical trials, and research papers from the National Library of Medicine",
    category: "research",
    url: "",
    transport: "http",
    curated: true,
    requiresAuth: false,
    authType: "none",
    toolCount: 4,
    iconEmoji: "📚",
  },
  {
    id: "drug-interactions",
    name: "Drug Interaction Checker",
    description: "Check for drug-drug interactions, contraindications, and side effects using DrugBank/RxNorm data",
    category: "reference",
    url: "",
    transport: "http",
    curated: true,
    requiresAuth: true,
    authType: "api-key",
    toolCount: 3,
    iconEmoji: "💊",
  },
  {
    id: "lab-reference",
    name: "Lab Reference Ranges",
    description: "Look up normal reference ranges for lab tests, with age and sex adjustments",
    category: "reference",
    url: "",
    transport: "http",
    curated: true,
    requiresAuth: false,
    authType: "none",
    toolCount: 2,
    iconEmoji: "🔬",
  },
  {
    id: "drug-info",
    name: "Drug Information",
    description: "Detailed drug information including dosing, side effects, warnings, and patient education materials",
    category: "reference",
    url: "",
    transport: "http",
    curated: true,
    requiresAuth: true,
    authType: "api-key",
    toolCount: 5,
    iconEmoji: "📋",
  },
  {
    id: "health-canada",
    name: "Health Canada Advisories",
    description: "Drug recalls, safety alerts, and health advisories from Health Canada",
    category: "health",
    url: "",
    transport: "http",
    curated: true,
    requiresAuth: false,
    authType: "none",
    canadianHosted: true,
    toolCount: 3,
    iconEmoji: "🍁",
  },
];

interface UserMcpConfig {
  serverId: string;
  enabled: boolean;
  apiKey?: string;
  customUrl?: string;
  addedAt: string;
}

// In-memory store (per user)
const userMcpConfigs = new Map<string, Map<string, UserMcpConfig>>();

export function enableMcp(userId: string, serverId: string, apiKey?: string, customUrl?: string): void {
  if (!userMcpConfigs.has(userId)) {
    userMcpConfigs.set(userId, new Map());
  }
  userMcpConfigs.get(userId)!.set(serverId, {
    serverId,
    enabled: true,
    apiKey,
    customUrl,
    addedAt: new Date().toISOString(),
  });
}

export function disableMcp(userId: string, serverId: string): void {
  const configs = userMcpConfigs.get(userId);
  if (configs) {
    configs.delete(serverId);
  }
}

export function getUserMcps(userId: string): Array<McpServerConfig & { enabled: boolean }> {
  const configs = userMcpConfigs.get(userId);

  // Alberta Health is always enabled by default
  const result = CURATED_MCPS.map((mcp) => ({
    ...mcp,
    enabled: mcp.id === "ab-health" || !!configs?.get(mcp.id)?.enabled,
  }));

  // Add custom MCPs
  if (configs) {
    for (const [, config] of configs) {
      if (!CURATED_MCPS.find((m) => m.id === config.serverId) && config.customUrl) {
        result.push({
          id: config.serverId,
          name: config.serverId,
          description: `Custom MCP server at ${config.customUrl}`,
          category: "custom",
          url: config.customUrl,
          transport: "http",
          curated: false,
          requiresAuth: !!config.apiKey,
          authType: config.apiKey ? "api-key" : "none",
          toolCount: undefined,
          iconEmoji: "🔌",
          enabled: config.enabled,
        });
      }
    }
  }

  return result;
}

export function addCustomMcp(
  userId: string,
  name: string,
  url: string,
  apiKey?: string
): void {
  const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  enableMcp(userId, id, apiKey, url);
}
