"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { Send, Loader2, Activity, Settings, Unplug, Plug, LogOut, ChevronDown, FlaskConical, Syringe, Pill, Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { BrandLogo, BrandName } from "@/components/ui/brand";
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
  const [betaMode, setBetaMode] = useState(true); // default true until /api/models responds
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Re-auth state for graceful session-expiry recovery
  type ReauthState = "idle" | "needed" | "loading" | "error";
  const [reauthState, setReauthState] = useState<ReauthState>("idle");
  const [reauthMsgId, setReauthMsgId] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState("");
  // Tracks the highest message index already handled for session-expiry detection,
  // preventing re-detection of old messages after a successful re-auth.
  const lastHandledReauthIndex = useRef(-1);
  // Caps auto-retry at 1 per reauth cycle to prevent infinite loops.
  const reauthAutoRetryDone = useRef(false);

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

  // Detect session_expired marker in tool results and trigger inline re-auth prompt.
  // Only fires for messages beyond lastHandledReauthIndex to avoid re-triggering
  // after a successful re-auth when old expired messages are still in the array.
  useEffect(() => {
    if (reauthState === "loading") return;

    for (let i = 0; i < messages.length; i++) {
      if (i <= lastHandledReauthIndex.current) continue;
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (!part.type.startsWith("tool-")) continue;
        const tp = part as { type: string; state: string; result?: unknown };
        if (tp.state !== "output-available") continue;
        try {
          const r = typeof tp.result === "string" ? JSON.parse(tp.result) : tp.result;
          if (r?.session_expired === true) {
            lastHandledReauthIndex.current = i;
            setReauthMsgId(msg.id);
            setReauthState("needed");
            return;
          }
        } catch { /* ignore malformed tool results */ }
      }
    }
  }, [messages, reauthState]);

  const handleReauth = async () => {
    setReauthState("loading");
    try {
      const res = await fetch("/api/health/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!data.connected) throw new Error(data.message || "Connection failed");
      await checkHealthStatus();
      const shouldAutoRetry = !reauthAutoRetryDone.current && lastUserMessage;
      reauthAutoRetryDone.current = true;
      setReauthState("idle");
      setReauthMsgId(null);
      if (shouldAutoRetry) {
        sendMessage({ text: lastUserMessage });
      }
    } catch {
      setReauthState("error");
    }
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
        setBetaMode(!!data.betaMode);
        // In beta mode, set model to the single deployment name
        if (data.betaMode && data.models.length > 0) {
          setSelectedModel(data.models[0].modelId);
        }
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
    setReauthState("idle");
    setReauthMsgId(null);
    lastHandledReauthIndex.current = -1;
    reauthAutoRetryDone.current = false;
  }, [setMessages]);

  const handleSelectConversation = useCallback((id: string) => {
    setConversationId(id);
    const saved = loadMessages(id);
    setMessages(saved as typeof messages);
    setReauthState("idle");
    setReauthMsgId(null);
    lastHandledReauthIndex.current = -1;
    reauthAutoRetryDone.current = false;
  }, [setMessages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    setLastUserMessage(text);
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
      <div className="flex items-center justify-center h-screen" aria-busy="true" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Conversation Sidebar — desktop: always visible; mobile: slide-over */}
      <div className="hidden md:flex">
        <ConversationSidebar
          currentId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onUpdateTitle={() => {}}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl"
            aria-label="Conversations"
          >
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-sm">Conversations</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <ConversationSidebar
              currentId={conversationId}
              onSelect={(id) => {
                handleSelectConversation(id);
                setMobileSidebarOpen(false);
              }}
              onNew={() => {
                handleNewChat();
                setMobileSidebarOpen(false);
              }}
              onUpdateTitle={() => {}}
            />
          </nav>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Chat Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="max-w-4xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open conversations"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <BrandName className="text-base hidden sm:inline" />
            </Link>
            {healthStatus.connected ? (
              <button
                onClick={handleDisconnect}
                aria-label="Health account connected. Click to disconnect."
                className={badgeVariants({ variant: "default" }) + " gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"}
              >
                <Plug className="h-3 w-3" aria-hidden="true" />
                Connected
              </button>
            ) : (
              <button
                onClick={() => setShowConnect(true)}
                aria-label="Health account not connected. Click to connect."
                className={badgeVariants({ variant: "outline" }) + " gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"}
              >
                <Unplug className="h-3 w-3" aria-hidden="true" />
                Connect
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Model Selector — hidden in beta-azure-ca mode; single Azure OpenAI CA East deployment */}
            {!betaMode && (
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                aria-haspopup="listbox"
                aria-expanded={showModelPicker}
                aria-label={`Selected model: ${selectedModel}. Click to change.`}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="max-w-[120px] truncate" aria-hidden="true">{selectedModel}</span>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
              {showModelPicker && (
                <div role="listbox" aria-label="AI model" className="absolute right-0 top-full mt-1 w-72 bg-background border rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
                  {availableModels.map((m) => (
                    <button
                      key={`${m.providerId}:${m.modelId}`}
                      role="option"
                      aria-selected={selectedModel === m.modelId}
                      onClick={() => {
                        setSelectedModel(m.modelId);
                        setShowModelPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedModel === m.modelId ? "bg-muted" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">{m.modelId}</div>
                        <div className="text-xs text-muted-foreground">{m.providerName}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {m.canadianHosted && <span className="text-xs" aria-label="Canadian hosted">🇨🇦</span>}
                        {m.isDefault && <Badge variant="outline" className="text-[10px] px-1 py-0">Default</Badge>}
                      </div>
                    </button>
                  ))}
                  {availableModels.length <= 1 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      <Link href="/settings/keys" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                        Add API keys
                      </Link>{" "}
                      to unlock more models
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
            <Link href="/settings/keys">
              <Button variant="ghost" size="icon" aria-label="AI Keys settings">
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/settings/mcps">
              <Button variant="ghost" size="icon" aria-label="Data Sources settings">
                <Plug className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main id="main-content" className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-4">
              <Activity className="h-12 w-12 text-[#0277b5] mx-auto" aria-hidden="true" />
              <h1 className="text-2xl font-semibold">
                Welcome to MyAI Health
              </h1>
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
              
              {healthStatus.connected && (
                <div className="space-y-3 pt-4">
                  <p className="text-sm font-medium text-muted-foreground" id="starter-prompts-label">Try one of these to get started:</p>
                  <div className="flex flex-wrap gap-2 justify-center" role="group" aria-labelledby="starter-prompts-label">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setInput("Show my latest lab results")}
                    >
                      <FlaskConical className="h-4 w-4 mr-2" aria-hidden="true" />
                      Show my latest lab results
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setInput("When was my last tetanus shot?")}
                    >
                      <Syringe className="h-4 w-4 mr-2" aria-hidden="true" />
                      When was my last tetanus shot?
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setInput("List my current medications")}
                    >
                      <Pill className="h-4 w-4 mr-2" aria-hidden="true" />
                      List my current medications
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center pt-4" role="group" aria-label="Suggested questions">
                {[
                  "Show me my recent lab results",
                  "What medications am I on?",
                  "Am I up to date on vaccines?",
                  "Give me a health overview",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <div key={i} className="flex justify-start" aria-live="polite" aria-atomic="true">
                      <div className="bg-muted/50 border rounded-lg px-3 py-2 text-xs text-muted-foreground max-w-[85%]">
                        {(toolPart.state === "call" || toolPart.state === "input-available" || toolPart.state === "input-streaming") && (
                          <>
                            <Loader2 className="inline h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                            <span>Fetching {displayName} from {source}…</span>
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

              {/* Inline re-auth prompt — shown after the assistant message that triggered a session expiry */}
              {reauthMsgId === message.id && message.role === "assistant" && (
                <div aria-live="polite" className="flex justify-start">
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm max-w-[85%] space-y-2">
                    {reauthState === "needed" && (
                      <>
                        <p className="text-amber-800 dark:text-amber-200 font-medium">
                          Your sign-in has timed out.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleReauth}
                          className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <Shield className="h-3 w-3 mr-1.5" />
                          Sign in again
                        </Button>
                      </>
                    )}
                    {reauthState === "loading" && (
                      <p className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        Signing you in…
                      </p>
                    )}
                    {reauthState === "error" && (
                      <>
                        <p className="text-amber-800 dark:text-amber-200 font-medium">
                          Couldn&apos;t sign you in.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleReauth}
                            className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            Try again
                          </Button>
                          <a
                            href="."
                            className="text-xs text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:no-underline"
                          >
                            Refresh the page
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex justify-start" aria-live="polite" aria-label="Assistant is thinking">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              </div>
            </div>
          )}

          {/* Screen reader announcements for streaming state changes */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {status === "submitted" && "Assistant is thinking…"}
            {status === "streaming" && "Assistant is responding…"}
            {status === "ready" && messages.length > 0 && "Response complete."}
          </div>

          {error && (
            <div className="flex justify-center">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm max-w-md space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {error.message?.includes("API Key") || error.message?.includes("provider configured")
                    ? "No AI service set up"
                    : "Something went wrong"}
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  {error.message?.includes("API Key") || error.message?.includes("provider configured")
                    ? "Add an AI key in Settings to start chatting."
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
      </main>

      {/* Input Area */}
      <div className="border-t bg-background shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your health records…"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
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
              aria-label={isLoading ? "Sending…" : "Send message"}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
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
