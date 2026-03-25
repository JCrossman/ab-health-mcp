"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

const STORAGE_KEY = "ab-health-conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

export function loadMessages(conversationId: string): Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`ab-health-msgs-${conversationId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMessages(conversationId: string, messages: Array<{ id: string; role: string; parts: unknown[] }>) {
  if (typeof window === "undefined") return;
  // Only save text parts (skip tool invocations for storage efficiency)
  const simplified = messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: (m.parts as Array<{ type: string; text?: string }>).filter((p) => p.type === "text" && p.text),
  }));
  localStorage.setItem(`ab-health-msgs-${conversationId}`, JSON.stringify(simplified));
}

function deleteMessages(conversationId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`ab-health-msgs-${conversationId}`);
}

interface ConversationSidebarProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onUpdateTitle: (id: string, title: string, preview: string) => void;
}

export function ConversationSidebar({ currentId, onSelect, onNew }: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, currentId]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = loadConversations().filter((c) => c.id !== id);
    saveConversations(updated);
    deleteMessages(id);
    setConversations(updated);
    if (currentId === id) {
      onNew();
    }
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r bg-muted/30 flex flex-col items-center py-3 gap-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Expand sidebar">
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNew} title="New chat">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
      <div className="p-3 flex items-center justify-between border-b">
        <Button variant="ghost" size="sm" onClick={onNew} className="gap-1 flex-1 justify-start">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-8 w-8">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            No conversations yet. Start a new chat!
          </p>
        )}
        {conversations.map((convo) => (
          <div
            key={convo.id}
            onClick={() => onSelect(convo.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(convo.id); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 group cursor-pointer ${
              currentId === convo.id ? "bg-muted" : ""
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-xs">{convo.title}</p>
              <p className="truncate text-xs text-muted-foreground">{convo.preview}</p>
            </div>
            <button
              onClick={(e) => handleDelete(convo.id, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function createConversation(title?: string): Conversation {
  const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const convo: Conversation = {
    id,
    title: title || "New Chat",
    createdAt: now,
    updatedAt: now,
    preview: "",
  };
  const existing = loadConversations();
  saveConversations([convo, ...existing]);
  return convo;
}

export function updateConversation(id: string, title: string, preview: string) {
  const convos = loadConversations();
  const idx = convos.findIndex((c) => c.id === id);
  if (idx >= 0) {
    convos[idx].title = title;
    convos[idx].preview = preview;
    convos[idx].updatedAt = new Date().toISOString();
    saveConversations(convos);
  }
}
