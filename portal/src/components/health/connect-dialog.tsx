"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle2, Monitor } from "lucide-react";
import { AuthStreamCanvas } from "./auth-stream-canvas";

interface ConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

/**
 * Health account connection dialog.
 *
 * Opens a streamed cloud browser showing Alberta's real SSO login page.
 * The user types credentials directly into the streamed view — our code
 * never sees passwords.
 */
export function ConnectDialog({ open, onClose, onConnected }: ConnectDialogProps) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Capture trigger element and manage focus on open/close.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      const timer = setTimeout(() => {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      (triggerRef.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // Focus trap + Escape handler.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Escape when NOT streaming (streaming canvas needs keyboard events)
      if (e.key === "Escape" && !streaming) {
        handleClose();
        return;
      }
      if (e.key !== "Tab" || streaming) return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), canvas[tabindex]'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, streaming]);

  if (!open) return null;

  const handleStartStream = () => {
    setStreaming(true);
    setError(null);
  };

  const handleConnected = (result: { mhr: boolean; myChart: boolean }) => {
    setSuccess(true);
    setStreaming(false);
    onConnected();
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  };

  const handleStreamError = (message: string) => {
    setError(message);
    setStreaming(false);
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setStreaming(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={streaming ? undefined : handleClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-dialog-title"
        aria-describedby="connect-dialog-desc"
        className={`relative bg-background rounded-xl shadow-xl mx-4 p-6 space-y-4 ${
          streaming ? "max-w-4xl w-full" : "max-w-md w-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 id="connect-dialog-title" className="text-lg font-semibold">Connect Health Account</h2>
            <p className="text-sm text-muted-foreground">
              My Health Records &amp; AHS MyChart
            </p>
          </div>
        </div>

        {!streaming && !success && (
          <div id="connect-dialog-desc" className="space-y-3 text-sm text-muted-foreground">
            <p>
              A secure browser window will appear below showing Alberta&apos;s
              official login page. Sign in directly with your MyAlberta Digital ID.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium text-foreground">How it works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Alberta&apos;s login page appears in a secure browser below</li>
                <li>You type your credentials directly — they go straight to Alberta</li>
                <li>We never see your password</li>
                <li>After you sign in, you&apos;re connected automatically</li>
                <li>Your sign-in expires after about 10 minutes of no activity</li>
              </ul>
            </div>
          </div>
        )}

        {/* Auth stream canvas */}
        {streaming && (
          <AuthStreamCanvas
            active={streaming}
            onConnected={handleConnected}
            onError={handleStreamError}
          />
        )}

        {/* Status messages */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-red-700 dark:text-red-300" role="alert">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-green-700 dark:text-green-300">
                Connected to Alberta health records!
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={success}
          >
            {streaming ? "Cancel" : "Close"}
          </Button>
          {!streaming && !success && (
            <Button onClick={handleStartStream}>
              <Monitor className="mr-2 h-4 w-4" aria-hidden="true" />
              Open Alberta Login
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Protected under Alberta&apos;s Health Information Act (HIA)
        </p>
      </div>
    </div>
  );
}
