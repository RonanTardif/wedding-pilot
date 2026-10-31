import { BigQuery } from "@google-cloud/bigquery";
import { UsageEventSinkError, type UsageEventSinkPort } from "../../application/usage-event-sink-port";
import type { UsageEvent } from "../../domain/usage-event";

/** The subset of a BigQuery table this adapter uses (mockable in tests). */
export interface BigQueryInsertTable {
  insert(rows: unknown[], options: { raw: true }): Promise<unknown>;
}

export interface BigQueryUsageEventSinkOptions {
  readonly projectId: string;
  readonly datasetId?: string;
  readonly tableId?: string;
}

/** A row of `analytics.events`: JSON columns are sent as JSON strings (streaming insert). */
export function toEventsRow(event: UsageEvent) {
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    product_id: event.product_id,
    occurred_at: event.occurred_at,
    session_id: event.session_id,
    anonymous_user_id: event.anonymous_user_id,
    traffic_source: event.traffic_source,
    properties: JSON.stringify(event.properties),
    consent_context: JSON.stringify(event.consent_context),
    schema_version: event.schema_version,
  };
}

function isPartialFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "PartialFailureError";
}

/**
 * Streams usage events into BigQuery `<project>.analytics.events`, with `insertId = event_id`
 * so a retried insert is deduplicated. Credentials come from the runtime service account (ADC).
 */
export class BigQueryUsageEventSinkAdapter implements UsageEventSinkPort {
  private table: BigQueryInsertTable | undefined;

  /** @param tableFactory overridable in tests; by default a lazily created BigQuery client. */
  constructor(
    private readonly options: BigQueryUsageEventSinkOptions,
    private readonly tableFactory: () => BigQueryInsertTable = () =>
      new BigQuery({ projectId: options.projectId })
        .dataset(options.datasetId ?? "analytics")
        .table(options.tableId ?? "events"),
  ) {}

  async write(event: UsageEvent): Promise<void> {
    try {
      this.table ??= this.tableFactory();
      await this.table.insert([{ insertId: event.event_id, json: toEventsRow(event) }], { raw: true });
    } catch (error) {
      // Error details may echo row content: keep only a code (no payload in logs).
      if (isPartialFailure(error)) {
        throw new UsageEventSinkError("SINK_ROW_REJECTED", "BigQuery rejected the row", false);
      }
      throw new UsageEventSinkError("SINK_UNAVAILABLE", "BigQuery insert failed", true);
    }
  }
}
