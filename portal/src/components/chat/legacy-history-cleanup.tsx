"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { removeLegacyHistory } from "@/lib/chat/legacy-history";

export function LegacyHistoryCleanup() {
  const [notice, setNotice] = useState("");
  const remove = () => {
    try {
      removeLegacyHistory(window.localStorage);
      setNotice("Old MyAI Health web-chat history was removed from this browser. Claude Desktop and other sites were not changed.");
    } catch {
      setNotice("This browser blocked access to its saved data. Old history may remain. No other browser data was changed.");
    }
  };
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold">Old web-chat history on this browser</h2>
    <p className="text-muted-foreground">
      Earlier versions may have saved chats on this browser without an account owner.
      We do not open or import those chats. You can remove only that old MyAI Health
      web-chat data below. This cannot be undone.
    </p>
    <p className="text-muted-foreground">
      This does not remove Claude Desktop history, other browser data, Alberta records,
      or any provider&apos;s copies. Nothing is removed unless you choose this button.
    </p>
    <Button variant="outline" onClick={remove}>Remove old web-chat history</Button>
    <p role="status" aria-live="polite" className="text-sm">{notice}</p>
  </section>;
}
