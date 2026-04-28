"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  Key,
  Check,
  Trash2,
  Loader2,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Provider {
  id: string;
  name: string;
  description: string;
  canadianHosted: boolean;
  models: string[];
  keyPlaceholder: string;
  keyPrefix?: string;
  baseUrlConfigurable?: boolean;
  configured: boolean;
  baseUrl?: string;
}

export default function ApiKeysPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated") {
      fetchProviders();
    }
  }, [authStatus, router, fetchProviders]);

  const handleSave = async (providerId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          apiKey: keyInput,
          baseUrl: baseUrlInput || undefined,
        }),
      });
      if (res.ok) {
        setEditingProvider(null);
        setKeyInput("");
        setBaseUrlInput("");
        setShowKey(false);
        await fetchProviders();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleRemove = async (providerId: string) => {
    try {
      await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      await fetchProviders();
    } catch { /* ignore */ }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <span className="font-semibold">AI Keys</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            AI Service Keys
          </h1>
          <p className="text-muted-foreground">
            Add your own AI service keys to choose which AI model you use.
            Keys are saved securely and hidden after saving.
          </p>
        </section>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">
              Data residency notice
            </p>
            <p className="text-amber-700">
              When you use an AI service hosted outside Canada, your health data
              will be processed outside Canada. Look for the 🇨🇦 badge for
              Canadian-hosted options.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider.id} className="border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{provider.name}</h3>
                  {provider.canadianHosted && (
                    <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                      <Shield className="h-3 w-3" />
                      🇨🇦 Canadian
                    </Badge>
                  )}
                  {provider.configured && (
                    <Badge className="gap-1 bg-green-600">
                      <Check className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                </div>
                {provider.configured && editingProvider !== provider.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(provider.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{provider.description}</p>

              <div className="text-xs text-muted-foreground">
                Models: {provider.models.join(", ")}
              </div>

              {editingProvider === provider.id ? (
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={provider.keyPlaceholder}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {provider.baseUrlConfigurable && (
                    <Input
                      type="url"
                      placeholder={
                        provider.id === "ollama"
                          ? "http://localhost:11434"
                          : "https://your-resource.openai.azure.com"
                      }
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                    />
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(provider.id)}
                      disabled={saving || (provider.id !== "ollama" && !keyInput)}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingProvider(null);
                        setKeyInput("");
                        setBaseUrlInput("");
                        setShowKey(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                !provider.configured && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProvider(provider.id)}
                  >
                    <Key className="h-4 w-4 mr-1" />
                    Add Key
                  </Button>
                )
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
