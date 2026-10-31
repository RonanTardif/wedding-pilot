import { describe, expect, it, vi } from "vitest";
import { UsageEventSinkError } from "../../application/usage-event-sink-port";
import type { UsageEvent } from "../../domain/usage-event";
import { BigQueryUsageEventSinkAdapter, type BigQueryInsertTable } from "./big-query-usage-event-sink-adapter";

vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn(function BigQuery() {
    throw new Error("the real BigQuery client must not be created in tests");
  }),
}));

const event: UsageEvent = {
  event_id: "evt_01JBCDEFGHJKMNPQRSTVWXYZ00",
  event_type: "programme_viewed",
  product_id: "wedding-pilot",
  occurred_at: "2027-05-08T14:00:00.000Z",
  session_id: "session-token-1",
  anonymous_user_id: "user-token-1",
  traffic_source: "real",
  properties: { highlighted_step_kind: "current" },
  consent_context: { analytics: "anonymous" },
  schema_version: 1,
};

function adapterWith(insert: BigQueryInsertTable["insert"]) {
  const factory = vi.fn(() => ({ insert }));
  return { adapter: new BigQueryUsageEventSinkAdapter({ projectId: "test-project" }, factory), factory };
}

describe("BigQueryUsageEventSinkAdapter", () => {
  it("inserts one raw row with insertId = event_id and JSON columns as strings", async () => {
    const insert = vi.fn<BigQueryInsertTable["insert"]>().mockResolvedValue([{}]);
    const { adapter, factory } = adapterWith(insert);
    await adapter.write(event);
    await adapter.write(event);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      [
        {
          insertId: "evt_01JBCDEFGHJKMNPQRSTVWXYZ00",
          json: {
            event_id: "evt_01JBCDEFGHJKMNPQRSTVWXYZ00",
            event_type: "programme_viewed",
            product_id: "wedding-pilot",
            occurred_at: "2027-05-08T14:00:00.000Z",
            session_id: "session-token-1",
            anonymous_user_id: "user-token-1",
            traffic_source: "real",
            properties: '{"highlighted_step_kind":"current"}',
            consent_context: '{"analytics":"anonymous"}',
            schema_version: 1,
          },
        },
      ],
      { raw: true },
    );
  });

  it("maps a rejected row to SINK_ROW_REJECTED (not retryable)", async () => {
    const partial = Object.assign(new Error("row errors with payload"), { name: "PartialFailureError" });
    const { adapter } = adapterWith(vi.fn().mockRejectedValue(partial));
    const error = await adapter.write(event).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsageEventSinkError);
    expect(error).toMatchObject({ code: "SINK_ROW_REJECTED", retryable: false });
    expect((error as Error).message).not.toContain("payload");
  });

  it("maps any other failure (no credentials, network) to SINK_UNAVAILABLE", async () => {
    const { adapter } = adapterWith(vi.fn().mockRejectedValue(new Error("Could not load the default credentials")));
    await expect(adapter.write(event)).rejects.toMatchObject({ code: "SINK_UNAVAILABLE", retryable: true });
  });

  it("maps a client construction failure to SINK_UNAVAILABLE", async () => {
    const adapter = new BigQueryUsageEventSinkAdapter({ projectId: "test-project" });
    await expect(adapter.write(event)).rejects.toMatchObject({ code: "SINK_UNAVAILABLE" });
  });
});
