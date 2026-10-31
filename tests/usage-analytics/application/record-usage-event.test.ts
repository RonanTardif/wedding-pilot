import { describe, expect, it } from "vitest";
import { createRecordUsageEvent } from "../../../src/usage-analytics/application/record-usage-event";
import { UsageEventSinkError, type UsageEventSinkPort } from "../../../src/usage-analytics/application/usage-event-sink-port";
import { AjvUsageEventValidatorAdapter } from "../../../src/usage-analytics/adapters/outbound/ajv-usage-event-validator-adapter";
import { InMemoryUsageEventSinkAdapter } from "../../../src/usage-analytics/adapters/outbound/in-memory-usage-event-sink-adapter";

const ULID = "01JBCDEFGHJKMNPQRSTVWXYZ00";
const NOW = new Date("2027-05-08T14:00:00.000Z");

const pageViewed = {
  event_type: "page_viewed",
  properties: { path: "/" },
  session_id: "session-token-1",
  anonymous_user_id: "user-token-1",
};

function setup(sink: UsageEventSinkPort = new InMemoryUsageEventSinkAdapter(), sinkTimeoutMs?: number) {
  const logs: Record<string, unknown>[] = [];
  const recordUsageEvent = createRecordUsageEvent({
    sink,
    validator: new AjvUsageEventValidatorAdapter(),
    now: () => NOW,
    newUlid: () => ULID,
    log: (line) => logs.push(JSON.parse(line) as Record<string, unknown>),
    sinkTimeoutMs,
  });
  return { recordUsageEvent, logs };
}

describe("recordUsageEvent", () => {
  it("writes a page_viewed event as real traffic", async () => {
    const sink = new InMemoryUsageEventSinkAdapter();
    const { recordUsageEvent, logs } = setup(sink);
    const result = await recordUsageEvent.record({ body: pageViewed, trafficHeader: null });
    expect(result).toMatchObject({ status: "accepted", written: true });
    expect(sink.events).toEqual([
      {
        event_id: `evt_${ULID}`,
        event_type: "page_viewed",
        product_id: "wedding-pilot",
        occurred_at: "2027-05-08T14:00:00.000Z",
        session_id: "session-token-1",
        anonymous_user_id: "user-token-1",
        traffic_source: "real",
        properties: { path: "/" },
        consent_context: { analytics: "anonymous" },
        schema_version: 1,
      },
    ]);
    expect(logs).toEqual([]);
  });

  it("writes programme_viewed with its highlighted step kind, as synthetic traffic when the header says so", async () => {
    const sink = new InMemoryUsageEventSinkAdapter();
    const { recordUsageEvent } = setup(sink);
    await recordUsageEvent.record({
      body: { ...pageViewed, event_type: "programme_viewed", properties: { highlighted_step_kind: "next" } },
      trafficHeader: "synthetic",
    });
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      event_type: "programme_viewed",
      properties: { highlighted_step_kind: "next" },
      traffic_source: "synthetic",
    });
  });

  it.each([
    ["an unknown event type", { ...pageViewed, event_type: "button_clicked" }],
    ["an extra property", { ...pageViewed, properties: { path: "/", referrer: "https://example.com" } }],
    ["free text in a property", { ...pageViewed, properties: { path: "/Bonjour Alix, merci !" } }],
    ["a path the pilot does not serve", { ...pageViewed, properties: { path: "/merci-alix-et-noe" } }],
    ["a bad token", { ...pageViewed, session_id: "has spaces in it" }],
    ["a too short token", { ...pageViewed, anonymous_user_id: "short" }],
    ["an extra top-level field", { ...pageViewed, user_agent: "Mozilla/5.0" }],
    ["page_viewed properties on programme_viewed", { ...pageViewed, event_type: "programme_viewed" }],
    ["a bad highlighted step kind", { ...pageViewed, event_type: "programme_viewed", properties: { highlighted_step_kind: "later" } }],
    ["a non-object body", "page_viewed"],
  ])("rejects %s, counts it and writes nothing", async (_label, body) => {
    const sink = new InMemoryUsageEventSinkAdapter();
    const { recordUsageEvent, logs } = setup(sink);
    const result = await recordUsageEvent.record({ body, trafficHeader: null });
    expect(result).toEqual({ status: "rejected", reason: "invalid" });
    expect(sink.events).toEqual([]);
    expect(logs).toEqual([{ severity: "WARNING", event: "usage_event_rejected", reason: "invalid", rejected_count: 1 }]);
  });

  it("keeps a running count of rejections, without payload", async () => {
    const { recordUsageEvent, logs } = setup();
    await recordUsageEvent.record({ body: { ...pageViewed, event_type: "nope" }, trafficHeader: null });
    recordUsageEvent.reject("too_large");
    expect(logs.map((l) => [l.reason, l.rejected_count])).toEqual([
      ["invalid", 1],
      ["too_large", 2],
    ]);
    expect(JSON.stringify(logs)).not.toContain("session-token-1");
  });

  it("accepts the event but logs only a code when the sink fails", async () => {
    const failing: UsageEventSinkPort = {
      write: () => Promise.reject(new UsageEventSinkError("SINK_UNAVAILABLE", "down", true)),
    };
    const { recordUsageEvent, logs } = setup(failing);
    const result = await recordUsageEvent.record({ body: pageViewed, trafficHeader: null });
    expect(result).toMatchObject({ status: "accepted", written: false });
    expect(logs).toEqual([{ severity: "ERROR", event: "usage_event_sink_failed", code: "SINK_UNAVAILABLE" }]);
  });

  it("maps unexpected sink errors to UNEXPECTED", async () => {
    const failing: UsageEventSinkPort = { write: () => Promise.reject(new Error("boom with payload")) };
    const { recordUsageEvent, logs } = setup(failing);
    await recordUsageEvent.record({ body: pageViewed, trafficHeader: null });
    expect(logs).toEqual([{ severity: "ERROR", event: "usage_event_sink_failed", code: "UNEXPECTED" }]);
  });

  it("gives up on a hanging sink after the timeout", async () => {
    const hanging: UsageEventSinkPort = { write: () => new Promise(() => undefined) };
    const { recordUsageEvent, logs } = setup(hanging, 10);
    const result = await recordUsageEvent.record({ body: pageViewed, trafficHeader: null });
    expect(result).toMatchObject({ status: "accepted", written: false });
    expect(logs).toEqual([{ severity: "ERROR", event: "usage_event_sink_failed", code: "SINK_TIMEOUT" }]);
  });
});
