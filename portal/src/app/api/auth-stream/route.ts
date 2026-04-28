/**
 * Streamed cloud browser auth for Alberta SSO.
 *
 * GET  — SSE endpoint: launches headless Puppeteer, streams CDP screencast
 *        frames to the user's browser, monitors for login completion.
 * POST — Input relay: dispatches mouse/keyboard events to the Puppeteer page.
 *
 * The user sees and interacts with Alberta's REAL login page rendered in a
 * canvas. Credentials go directly from their input → Puppeteer → Alberta.
 * Our code never touches passwords.
 */

import { auth } from "@/lib/auth";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { HTTPResponse } from "puppeteer-core";
import {
  generateStreamId,
  registerAuthStream,
  getAuthStream,
  destroyAuthStream,
  hasActiveStream,
} from "@/lib/auth/auth-stream-store";
import {
  completeAuthFlow,
  serializeSession,
  findChrome,
} from "@/lib/auth/health-auth";
import { setHealthSession } from "@/lib/auth/health-session-store";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

puppeteer.use(StealthPlugin());

const SSO_LOGIN_URL = "https://account.alberta.ca/ui/sign-in/signin";
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const LOGIN_TIMEOUT_MS = 180_000; // 3 minutes
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_TEXT_INPUT_LENGTH = 500;

/** Domains the headless browser is allowed to navigate to. */
const ALLOWED_DOMAINS = [
  "account.alberta.ca",
  "sts.xiduam.ca",
  "myhealth.alberta.ca",
  "myhealthrecords.alberta.ca",
  "console.myhealthrecords.alberta.ca",
  "myahsconnect.albertahealthservices.ca",
  "ahs.queue-it.net",
];

/** Keyboard shortcuts that must be blocked (browser navigation, dev tools). */
const BLOCKED_KEYS = new Set(["F5", "F11", "F12"]);
const BLOCKED_CTRL_KEYS = new Set(["l", "n", "t", "w", "r", "u", "j"]);

/**
 * GET — Start an SSE stream of the Alberta login page.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const abortSignal = req.signal;

  // Rate limit: max 3 auth streams per 5 minutes
  const rateLimited = checkRateLimit(`auth-stream:${userId}`, { windowMs: 5 * 60_000, maxRequests: 3 });
  if (rateLimited) return rateLimited;

  // Only one active stream per user
  if (hasActiveStream(userId)) {
    return new Response(JSON.stringify({ error: "Auth stream already active" }), { status: 409 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const streamId = generateStreamId();
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let loginTimer: ReturnType<typeof setTimeout> | null = null;
      let closed = false;

      function send(data: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      }

      function sendHeartbeat() {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          closed = true;
        }
      }

      async function cleanup() {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (loginTimer) clearTimeout(loginTimer);
        await destroyAuthStream(streamId);
        // Clean up isolated browser profile directory
        try {
          const os = require("os");
          const path = require("path");
          const fs = require("fs");
          const profileDir = path.join(os.tmpdir(), "auth-stream", streamId);
          fs.rmSync(profileDir, { recursive: true, force: true });
        } catch { /* best-effort cleanup */ }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      // Handle client disconnect
      abortSignal.addEventListener("abort", () => cleanup(), { once: true });

      try {
        // Launch headless Puppeteer with isolated per-session profile
        const executablePath = findChrome();
        const os = require("os");
        const path = require("path");
        const fs = require("fs");
        const profileDir = path.join(os.tmpdir(), "auth-stream", streamId);
        fs.mkdirSync(profileDir, { recursive: true });

        const browser = await puppeteer.launch({
          headless: true,
          executablePath,
          userDataDir: profileDir,
          defaultViewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        });

        const page = await browser.newPage();
        const cdp = await page.createCDPSession();

        // URL allowlist: abort navigation to unauthorized domains
        page.on("framenavigated", (frame: { url: () => string; parentFrame: () => unknown }) => {
          if (frame.parentFrame()) return; // only check main frame
          try {
            const url = new URL(frame.url());
            if (url.protocol === "about:" || url.protocol === "data:") return;
            if (!ALLOWED_DOMAINS.includes(url.hostname)) {
              send({ type: "error", message: "Navigation blocked — unauthorized domain." });
              cleanup();
            }
          } catch { /* invalid URL — ignore */ }
        });

        // Register the session
        await registerAuthStream({
          id: streamId,
          userId,
          browser,
          page,
          cdp,
          createdAt: Date.now(),
          completing: false,
        });

        // Send ready event with session ID
        send({
          type: "ready",
          sessionId: streamId,
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
        });

        // Start heartbeat
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        // Monitor for rate limiting and login completion
        let rateLimited = false;
        let loginDetected = false;

        page.on("response", (response: HTTPResponse) => {
          const url = response.url();
          const status = response.status();
          if (
            status === 429 &&
            (url.includes("account-checks") || url.includes("signin"))
          ) {
            rateLimited = true;
          }
          if (url.includes("is-login-token-valid") && status === 200) {
            loginDetected = true;
          }
        });

        // Navigate to SSO login
        await page.goto(SSO_LOGIN_URL, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        if (rateLimited) {
          send({
            type: "error",
            message:
              "Alberta's sign-in service is temporarily busy. Please wait 5–10 minutes and try again.",
          });
          await cleanup();
          return;
        }

        // Start CDP screencast
        cdp.on("Page.screencastFrame", (frame: { data: string; sessionId: number }) => {
          if (closed) return;
          send({ type: "frame", data: frame.data });
          // ACK the frame so CDP keeps sending
          cdp.send("Page.screencastFrameAck", {
            sessionId: frame.sessionId,
          }).catch(() => {});
        });

        await cdp.send("Page.startScreencast", {
          format: "jpeg",
          quality: 55,
          maxWidth: VIEWPORT_WIDTH,
          maxHeight: VIEWPORT_HEIGHT,
          everyNthFrame: 2,
        });

        // Wait for login or timeout
        await new Promise<void>((resolve, reject) => {
          loginTimer = setTimeout(() => {
            reject(
              new Error(
                "Login timed out. Please complete sign-in within 3 minutes."
              )
            );
          }, LOGIN_TIMEOUT_MS);

          const checkLogin = setInterval(() => {
            if (loginDetected) {
              clearInterval(checkLogin);
              if (loginTimer) clearTimeout(loginTimer);
              resolve();
            }
            if (rateLimited) {
              clearInterval(checkLogin);
              if (loginTimer) clearTimeout(loginTimer);
              reject(
                new Error(
                  "Alberta's sign-in service is temporarily busy. Please wait 5–10 minutes."
                )
              );
            }
            if (closed) {
              clearInterval(checkLogin);
              if (loginTimer) clearTimeout(loginTimer);
              reject(new Error("Stream closed"));
            }
          }, 500);
        });

        // Login detected — stop screencast, run post-login flow
        send({ type: "status", message: "Sign-in detected — connecting to your health records..." });

        // Mark as completing so timeout cleanup doesn't kill it
        const streamSession = getAuthStream(streamId, userId);
        if (streamSession) streamSession.completing = true;

        await cdp.send("Page.stopScreencast").catch(() => {});

        const authResult = await completeAuthFlow(page);
        const sessionData = serializeSession(authResult);
        setHealthSession(userId, sessionData);

        send({
          type: "done",
          mhr: authResult.mhrConnected,
          myChart: authResult.myChartConnected,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Authentication failed";
        if (!closed) {
          send({ type: "error", message });
        }
      } finally {
        await cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx/proxy buffering
    },
  });
}

