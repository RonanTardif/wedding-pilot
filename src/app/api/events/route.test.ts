import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());

vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    return { dataset: () => ({ table: () => ({ insert }) }) };
  }),
}));

const { dynamic, POST } = await import("./route");
const { MAX_BODY_BYTES } = await import("./handle-events-post");

const validBody = {
  event_type: "page_viewed",
  properties: { path: "/" },
  session_id: "session-token-1",
  anonymous_user_id: "user-token-1",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** The row passed to BigQuery by the last insert. */
function lastRow(): Record<string, unknown> {
  const rows = insert.mock.lastCall?.[0] as [{ insertId: string; json: Record<string, unknown> }];
  return rows[0].json;
}

describe("POST /api/events", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue([{}]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("is dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns 202 and writes a real-traffic row", async () => {
    const response = await POST(post(validBody, { "x-forwarded-for": "203.0.113.1", "user-agent": "Mozilla/5.0" }));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(insert).toHaveBeenCalledTimes(1);
    const row = lastRow();
    expect(row).toMatchObject({ event_type: "page_viewed", traffic_source: "real", product_id: "wedding-pilot" });
    expect(row.event_id).toMatch(/^evt_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(JSON.stringify(row)).not.toMatch(/203\.0\.113\.1|Mozilla/);
  });

  it("marks synthetic traffic from the x-atlas-traffic header", async () => {
    const response = await POST(post(validBody, { "x-atlas-traffic": "synthetic" }));
    expect(response.status).toBe(202);
    expect(lastRow().traffic_source).toBe("synthetic");
  });

  it("returns 400 for an invalid event and writes nothing", async () => {
    const response = await POST(post({ ...validBody, event_type: "button_clicked" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "USAGE_EVENT_INVALID", retryable: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await POST(post("{not json"));
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 413 for a body over 2 KB and writes nothing", async () => {
    const big = { ...validBody, properties: { path: `/${"a".repeat(MAX_BODY_BYTES)}` } };
    const response = await POST(post(big));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "USAGE_EVENT_TOO_LARGE" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized body without content-length (streamed)", async () => {
    const chunk = new TextEncoder().encode("a".repeat(1024));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 3; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/events", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect((await POST(request)).status).toBe(413);
  });

  it("still returns 202 when BigQuery is down, logging only a code", async () => {
    insert.mockRejectedValue(new Error("Could not load the default credentials"));
    const response = await POST(post(validBody));
    expect(response.status).toBe(202);
    expect(console.error).toHaveBeenCalledWith(
      JSON.stringify({ severity: "ERROR", event: "usage_event_sink_failed", code: "SINK_UNAVAILABLE" }),
    );
  });
});
