import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryHistory } from "../portal/src/lib/chat/memory-history.js";
import { removeLegacyHistory } from "../portal/src/lib/chat/legacy-history.js";
import { bindChatSession } from "../portal/src/lib/chat/session-lifecycle.js";
import { setTelemetryClient, trackEvent } from "../portal/src/lib/telemetry/events.js";

// Load the actual handler without starting Next, contacting providers, or reading credentials.
function loadPortalModule(file: string, imports: Record<string, unknown> = {}) {
  const source = readFileSync(resolve("portal/src", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => Promise<Response>> = {};
  runInNewContext(code, {
    exports, process, Response, Request, URL, console,
    require: (name: string) => {
      if (name in imports) return imports[name];
      if (name === "@/lib/availability") return loadPortalModule("lib/availability.ts");
      if (name === "next/server") return { NextResponse: Response };
      if (name === "crypto") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("portal availability boundary", () => {
  it("blocks the model handler before auth or provider work when the flag is absent", async () => {
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", undefined);
    const auth = vi.fn(async () => ({ user: { id: "synthetic-user-a" } }));
    const getAvailableModels = vi.fn(() => []);
    const route = loadPortalModule("app/api/models/route.ts", {
      "@/lib/auth": { auth },
      "@/lib/ai/model-resolver": { getAvailableModels },
    });
    const response = await route.GET();
    expect(response.status).toBe(503);
    expect(auth).not.toHaveBeenCalled();
    expect(getAvailableModels).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "false", "1", "TRUE"])("blocks every API handler before any sensitive imports or body reads for flag %s", async (flag) => {
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", flag);
    vi.stubEnv("BETA_INVITE_SECRET", "invented-test-value");
    const files = readdirSync("portal/src/app/api", { recursive: true })
      .filter((file): file is string => typeof file === "string" && file.endsWith("route.ts"));
    expect(files).toHaveLength(11);
    let methods = 0;
    for (const file of files) {
      const route = loadPortalModule(`app/api/${file}`);
      for (const [method, handler] of Object.entries(route)) {
        if (!/^(GET|POST|DELETE|PUT|PATCH|HEAD|OPTIONS)$/.test(method)) continue;
        methods++;
        const bodyRead = vi.fn(() => { throw new Error("Body must not be read"); });
        const response = await handler({ json: bodyRead, text: bodyRead });
        expect(response.status, `${file} ${method}`).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ error: "portal_unavailable" });
        expect(bodyRead).not.toHaveBeenCalled();
      }
    }
    expect(methods).toBe(16);
  });

  it("only delegates to a handler when explicitly enabled", async () => {
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", "true");
    const GET = vi.fn(() => Response.json({ synthetic: true }));
    const route = loadPortalModule("app/api/models/route.ts", { "./handler": { GET } });
    expect((await route.GET()).status).toBe(200);
    expect(GET).toHaveBeenCalledOnce();
  });

  it("never re-enables the legacy shared-profile sign-in endpoint", async () => {
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", "true");
    const handler = loadPortalModule("app/api/health/connect/handler.ts");
    const response = await handler.POST();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ connected: false, error: "connection_flow_retired" });
  });
});

const syntheticMessages = [{ id: "message-a", role: "user" as const, parts: [{ type: "text" as const, text: "Invented account A record" }] }];

describe("memory-only account history", () => {
  it("cannot import legacy storage or share messages across account changes and refresh", () => {
    const getItem = vi.fn(() => JSON.stringify(syntheticMessages));
    vi.stubGlobal("localStorage", { getItem });
    vi.stubGlobal("sessionStorage", { getItem });
    const first = new MemoryHistory("account-a");
    const conversation = first.create("Synthetic conversation")!;
    first.save(conversation.id, syntheticMessages);
    expect(first.load(conversation.id)).toEqual(syntheticMessages);
    first.invalidate();
    first.save(conversation.id, syntheticMessages);
    expect(first.load(conversation.id)).toEqual([]);
    expect(first.list()).toEqual([]);
    expect(first.create("late completion")).toBeNull();
    expect(new MemoryHistory("account-b").load(conversation.id)).toEqual([]);
    expect(new MemoryHistory("account-a").load(conversation.id)).toEqual([]);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("rejects delayed responses even when a network implementation ignores abort", async () => {
    let complete!: (response: Response) => void;
    const network = vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((resolve) => {
      expect(init?.cache).toBe("no-store");
      complete = resolve;
    }));
    vi.stubGlobal("fetch", network);
    const history = new MemoryHistory("account-a");
    const response = history.fetch("https://synthetic.invalid/chat");
    const rejection = expect(response).rejects.toMatchObject({ name: "AbortError" });
    history.invalidate();
    complete(new Response("late invented record"));
    await rejection;
    expect(network.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("discards buffered stream chunks after invalidation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("synthetic record")); },
    }))));
    const history = new MemoryHistory("account-a");
    const response = await history.fetch("https://synthetic.invalid/chat");
    await Promise.resolve();
    history.invalidate();
    await expect(response.text()).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([401, 403, 503])("invalidates history on rejected requests (%s)", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    const history = new MemoryHistory("account-a");
    await expect(history.fetch("https://synthetic.invalid/status")).rejects.toMatchObject({ name: "AbortError" });
    expect(history.isActive()).toBe(false);
  });

  it("removes only obsolete owned key patterns, without reading values", () => {
    const data = new Map([
      ["ab-health-conversations", "synthetic"],
      ["ab-health-msgs-old", "synthetic"],
      ["unrelated-setting", "keep"],
      ["claude-history", "keep"],
      ["ab-health-msgs", "keep"],
    ]);
    removeLegacyHistory({
      get length() { return data.size; },
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (key) => { data.delete(key); },
    });
    expect([...data.keys()]).toEqual(["unrelated-setting", "claude-history", "ab-health-msgs"]);
  });
});

describe("browser session lifecycle", () => {
  function setup() {
    vi.useFakeTimers();
    const browser = new EventTarget();
    const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const getSession = vi.fn(async () => ({ user: { id: "account-a" }, expires: new Date(Date.now() + 60_000).toISOString() }));
    const snapshots: Array<MemoryHistory | null> = [];
    const onClear = vi.fn();
    const binding = bindChatSession({
      owner: "account-a", browser, page, getSession, onClear,
      onHistory: (history) => { snapshots.push(history); },
    });
    return { binding, browser, page, getSession, snapshots, onClear };
  }

  it("clears and aborts on backgrounding, then starts an empty verified lifetime", async () => {
    const context = setup();
    await vi.advanceTimersByTimeAsync(0);
    const old = context.snapshots.at(-1)!;
    const conversation = old.create("A")!;
    old.save(conversation.id, syntheticMessages);
    context.page.visibilityState = "hidden";
    context.page.dispatchEvent(new Event("visibilitychange"));
    expect(old.isActive()).toBe(false);
    expect(context.snapshots.at(-1)).toBeNull();
    context.page.visibilityState = "visible";
    context.page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(context.snapshots.at(-1)?.list()).toEqual([]);
    expect(context.snapshots.at(-1)).not.toBe(old);
    expect(context.snapshots.at(-1)?.id).not.toBe(old.id);
    context.binding.dispose();
  });

  it("clears synchronously for pagehide and refuses bfcache restoration for a different account", async () => {
    const context = setup();
    await vi.advanceTimersByTimeAsync(0);
    const old = context.snapshots.at(-1)!;
    context.browser.dispatchEvent(new Event("pagehide"));
    expect(old.isActive()).toBe(false);
    expect(context.onClear).toHaveBeenCalled();
    context.getSession.mockResolvedValue({ user: { id: "account-b" }, expires: new Date(Date.now() + 60_000).toISOString() });
    context.browser.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(context.snapshots.at(-1)).toBeNull();
    context.binding.dispose();
  });

  it("clears on session loss during polling", async () => {
    const context = setup();
    await vi.advanceTimersByTimeAsync(0);
    const old = context.snapshots.at(-1)!;
    context.getSession.mockRejectedValue(new Error("Session unavailable"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(old.isActive()).toBe(false);
    expect(context.snapshots.at(-1)).toBeNull();
    context.binding.dispose();
  });

  it("expires the visible state at the known session expiry", async () => {
    const context = setup();
    context.getSession.mockResolvedValue({ user: { id: "account-a" }, expires: new Date(Date.now() + 100).toISOString() });
    context.browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    const old = context.snapshots.at(-1)!;
    await vi.advanceTimersByTimeAsync(101);
    expect(old.isActive()).toBe(false);
    expect(context.snapshots.at(-1)).toBeNull();
    context.binding.dispose();
  });

  it("a pending validation cannot reopen chat after explicit sign-out", async () => {
    const context = setup();
    await vi.advanceTimersByTimeAsync(0);
    let resolveSession!: (session: { user: { id: string }; expires: string }) => void;
    context.getSession.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    context.browser.dispatchEvent(new Event("focus"));
    context.binding.endSession();
    resolveSession({ user: { id: "account-a" }, expires: new Date(Date.now() + 60_000).toISOString() });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(context.snapshots.at(-1)).toBeNull();
    expect(context.getSession).toHaveBeenCalledTimes(2);
    context.binding.dispose();
  });
});

describe("telemetry boundaries", () => {
  it("requires separate portal and telemetry opt-ins even with a client set", () => {
    const emit = vi.fn();
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", undefined);
    vi.stubEnv("PORTAL_TELEMETRY_ENABLED", "true");
    setTelemetryClient({ trackEvent: emit });
    trackEvent("chat.quota.hit", { quota: "daily-messages" });
    expect(emit).not.toHaveBeenCalled();
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", "true");
    vi.stubEnv("PORTAL_TELEMETRY_ENABLED", undefined);
    setTelemetryClient({ trackEvent: emit });
    trackEvent("chat.quota.hit", { quota: "daily-messages" });
    expect(emit).not.toHaveBeenCalled();
  });

  it("allowlists technical fields and validates their values at runtime", () => {
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", "true");
    vi.stubEnv("PORTAL_TELEMETRY_ENABLED", "true");
    const emit = vi.fn();
    setTelemetryClient({ trackEvent: emit });
    const props = { messageIndex: 2, inputTokensEstimated: NaN, userHash: "synthetic-hash", prompt: "synthetic record" };
    trackEvent("chat.message.sent", props);
    expect(emit).toHaveBeenCalledWith({ name: "chat.message.sent", properties: { messageIndex: "2" } });
    trackEvent("chat.quota.hit", { quota: "synthetic free text" } as never);
    expect(emit).toHaveBeenLastCalledWith({ name: "chat.quota.hit", properties: {} });
    trackEvent("not-an-allowed-event" as never, {} as never);
    expect(emit).toHaveBeenCalledTimes(2);
    vi.stubEnv("PORTAL_DEPLOY_ENABLED", "false");
    trackEvent("chat.abuse.throttled", {});
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