/**
 * POST — Relay user input events to the Puppeteer page.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    sessionId: string;
    type: string;
    x?: number;
    y?: number;
    button?: string;
    key?: string;
    code?: string;
    text?: string;
    modifiers?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  const authStream = getAuthStream(body.sessionId, session.user.id);
  if (!authStream) {
    return new Response("Session not found", { status: 404 });
  }

  const { cdp } = authStream;

  try {
    switch (body.type) {
      case "click": {
        const x = body.x ?? 0;
        const y = body.y ?? 0;
        const button = body.button === "right" ? "right" : "left";
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button,
          clickCount: 1,
        });
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button,
          clickCount: 1,
        });
        break;
      }

      case "mousemove": {
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: body.x ?? 0,
          y: body.y ?? 0,
        });
        break;
      }

      case "keydown": {
        const key = body.key ?? "";
        const modifiers = body.modifiers ?? 0;
        const hasCtrl = (modifiers & 2) !== 0;
        const hasMeta = (modifiers & 4) !== 0;

        // Block dangerous keyboard shortcuts
        if (BLOCKED_KEYS.has(key)) break;
        if ((hasCtrl || hasMeta) && BLOCKED_CTRL_KEYS.has(key.toLowerCase())) break;

        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key,
          code: body.code ?? "",
          windowsVirtualKeyCode: keyToVirtualKeyCode(key),
          modifiers,
        });
        break;
      }

      case "keyup": {
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: body.key ?? "",
          code: body.code ?? "",
          windowsVirtualKeyCode: keyToVirtualKeyCode(body.key ?? ""),
          modifiers: body.modifiers ?? 0,
        });
        break;
      }

      case "text": {
        // For paste and composition — length-limited to prevent abuse
        const text = (body.text ?? "").slice(0, MAX_TEXT_INPUT_LENGTH);
        if (text) {
          await cdp.send("Input.insertText", { text });
        }
        break;
      }

      default:
        return new Response("Unknown event type", { status: 400 });
    }
  } catch {
    // CDP dispatch failed — session may be closing, that's OK
  }

  return new Response("OK", { status: 200 });
}

/** Map common key names to Windows virtual key codes for CDP. */
function keyToVirtualKeyCode(key: string): number {
  const map: Record<string, number> = {
    Enter: 13,
    Tab: 9,
    Backspace: 8,
    Escape: 27,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Delete: 46,
    Home: 36,
    End: 35,
    PageUp: 33,
    PageDown: 34,
    " ": 32,
    Shift: 16,
    Control: 17,
    Alt: 18,
    Meta: 91,
  };
  if (map[key]) return map[key];
  // Single character — use its char code
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return 0;
}
