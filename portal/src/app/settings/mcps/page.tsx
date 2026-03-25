"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  Plug,
  Check,
  Plus,
  Loader2,
  AlertTriangle,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface McpServer {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  curated: boolean;
  requiresAuth: boolean;
  authType?: string;
  canadianHosted?: boolean;
  toolCount?: number;
  iconEmoji: string;
  enabled: boolean;
}

export default function McpSettingsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [mcps, setMcps] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchMcps = useCallback(async () => {
    try {
      const res = await fetch("/api/mcps");
      if (res.ok) {
        const data = await res.json();
        setMcps(data.mcps);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated") {
      fetchMcps();
    }
  }, [authStatus, router, fetchMcps]);

  const toggleMcp = async (serverId: string, enable: boolean) => {
    setToggling(serverId);
    try {
      await fetch("/api/mcps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enable ? "enable" : "disable",
          serverId,
        }),
      });
      await fetchMcps();
    } catch { /* ignore */ }
    setToggling(null);
  };

  const addCustom = async () => {
    if (!customName || !customUrl) return;
    try {
      await fetch("/api/mcps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-custom",
          name: customName,
          url: customUrl,
          apiKey: customKey || undefined,
        }),
      });
      setShowAddCustom(false);
      setCustomName("");
      setCustomUrl("");
      setCustomKey("");
      await fetchMcps();
    } catch { /* ignore */ }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = [
    { key: "health", label: "Health Data" },
    { key: "research", label: "Research" },
    { key: "reference", label: "Reference" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto flex h-14 items-center px-4 gap-4">
          <Link
            href="/chat"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">MCP Servers</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6" />
            MCP Server Marketplace
          </h1>
          <p className="text-muted-foreground">
            Enable additional data sources to enrich your health conversations.
            The AI can query enabled MCPs alongside your health records.
          </p>
        </section>

        {categories.map((cat) => {
          const catMcps = mcps.filter((m) => m.category === cat.key);
          if (catMcps.length === 0) return null;
          return (
            <section key={cat.key} className="space-y-3">
              <h2 className="text-lg font-semibold">{cat.label}</h2>
              <div className="space-y-3">
                {catMcps.map((mcp) => (
                  <div
                    key={mcp.id}
                    className={`border rounded-xl p-5 space-y-2 ${
                      mcp.enabled ? "border-primary/30 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{mcp.iconEmoji}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{mcp.name}</h3>
                            {mcp.curated && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                                <Shield className="h-2.5 w-2.5" />
                                Curated
                              </Badge>
                            )}
                            {mcp.canadianHosted && (
                              <span className="text-xs">🇨🇦</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{mcp.description}</p>
                        </div>
                      </div>
                      {mcp.id === "ab-health" ? (
                        <Badge className="bg-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Always On
                        </Badge>
                      ) : (
                        <Button
                          variant={mcp.enabled ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleMcp(mcp.id, !mcp.enabled)}
                          disabled={toggling === mcp.id || !mcp.url}
                        >
                          {toggling === mcp.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : mcp.enabled ? (
                            "Disable"
                          ) : !mcp.url ? (
                            "Coming Soon"
                          ) : (
                            "Enable"
                          )}
                        </Button>
                      )}
                    </div>
                    {mcp.toolCount && (
                      <div className="text-xs text-muted-foreground">
                        {mcp.toolCount} tools available
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Add Custom MCP */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Custom MCP Servers</h2>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-700 dark:text-amber-300">
              Custom MCPs can access your health data when enabled. Only add
              servers you trust.
            </p>
          </div>

          {showAddCustom ? (
            <div className="border rounded-xl p-5 space-y-3">
              <Input
                placeholder="Server name (e.g., My Drug Database)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <Input
                type="url"
                placeholder="Server URL (e.g., https://my-mcp.example.com/mcp)"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
              <Input
                type="password"
                placeholder="API key (optional)"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addCustom} disabled={!customName || !customUrl}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Server
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddCustom(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddCustom(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Custom MCP Server
            </Button>
          )}
        </section>

        <section className="text-center text-sm text-muted-foreground py-4">
          <p>
            MCPs follow the{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Model Context Protocol <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
