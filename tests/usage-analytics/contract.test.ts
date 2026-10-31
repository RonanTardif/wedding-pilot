import Ajv2020 from "ajv/dist/2020";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import usageEventSchema from "../../contracts/usage-event.v1.json";
import {
  buildCandidateEvent,
  eventIdFromUlid,
  HIGHLIGHTED_STEP_KINDS,
  parseClientInput,
  type TrafficSource,
} from "../../src/usage-analytics/domain/usage-event";

// An independent validator (not the app's adapter): the vendored Factory contract is the judge.
const ajv = new Ajv2020({ strict: true, allErrors: true });
ajv.addFormat("date-time", { type: "string", validate: (value: string) => !Number.isNaN(Date.parse(value)) });
const validate = ajv.compile(usageEventSchema);

const tokens = { session_id: crypto.randomUUID(), anonymous_user_id: "0123456789abcdef0123456789abcdef" };

/** Every client body the app's beacon can send. */
const clientBodies = [
  { event_type: "page_viewed", properties: { path: "/" }, ...tokens },
  { event_type: "programme_viewed", properties: {}, ...tokens },
  ...HIGHLIGHTED_STEP_KINDS.map((kind) => ({
    event_type: "programme_viewed",
    properties: { highlighted_step_kind: kind },
    ...tokens,
  })),
];

function build(body: unknown, trafficSource: TrafficSource) {
  const input = parseClientInput(body);
  if (!input) throw new Error("client body rejected by the shape check");
  return buildCandidateEvent(input, { eventId: eventIdFromUlid(ulid()), occurredAt: new Date(), trafficSource });
}

describe("usage events vs the vendored Factory contract (contracts/usage-event.v1.json)", () => {
  for (const trafficSource of ["real", "synthetic"] as const) {
    it.each(clientBodies.map((body) => [`${body.event_type} ${JSON.stringify(body.properties)}`, body]))(
      `%s (${trafficSource}) validates`,
      (_label, body) => {
        const event = build(body, trafficSource);
        expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
      },
    );
  }

  it("rejects an event with an extra property", () => {
    const event = build({ event_type: "page_viewed", properties: { path: "/", extra: "x" }, ...tokens }, "real");
    expect(validate(event)).toBe(false);
  });

  it("rejects an envelope with an extra top-level field", () => {
    const event = { ...build(clientBodies[0], "real"), ip: "203.0.113.1" };
    expect(validate(event)).toBe(false);
  });
});
