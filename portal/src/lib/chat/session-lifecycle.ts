import { MemoryHistory } from "./memory-history";

interface Options {
  owner: string;
  getSession: () => Promise<{ user?: { id?: string }; expires: string } | null>;
  onHistory: (history: MemoryHistory | null) => void;
  onClear: () => void;
  browser: EventTarget;
  page: EventTarget & { readonly visibilityState: string };
}

/** All asynchronous session checks belong to a revision; stale checks cannot reopen chat. */
export function bindChatSession({ owner, getSession, onHistory, onClear, browser, page }: Options) {
  let disposed = false;
  let ended = false;
  let revision = 0;
  let current: MemoryHistory | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    revision++;
    clearTimeout(expiryTimer);
    onClear();
    current?.invalidate();
    current = null;
    if (!disposed) onHistory(null);
  };

  const verify = async () => {
    if (disposed || ended || page.visibilityState !== "visible") return;
    const version = ++revision;
    try {
      const fresh = await getSession();
      if (disposed || ended || version !== revision || page.visibilityState !== "visible") return;
      const expires = fresh ? Date.parse(fresh.expires) : NaN;
      if (fresh?.user?.id !== owner || !Number.isFinite(expires) || expires <= Date.now()) {
        clear();
        return;
      }
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(clear, Math.min(expires - Date.now(), 2_147_483_647));
      if (!current?.isActive()) {
        current = new MemoryHistory(owner, () => {
          onClear();
          if (!disposed) onHistory(null);
        });
        onHistory(current);
      }
    } catch {
      if (version === revision) clear();
    }
  };
  const onVisibility = () => {
    if (page.visibilityState === "hidden") clear();
    else void verify();
  };
  const onFocus = () => { clear(); void verify(); };
  const onPageShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) { clear(); void verify(); }
  };
  page.addEventListener("visibilitychange", onVisibility);
  browser.addEventListener("pagehide", clear);
  browser.addEventListener("pageshow", onPageShow);
  browser.addEventListener("focus", onFocus);
  const poll = setInterval(() => void verify(), 15_000);
  void verify();

  return {
    clear,
    endSession() { ended = true; clear(); },
    dispose() {
      disposed = true;
      clear();
      clearInterval(poll);
      page.removeEventListener("visibilitychange", onVisibility);
      browser.removeEventListener("pagehide", clear);
      browser.removeEventListener("pageshow", onPageShow);
      browser.removeEventListener("focus", onFocus);
    },
  };
}
