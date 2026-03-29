"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Loader2, Activity, Settings, Unplug, Plug, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectDialog } from "@/components/health/connect-dialog";
import { MessageContent } from "@/components/chat/message-content";
import {
  ConversationSidebar,
  createConversation,
  updateConversation,
  loadMessages,
  saveMessages,
} from "@/components/chat/conversation-sidebar";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface HealthStatus {
  connected: boolean;
  mhr: boolean;
  myChart: boolean;
  message?: string;
}

interface AvailableModel {
  providerId: string;
  providerName: string;
  modelId: string;
  canadianHosted: boolean;
  isDefault?: boolean;
}

export default function ChatPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const [conversationId, setConversationId] = useState<string | null>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ model: selectedModelRef.current }),
      })
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({ transport });

  const [input, setInput] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    connected: false, mhr: false, myChart: false,
  });
  const [showConnect, setShowConnect] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  const checkHealthStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/health/status");
      if (res.ok) {
        setHealthStatus(await res.json());
      }
    } catch { /* MCP server not available */ }
  }, []);

  const handleDisconnect = async () => {
    try {
      await fetch("/api/health/disconnect", { method: "POST" });
      setHealthStatus({ connected: false, mhr: false, myChart: false });
    } catch { /* ignore */ }
  };

  // Poll health status every 30s
  useEffect(() => {
    checkHealthStatus();
    const interval = setInterval(checkHealthStatus, 30000);
    return () => clearInterval(interval);
  }, [checkHealthStatus]);

  // Fetch available models (re-fetch when window regains focus, e.g. returning from settings)
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data.models);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchModels();
    const onFocus = () => fetchModels();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchModels]);

  // Close model picker on outside click; re-fetch models on open
  useEffect(() => {
    if (!showModelPicker) return;
    fetchModels();
    const handleClick = () => setShowModelPicker(false);
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [showModelPicker, fetchModels]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (conversationId && messages.length > 0 && status === "ready") {
      saveMessages(conversationId, messages);
      // Update conversation title from first user message
      const firstUserMsg = messages.find((m) => m.role === "user");
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      if (firstUserMsg) {
        const title = (firstUserMsg.parts.find((p: { type: string; text?: string }) => p.type === "text") as { text: string } | undefined)?.text?.slice(0, 60) || "Chat";
        const preview = (lastAssistantMsg?.parts.find((p: { type: string; text?: string }) => p.type === "text") as { text: string } | undefined)?.text?.slice(0, 80) || "";
        updateConversation(conversationId, title, preview);
      }
    }
  }, [messages, conversationId, status]);

  const handleNewChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, [setMessages]);

  const handleSelectConversation = useCallback((id: string) => {
    setConversationId(id);
    const saved = loadMessages(id);
    setMessages(saved as typeof messages);
  }, [setMessages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    // Auto-create conversation on first message
    if (!conversationId) {
      const convo = createConversation(text.slice(0, 60));
      setConversationId(convo.id);
    }
    sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Conversation Sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <ConversationSidebar
          currentId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onUpdateTitle={() => {}}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Chat Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="max-w-4xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold">Alberta Health Portal</span>
            </Link>
            {healthStatus.connected ? (
              <Badge
                variant="default"
                className="gap-1 cursor-pointer"
                onClick={handleDisconnect}
                title="Click to disconnect"
              >
                <Plug className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => setShowConnect(true)}
                title="Click to connect your health account"
              >
                <Unplug className="h-3 w-3" />
                Connect
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
                title="Select AI model"
              >
                <span className="max-w-[120px] truncate">{selectedModel}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-background border rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
                  {availableModels.map((m) => (
                    <button
                      key={`${m.providerId}:${m.modelId}`}
                      onClick={() => {
                        setSelectedModel(m.modelId);
                        setShowModelPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                        selectedModel === m.modelId ? "bg-muted" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">{m.modelId}</div>
                        <div className="text-xs text-muted-foreground">{m.providerName}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {m.canadianHosted && <span className="text-xs">🇨🇦</span>}
                        {m.isDefault && <Badge variant="outline" className="text-[10px] px-1 py-0">Default</Badge>}
                      </div>
                    </button>
                  ))}
                  {availableModels.length <= 1 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      <Link href="/settings/keys" className="text-primary hover:underline">
                        Add API keys
                      </Link>{" "}
                      to unlock more models
                    </div>
                  )}
                </div>
              )}
            </div>
            <Link href="/settings/keys">
              <Button variant="ghost" size="icon" title="API Keys">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/settings/mcps">
              <Button variant="ghost" size="icon" title="MCP Servers">
                <Plug className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-4">
              <Activity className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-2xl font-semibold">
                Welcome to Alberta Health Portal
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {healthStatus.connected
                  ? "Your health account is connected. Ask me anything about your records."
                  : "Connect your health account to get started, or just chat with the AI."}
              </p>
              {!healthStatus.connected && (
                <Button
                  size="lg"
                  onClick={() => setShowConnect(true)}
                  className="mt-2"
                >
                  Connect Health Account
                </Button>
              )}
              <div className="flex flex-wrap gap-2 justify-center pt-4">
                {[
                  "Show me my recent lab results",
                  "What medications am I on?",
                  "Am I up to date on vaccines?",
                  "Give me a health overview",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-4">
                ⚠️ Not medical advice. Always consult your healthcare provider.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              {message.parts.map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <div
                      key={i}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        {message.role === "user" ? (
                          part.text
                        ) : (
                          <MessageContent content={part.text} />
                        )}
                      </div>
                    </div>
                  );
                }
                if (part.type.startsWith("tool-")) {
                  const toolPart = part as { type: string; toolCallId: string; state: string };
                  const toolName = part.type.replace("tool-", "");
                  const isMcTool = toolName.startsWith("mc_");
                  const source = isMcTool ? "AHS MyChart" : "My Health Records";
                  const displayName = toolName
                    .replace(/^mc_/, "")
                    .replace(/^get_/, "")
                    .replace(/_/g, " ");

                  return (
                    <div key={i} className="flex justify-start">
                      <div className="bg-muted/50 border rounded-lg px-3 py-2 text-xs text-muted-foreground max-w-[85%]">
                        {(toolPart.state === "call" || toolPart.state === "input-available" || toolPart.state === "input-streaming") && (
                          <>
                            <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                            <span>Fetching {displayName} from {source}...</span>
                          </>
                        )}
                        {toolPart.state === "output-available" && (
                          <span>✓ Loaded {displayName} from {source}</span>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm max-w-md space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {error.message?.includes("API Key") || error.message?.includes("provider configured")
                    ? "No AI provider configured"
                    : "Something went wrong"}
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  {error.message?.includes("API Key") || error.message?.includes("provider configured")
                    ? "Add an API key in Settings to start chatting."
                    : error.message || "Please try again."}
                </p>
                {(error.message?.includes("API Key") || error.message?.includes("provider configured")) && (
                  <Link href="/settings/keys">
                    <Button size="sm" variant="outline" className="mt-1">
                      <Settings className="h-3 w-3 mr-1" />
                      Go to API Keys
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your health records..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
              style={{ height: "auto", minHeight: "40px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            AI-powered health record assistant. Not medical advice.
          </p>
        </div>
      </div>

      {/* End Main Chat Area */}
      </div>

      <ConnectDialog
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onConnected={checkHealthStatus}
      />
    </div>
  );
}
