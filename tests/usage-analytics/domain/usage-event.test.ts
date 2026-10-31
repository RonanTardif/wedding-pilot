import { describe, expect, it } from "vitest";
import {
  buildCandidateEvent,
  eventIdFromUlid,
  parseClientInput,
  trafficSourceFromHeader,
} from "../../../src/usage-analytics/domain/usage-event";

const clientBody = {
  event_type: "page_viewed",
  properties: { path: "/" },
  session_id: "session-token-1",
  anonymous_user_id: "user-token-1",
};

describe("trafficSourceFromHeader", () => {
  it("is synthetic only when the header says synthetic", () => {
    expect(trafficSourceFromHeader("synthetic")).toBe("synthetic");
    expect(trafficSourceFromHeader(" Synthetic ")).toBe("synthetic");
    expect(trafficSourceFromHeader(null)).toBe("real");
    expect(trafficSourceFromHeader(undefined)).toBe("real");
    expect(trafficSourceFromHeader("")).toBe("real");
    expect(trafficSourceFromHeader("real")).toBe("real");
    expect(trafficSourceFromHeader("synthetic, real")).toBe("real");
  });
});

describe("eventIdFromUlid", () => {
  it("prefixes with evt_", () => {
    expect(eventIdFromUlid("01JBCDEFGHJKMNPQRSTVWXYZ00")).toBe("evt_01JBCDEFGHJKMNPQRSTVWXYZ00");
  });
});

describe("parseClientInput", () => {
  it("accepts exactly the client fields", () => {
    expect(parseClientInput(clientBody)).toEqual(clientBody);
  });

  it.each([
    ["null", null],
    ["an array", [clientBody]],
    ["a string", "page_viewed"],
    ["a missing field", { event_type: "page_viewed", properties: {}, session_id: "session-token-1" }],
    ["an extra field", { ...clientBody, ip: "203.0.113.1" }],
    ["a client-chosen traffic source", { ...clientBody, traffic_source: "synthetic" }],
    ["a client-chosen event id", { ...clientBody, event_id: "evt_x" }],
  ])("rejects %s", (_label, body) => {
    expect(parseClientInput(body)).toBeNull();
  });
});

describe("buildCandidateEvent", () => {
  it("takes server-side fields from the context, never from the client", () => {
    const input = parseClientInput(clientBody);
    if (!input) throw new Error("client body rejected");
    const event = buildCandidateEvent(input, {
      eventId: "evt_01JBCDEFGHJKMNPQRSTVWXYZ00",
      occurredAt: new Date("2027-05-08T14:00:00.000Z"),
      trafficSource: "synthetic",
    });
    expect(event).toEqual({
      event_id: "evt_01JBCDEFGHJKMNPQRSTVWXYZ00",
      event_type: "page_viewed",
      product_id: "wedding-pilot",
      occurred_at: "2027-05-08T14:00:00.000Z",
      session_id: "session-token-1",
      anonymous_user_id: "user-token-1",
      traffic_source: "synthetic",
      properties: { path: "/" },
      consent_context: { analytics: "anonymous" },
      schema_version: 1,
    });
  });
});
