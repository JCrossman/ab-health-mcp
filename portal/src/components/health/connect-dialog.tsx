"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

/**
 * Health account connection dialog.
 *
 * Launches a real Chrome window where the user logs in on Alberta's
 * actual SSO page. No credentials pass through our server.
 */
export function ConnectDialog({ open, onClose, onConnected }: ConnectDialogProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/health/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.connected) {
        setSuccess(true);
        onConnected();
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setError(data.message || "Connection failed. Please try again.");
      }
    } catch {
      setError("Could not reach the health records service. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-background rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Connect Health Account</h2>
            <p className="text-sm text-muted-foreground">
              My Health Records &amp; AHS MyChart
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            A browser window will open to Alberta&apos;s login page where you
            sign in directly with your MyAlberta Digital ID.
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-foreground">How it works:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>A Chrome window opens to Alberta&apos;s official login page</li>
              <li>You sign in directly — credentials never pass through our server</li>
              <li>After you sign in, you&apos;re connected automatically</li>
              <li>The browser window closes and you&apos;re connected</li>
              <li>Your sign-in expires after about 10 minutes of no activity</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-green-700 dark:text-green-300">
              Connected to Alberta health records!
            </p>
          </div>
        )}

        {connecting && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <Loader2 className="h-4 w-4 text-blue-500 mt-0.5 animate-spin shrink-0" />
            <p className="text-blue-700 dark:text-blue-300">
              A Chrome window has opened — please sign in on Alberta&apos;s login page.
              This window will close automatically after you log in.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={connecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || success}
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Waiting for login...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Connected!
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Open Alberta Login
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Protected under Alberta&apos;s Health Information Act (HIA)
        </p>
      </div>
    </div>
  );
}
