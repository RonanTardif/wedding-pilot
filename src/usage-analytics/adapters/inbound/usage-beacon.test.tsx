import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendUsageEvent, UsageBeacon } from "./usage-beacon";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("UsageBeacon", () => {
  it("renders nothing", () => {
    expect(renderToStaticMarkup(<UsageBeacon path="/" highlightedStepKind="next" />)).toBe("");
  });
});

describe("sendUsageEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the event with keepalive, no credentials, and stable opaque tokens", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { sessionStorage: memoryStorage(), localStorage: memoryStorage() });

    sendUsageEvent("page_viewed", { path: "/" });
    sendUsageEvent("programme_viewed", { highlighted_step_kind: "current" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/events");
    expect(init).toMatchObject({ method: "POST", keepalive: true, credentials: "omit" });
    const first = JSON.parse(init.body as string) as Record<string, unknown>;
    const second = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(Object.keys(first).sort()).toEqual(["anonymous_user_id", "event_type", "properties", "session_id"]);
    expect(first.session_id).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(first.anonymous_user_id).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(second.session_id).toBe(first.session_id);
    expect(second.anonymous_user_id).toBe(first.anonymous_user_id);
    expect(second.properties).toEqual({ highlighted_step_kind: "current" });
  });

  it("swallows storage and network failures", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => sendUsageEvent("page_viewed", { path: "/" })).not.toThrow();
  });

  it("swallows a synchronous fetch failure", () => {
    vi.stubGlobal("fetch", () => {
      throw new TypeError("no fetch");
    });
    vi.stubGlobal("window", { sessionStorage: memoryStorage(), localStorage: memoryStorage() });
    expect(() => sendUsageEvent("page_viewed", { path: "/" })).not.toThrow();
  });
});
