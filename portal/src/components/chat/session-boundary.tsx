"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { getSession, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { MemoryHistory } from "@/lib/chat/memory-history";
import { bindChatSession } from "@/lib/chat/session-lifecycle";

type Workspace = ComponentType<{ history: MemoryHistory; endSession: () => void }>;

export function ChatSessionBoundary({ workspace: Workspace }: { workspace: Workspace }) {
  const { data: session, status } = useSession();
  const owner = status === "authenticated" ? session?.user?.id : undefined;
  // Changing accounts unmounts all state, including the AI SDK's stream and pending input.
  return owner ? <VerifiedSession key={owner} owner={owner} workspace={Workspace} /> : <SessionNotice />;
}

function SessionNotice() {
  return <main id="main-content" className="max-w-xl mx-auto p-6 space-y-3">
    <h1 className="text-xl font-semibold">Chat cleared</h1>
    <p role="status">For your privacy, chats are cleared when you leave this tab or your sign-in changes.</p>
    <Link href="/login" className="text-primary underline focus-visible:ring-2 focus-visible:ring-ring rounded">Sign in to start a new chat</Link>
  </main>;
}

function VerifiedSession({ owner, workspace: Workspace }: {
  owner: string;
  workspace: Workspace;
}) {
  const [history, setHistory] = useState<MemoryHistory | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const lifecycle = useRef<ReturnType<typeof bindChatSession> | null>(null);

  useEffect(() => {
    const binding = bindChatSession({
      owner, getSession, browser: window, page: document,
      onHistory: setHistory,
      // Hide synchronously before a page can enter the back/forward cache.
      onClear: () => { if (content.current) content.current.hidden = true; },
    });
    lifecycle.current = binding;
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("ab-health-session-reset");
      channel.current.onmessage = () => binding.endSession();
    }
    return () => {
      binding.dispose();
      lifecycle.current = null;
      channel.current?.close();
      channel.current = null;
    };
  }, [owner]);

  const endSession = () => {
    lifecycle.current?.endSession();
    channel.current?.postMessage("clear");
    void signOut({ callbackUrl: "/" });
  };

  return history?.isActive()
    ? <div key={history.id} ref={content}><Workspace history={history} endSession={endSession} /></div>
    : <SessionNotice />;
}
