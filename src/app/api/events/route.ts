// Inbound adapter: usage events from the page (and from the Factory's synthetic visitors).
import { ulid } from "ulid";
import { createRecordUsageEvent } from "../../../usage-analytics/application/record-usage-event";
import { AjvUsageEventValidatorAdapter } from "../../../usage-analytics/adapters/outbound/ajv-usage-event-validator-adapter";
import { BigQueryUsageEventSinkAdapter } from "../../../usage-analytics/adapters/outbound/big-query-usage-event-sink-adapter";
import { createEventsPostHandler } from "./handle-events-post";

export const dynamic = "force-dynamic";

const ANALYTICS_PROJECT_ID = "atlas-wedding-pilot-rt";

const recordUsageEvent = createRecordUsageEvent({
  sink: new BigQueryUsageEventSinkAdapter({ projectId: ANALYTICS_PROJECT_ID }),
  validator: new AjvUsageEventValidatorAdapter(),
  now: () => new Date(),
  newUlid: () => ulid(),
});

export const POST = createEventsPostHandler(recordUsageEvent);
