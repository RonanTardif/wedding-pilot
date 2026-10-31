// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsageBeacon } from "./usage-beacon";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWPORT_HEIGHT = 1000;

/** IntersectionObserver stub: tests push entries through `emit`. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(entry: { ratio: number; visibleHeight: number }) {
    if (this.disconnected) return;
    const fake = {
      isIntersecting: entry.ratio > 0,
      intersectionRatio: entry.ratio,
      intersectionRect: { height: entry.visibleHeight },
      rootBounds: { height: VIEWPORT_HEIGHT },
      target: this.targets[0],
    } as unknown as IntersectionObserverEntry;
    this.callback([fake], this as unknown as IntersectionObserver);
  }
}

let fetchMock: ReturnType<typeof vi.fn>;
let root: Root;
let container: HTMLElement;

function sentEventTypes(): string[] {
  return fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as RequestInit).body as string) as { event_type: string }).event_type);
}

function sentBody(eventType: string): Record<string, unknown> | undefined {
  return fetchMock.mock.calls
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>)
    .find((body) => body.event_type === eventType);
}

function observer(): FakeIntersectionObserver {
  const last = FakeIntersectionObserver.instances.at(-1);
  if (!last) throw new Error("no IntersectionObserver created");
  return last;
}

function mount(element: ReactNode) {
  act(() => root.render(<StrictMode>{element}</StrictMode>));
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  document.body.innerHTML = '<section aria-labelledby="programme-title"><h2 id="programme-title">Programme du jour</h2></section>';
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("UsageBeacon (browser)", () => {
  it("sends exactly one page_viewed per load, even with StrictMode double effects and re-renders", () => {
    mount(<UsageBeacon path="/" highlightedStepKind="next" />);
    mount(<UsageBeacon path="/" highlightedStepKind="next" />);
    expect(sentEventTypes()).toEqual(["page_viewed"]);
    expect(sentBody("page_viewed")?.properties).toEqual({ path: "/" });
  });

  it("observes the programme section", () => {
    mount(<UsageBeacon path="/" />);
    expect(observer().targets).toEqual([document.querySelector('[aria-labelledby="programme-title"]')]);
  });

  it("sends exactly one programme_viewed: not at 0.3, then at 0.6, never again", () => {
    mount(<UsageBeacon path="/" highlightedStepKind="current" />);
    // Short section (400 px): 0.3 shows 120 px, 0.6 shows 240 px of a 1000 px viewport.
    act(() => observer().emit({ ratio: 0.3, visibleHeight: 120 }));
    expect(sentEventTypes()).toEqual(["page_viewed"]);
    act(() => observer().emit({ ratio: 0.6, visibleHeight: 240 }));
    act(() => observer().emit({ ratio: 1, visibleHeight: 400 }));
    expect(sentEventTypes()).toEqual(["page_viewed", "programme_viewed"]);
    expect(sentBody("programme_viewed")?.properties).toEqual({ highlighted_step_kind: "current" });
    expect(observer().disconnected).toBe(true);
  });

  it("sends programme_viewed for a tall section filling half the viewport, below a 0.5 ratio", () => {
    mount(<UsageBeacon path="/" />);
    // Section of 3000 px: 0.2 shows 600 px, i.e. 60 % of the viewport.
    act(() => observer().emit({ ratio: 0.1, visibleHeight: 300 }));
    expect(sentEventTypes()).toEqual(["page_viewed"]);
    act(() => observer().emit({ ratio: 0.2, visibleHeight: 600 }));
    expect(sentEventTypes()).toEqual(["page_viewed", "programme_viewed"]);
    expect(sentBody("programme_viewed")?.properties).toEqual({});
  });
});
