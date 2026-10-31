/**
 * Usage event envelope (AD-11), schema_version 1, as defined by the Factory contract
 * (vendored in `contracts/usage-event.v1.json`). No personal data: no IP, no user agent,
 * no referrer, no free text; session and user ids are random opaque tokens chosen by the browser.
 */

export const PRODUCT_ID = "wedding-pilot";
export const USAGE_EVENT_SCHEMA_VERSION = 1;
export const EVENT_ID_PREFIX = "evt_";
export const USAGE_EVENT_TYPES = ["page_viewed", "programme_viewed"] as const;
export const HIGHLIGHTED_STEP_KINDS = ["current", "next", "none"] as const;
/** Paths the pilot serves: the only values accepted for `page_viewed.properties.path` (no free text). */
export const SERVED_PATHS: readonly string[] = ["/"];
/** Request header set by the Factory's synthetic visitors. */
export const TRAFFIC_HEADER = "x-atlas-traffic";

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];
export type HighlightedStepKind = (typeof HIGHLIGHTED_STEP_KINDS)[number];
export type TrafficSource = "real" | "synthetic";

export interface PageViewedProperties {
  readonly path: string;
}

export interface ProgrammeViewedProperties {
  readonly highlighted_step_kind?: HighlightedStepKind;
}

interface EnvelopeFields {
  readonly event_id: string;
  readonly product_id: typeof PRODUCT_ID;
  /** ISO 8601 UTC, server time. */
  readonly occurred_at: string;
  readonly session_id: string;
  readonly anonymous_user_id: string;
  readonly traffic_source: TrafficSource;
  readonly consent_context: { readonly analytics: "anonymous" };
  readonly schema_version: typeof USAGE_EVENT_SCHEMA_VERSION;
}

export type UsageEvent =
  | (EnvelopeFields & { readonly event_type: "page_viewed"; readonly properties: PageViewedProperties })
  | (EnvelopeFields & { readonly event_type: "programme_viewed"; readonly properties: ProgrammeViewedProperties });

/** What the browser is allowed to send: exactly these fields, nothing else. */
export const CLIENT_FIELDS = ["event_type", "properties", "session_id", "anonymous_user_id"] as const;
type ClientField = (typeof CLIENT_FIELDS)[number];

/** Client input after the shape check; values are still untrusted (the schema validates them). */
export type ClientUsageEventInput = Readonly<Record<ClientField, unknown>>;

/** Server-side context of an event: never taken from the client body. */
export interface ServerEventContext {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly trafficSource: TrafficSource;
}

/** An envelope built from client input, not yet validated against the contract. */
export type CandidateUsageEvent = Readonly<Record<string, unknown>>;

/** `synthetic` iff the traffic header says so, else `real`. */
export function trafficSourceFromHeader(value: string | null | undefined): TrafficSource {
  return value?.trim().toLowerCase() === "synthetic" ? "synthetic" : "real";
}

/** Prefixed event id from a ULID. */
export function eventIdFromUlid(ulid: string): string {
  return `${EVENT_ID_PREFIX}${ulid}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Shape check of the client body: an object with exactly the client fields (all present, no extra one),
 * and, for `page_viewed`, a `path` among `SERVED_PATHS`.
 * Returns null otherwise, e.g. when the client tries to set `traffic_source` or adds any other field.
 */
export function parseClientInput(body: unknown): ClientUsageEventInput | null {
  if (!isPlainObject(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== CLIENT_FIELDS.length) return null;
  if (!CLIENT_FIELDS.every((field) => Object.hasOwn(body, field))) return null;
  if (body.event_type === "page_viewed") {
    const path = isPlainObject(body.properties) ? body.properties.path : undefined;
    if (typeof path !== "string" || !SERVED_PATHS.includes(path)) return null;
  }
  return {
    event_type: body.event_type,
    properties: body.properties,
    session_id: body.session_id,
    anonymous_user_id: body.anonymous_user_id,
  };
}

/** Builds the full envelope: client fields as given, everything else from the server context. */
export function buildCandidateEvent(input: ClientUsageEventInput, context: ServerEventContext): CandidateUsageEvent {
  return {
    event_id: context.eventId,
    event_type: input.event_type,
    product_id: PRODUCT_ID,
    occurred_at: context.occurredAt.toISOString(),
    session_id: input.session_id,
    anonymous_user_id: input.anonymous_user_id,
    traffic_source: context.trafficSource,
    properties: input.properties,
    consent_context: { analytics: "anonymous" },
    schema_version: USAGE_EVENT_SCHEMA_VERSION,
  };
}
