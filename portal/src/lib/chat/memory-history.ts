import type { UIMessage } from "ai";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

/** One verified account and one visible page lifetime. Never backed by browser storage. */
export class MemoryHistory {
  readonly id = crypto.randomUUID();
  private conversations: Conversation[] = [];
  private messages = new Map<string, UIMessage[]>();
  private controller = new AbortController();
  private active = true;
  private revision = 0;
  private listeners = new Set<() => void>();

  constructor(readonly owner: string, private onInvalidated: () => void = () => {}) {}

  isActive(): boolean {
    return this.active;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getRevision = () => this.revision;

  private notify(): void {
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  invalidate(): void {
    if (!this.active) return;
    this.active = false;
    this.controller.abort();
    this.conversations = [];
    this.messages.clear();
    this.notify();
    this.onInvalidated();
  }

  list(): Conversation[] {
    return this.active ? structuredClone(this.conversations) : [];
  }

  create(title: string): Conversation | null {
    if (!this.active) return null;
    const now = new Date().toISOString();
    const conversation = { id: crypto.randomUUID(), title, preview: "", createdAt: now, updatedAt: now };
    this.conversations.unshift(conversation);
    this.notify();
    return { ...conversation };
  }

  load(id: string): UIMessage[] {
    return this.active ? structuredClone(this.messages.get(id) ?? []) : [];
  }

  save(id: string, messages: UIMessage[]): void {
    if (!this.active || !this.conversations.some((c) => c.id === id)) return;
    this.messages.set(id, structuredClone(messages));
  }

  update(id: string, title: string, preview: string): void {
    if (!this.active) return;
    const conversation = this.conversations.find((c) => c.id === id);
    if (conversation) {
      Object.assign(conversation, { title, preview, updatedAt: new Date().toISOString() });
      this.notify();
    }
  }

  delete(id: string): void {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    this.messages.delete(id);
    this.notify();
  }

  /** Guard headers and every streamed chunk, including fetch implementations that ignore abort. */
  fetch: typeof fetch = async (input, init) => {
    const assertActive = () => {
      if (!this.active) throw new DOMException("Chat session ended", "AbortError");
    };
    assertActive();
    const signal = init?.signal
      ? AbortSignal.any([init.signal, this.controller.signal])
      : this.controller.signal;
    const response = await fetch(input, { ...init, signal, cache: "no-store" });
    if (response.status === 401 || response.status === 403 || response.status === 503) this.invalidate();
    assertActive();
    if (!response.body) return response;
    const reader = response.body.getReader();
    let abort: () => void;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        abort = () => {
          controller.error(new DOMException("Chat session ended", "AbortError"));
          void reader.cancel().catch(() => {});
        };
        this.controller.signal.addEventListener("abort", abort, { once: true });
      },
      pull: async (controller) => {
        try {
          assertActive();
          const next = await reader.read();
          assertActive();
          if (next.done) {
            this.controller.signal.removeEventListener("abort", abort);
            controller.close();
          }
          else controller.enqueue(next.value);
        } catch (error) {
          void reader.cancel().catch(() => {});
          controller.error(error);
        }
      },
      cancel: (reason) => {
        this.controller.signal.removeEventListener("abort", abort);
        return reader.cancel(reason);
      },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}
