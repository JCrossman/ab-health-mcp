"use client";

import { useState, useSyncExternalStore } from "react";
import { Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MemoryHistory } from "@/lib/chat/memory-history";

interface ConversationSidebarProps {
  history: MemoryHistory;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onUpdateTitle: (id: string, title: string, preview: string) => void;
}

export function ConversationSidebar({ history, currentId, onSelect, onNew }: ConversationSidebarProps) {
  useSyncExternalStore(history.subscribe, history.getRevision, history.getRevision);
  const conversations = history.list();
  const [collapsed, setCollapsed] = useState(false);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    history.delete(id);
    if (currentId === id) {
      onNew();
    }
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r bg-muted/30 flex flex-col items-center py-3 gap-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Expand sidebar">
          <PanelLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNew} aria-label="New chat">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
      <div className="p-3 flex items-center justify-between border-b">
        <Button variant="ghost" size="sm" onClick={onNew} className="gap-1 flex-1 justify-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Chat
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-8 w-8" aria-label="Collapse sidebar">
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
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
            aria-label={`Open conversation: ${convo.title}`}
            aria-current={currentId === convo.id ? "true" : undefined}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
              currentId === convo.id ? "bg-muted" : ""
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-xs">{convo.title}</p>
              <p className="truncate text-xs text-muted-foreground">{convo.preview}</p>
            </div>
            <button
              onClick={(e) => handleDelete(convo.id, e)}
              aria-label={`Delete conversation: ${convo.title}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
