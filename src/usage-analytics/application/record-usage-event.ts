import {
  buildCandidateEvent,
  eventIdFromUlid,
  parseClientInput,
  trafficSourceFromHeader,
  type UsageEvent,
} from "../domain/usage-event";
import { UsageEventSinkError, type UsageEventSinkPort } from "./usage-event-sink-port";
import type { UsageEventValidatorPort } from "./usage-event-validator-port";

export type RejectionReason = "invalid" | "too_large";

export type RecordResult =
  | { readonly status: "accepted"; readonly event: UsageEvent; readonly written: boolean }
  | { readonly status: "rejected"; readonly reason: RejectionReason };

export interface RecordUsageEventInput {
  /** Parsed JSON body sent by the browser (untrusted). */
  readonly body: unknown;
  /** Value of the `x-atlas-traffic` request header, if any. */
  readonly trafficHeader: string | null;
}

export interface RecordUsageEvent {
  record(input: RecordUsageEventInput): Promise<RecordResult>;
  /** Counts and logs a request rejected before parsing (body too large or not JSON). */
  reject(reason: RejectionReason): RecordResult;
}

export interface RecordUsageEventDeps {
  readonly sink: UsageEventSinkPort;
  readonly validator: UsageEventValidatorPort;
  readonly now: () => Date;
  /** A fresh ULID (the `evt_` prefix is added here). */
  readonly newUlid: () => string;
  /** One structured JSON line per call; never receives event payloads. */
  readonly log?: (line: string) => void;
  /** Upper bound on a sink write; past it the event is dropped (the client still gets accepted). */
  readonly sinkTimeoutMs?: number;
}

const DEFAULT_SINK_TIMEOUT_MS = 4000;

function withTimeout(write: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UsageEventSinkError("SINK_TIMEOUT", `sink write exceeded ${ms} ms`, true)), ms);
  });
  return Promise.race([write, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Use case: build the AD-11 envelope from client input and server context, validate it against the contract,
 * write it to the sink. Invalid events are counted and logged (count only), never written.
 * Sink failures are logged (code only) and swallowed: analytics never breaks the page.
 */
export function createRecordUsageEvent(deps: RecordUsageEventDeps): RecordUsageEvent {
  const log = deps.log ?? ((line: string) => console.error(line));
  const sinkTimeoutMs = deps.sinkTimeoutMs ?? DEFAULT_SINK_TIMEOUT_MS;
  let rejectedCount = 0;

  function reject(reason: RejectionReason): RecordResult {
    rejectedCount += 1;
    log(JSON.stringify({ severity: "WARNING", event: "usage_event_rejected", reason, rejected_count: rejectedCount }));
    return { status: "rejected", reason };
  }

  async function record({ body, trafficHeader }: RecordUsageEventInput): Promise<RecordResult> {
    const input = parseClientInput(body);
    if (!input) return reject("invalid");

    const candidate = buildCandidateEvent(input, {
      eventId: eventIdFromUlid(deps.newUlid()),
      occurredAt: deps.now(),
      trafficSource: trafficSourceFromHeader(trafficHeader),
    });
    if (!deps.validator.isValid(candidate)) return reject("invalid");
    const event: UsageEvent = candidate;

    try {
      await withTimeout(deps.sink.write(event), sinkTimeoutMs);
      return { status: "accepted", event, written: true };
    } catch (error) {
      const code = error instanceof UsageEventSinkError ? error.code : "UNEXPECTED";
      log(JSON.stringify({ severity: "ERROR", event: "usage_event_sink_failed", code }));
      return { status: "accepted", event, written: false };
    }
  }

  return { record, reject };
}
