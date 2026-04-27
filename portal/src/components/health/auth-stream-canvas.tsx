"use client";

/**
 * Streamed cloud browser canvas for Alberta SSO authentication.
 *
 * Connects to the auth-stream SSE endpoint, renders Puppeteer's CDP
 * screencast frames on a <canvas>, and relays user mouse/keyboard
 * events back to the server via POST.
 *
 * The user sees Alberta's real login page and types directly into it.
 * Credentials go: user input → POST → CDP → Puppeteer → Alberta.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface AuthStreamCanvasProps {
  onConnected: (result: { mhr: boolean; myChart: boolean }) => void;
  onError: (message: string) => void;
  /** Signal to start the stream. */
  active: boolean;
}

type StreamState = "connecting" | "streaming" | "completing" | "done" | "error";

export function AuthStreamCanvas({
  onConnected,
  onError,
  active,
}: AuthStreamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<StreamState>("connecting");
  const [statusMessage, setStatusMessage] = useState("Launching secure browser...");
  const viewportRef = useRef({ width: 1280, height: 800 });

  // Track pending mousemove for debouncing
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postInput = useCallback(
    async (event: Record<string, unknown>) => {
      if (!sessionIdRef.current) return;
      try {
        await fetch("/api/auth-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            ...event,
          }),
        });
      } catch {
        // Fire-and-forget — transient failures are OK
      }
    },
    []
  );

  // Map canvas coordinates to Puppeteer viewport coordinates
  const mapCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(
        ((e.clientX - rect.left) / rect.width) * viewportRef.current.width
      );
      const y = Math.round(
        ((e.clientY - rect.top) / rect.height) * viewportRef.current.height
      );
      return { x, y };
    },
    []
  );

  // Start/stop the SSE stream
  useEffect(() => {
    if (!active) return;

    setState("connecting");
    setStatusMessage("Launching secure browser...");
    sessionIdRef.current = null;

    const es = new EventSource("/api/auth-stream");
    eventSourceRef.current = es;

    const img = new Image();

    es.onmessage = (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case "ready":
          sessionIdRef.current = data.sessionId as string;
          viewportRef.current = {
            width: (data.width as number) || 1280,
            height: (data.height as number) || 800,
          };
          setState("streaming");
          setStatusMessage("");
          break;

        case "frame": {
          const canvas = canvasRef.current;
          if (!canvas) break;
          const ctx = canvas.getContext("2d");
          if (!ctx) break;

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = `data:image/jpeg;base64,${data.data}`;
          break;
        }

        case "status":
          setState("completing");
          setStatusMessage(
            (data.message as string) || "Connecting to health records..."
          );
          break;

        case "done":
          setState("done");
          setStatusMessage("Connected!");
          es.close();
          onConnected({
            mhr: (data.mhr as boolean) ?? false,
            myChart: (data.myChart as boolean) ?? false,
          });
          break;

        case "error":
          setState("error");
          es.close();
          onError(
            (data.message as string) || "Authentication failed. Please try again."
          );
          break;
      }
    };

    es.onerror = () => {
      if (state !== "done" && state !== "error") {
        setState("error");
        es.close();
        onError("Connection to the login service was lost. Please try again.");
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Mouse click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (state !== "streaming") return;
      const { x, y } = mapCoords(e);
      postInput({ type: "click", x, y, button: e.button === 2 ? "right" : "left" });
      // Keep focus on canvas for keyboard input
      canvasRef.current?.focus();
    },
    [state, mapCoords, postInput]
  );

  // Mouse move handler (debounced)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (state !== "streaming") return;
      const { x, y } = mapCoords(e);
      pendingMoveRef.current = { x, y };

      if (!moveTimerRef.current) {
        moveTimerRef.current = setTimeout(() => {
          moveTimerRef.current = null;
          if (pendingMoveRef.current) {
            postInput({ type: "mousemove", ...pendingMoveRef.current });
            pendingMoveRef.current = null;
          }
        }, 100);
      }
    },
    [state, mapCoords, postInput]
  );

  // Get CDP modifier flags from keyboard event
  const getModifiers = (e: React.KeyboardEvent): number => {
    let flags = 0;
    if (e.altKey) flags |= 1;
    if (e.ctrlKey) flags |= 2;
    if (e.metaKey) flags |= 4;
    if (e.shiftKey) flags |= 8;
    return flags;
  };

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (state !== "streaming") return;

      // Prevent browser defaults for keys we're relaying
      if (
        ["Tab", "Backspace", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)
      ) {
        e.preventDefault();
      }

      // For printable characters, use insertText for reliable text entry
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        postInput({ type: "text", text: e.key });
      } else {
        postInput({
          type: "keydown",
          key: e.key,
          code: e.code,
          modifiers: getModifiers(e),
        });
      }
    },
    [state, postInput]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (state !== "streaming") return;
      postInput({
        type: "keyup",
        key: e.key,
        code: e.code,
        modifiers: getModifiers(e),
      });
    },
    [state, postInput]
  );

  // Paste handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLCanvasElement>) => {
      if (state !== "streaming") return;
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        postInput({ type: "text", text });
      }
    },
    [state, postInput]
  );

  // Prevent context menu on right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const isLoading = state === "connecting" || state === "completing";
  const showCanvas = state === "streaming" || state === "completing";

  return (
    <div className="space-y-3">
      {/* Status overlay */}
      {isLoading && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Canvas — renders the streamed browser view */}
      <div
        className={`relative rounded-lg overflow-hidden border border-border bg-black ${
          showCanvas ? "" : "hidden"
        }`}
        style={{ aspectRatio: `${viewportRef.current.width} / ${viewportRef.current.height}` }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="w-full h-full cursor-default outline-none"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          onContextMenu={handleContextMenu}
          aria-label="Alberta SSO login page — sign in with your MyAlberta Digital ID"
          role="application"
        />
        {state === "completing" && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-background rounded-lg p-4 flex items-center gap-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">{statusMessage}</span>
            </div>
          </div>
        )}
      </div>

      {showCanvas && (
        <p className="text-xs text-muted-foreground text-center">
          This is Alberta&apos;s official login page running in a secure browser.
          Your password goes directly to Alberta — we never see it.
        </p>
      )}
    </div>
  );
}
