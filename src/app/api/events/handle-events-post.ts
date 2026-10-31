import type { RecordUsageEvent } from "../../../usage-analytics/application/record-usage-event";
import { TRAFFIC_HEADER } from "../../../usage-analytics/domain/usage-event";

/** Largest accepted request body, in bytes. */
export const MAX_BODY_BYTES = 2048;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ code, message, retryable: false }, { status, headers: NO_STORE });
}

/** Reads at most `limit` bytes of the body; null when it is larger (stops reading early). */
async function readBodyWithLimit(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * `POST /api/events`: 202 when the event is valid (even if the sink is down), 400 when invalid, 413 when too large.
 * Only the body and the traffic header are read: never the IP, user agent, referrer or cookies.
 */
export function createEventsPostHandler(recordUsageEvent: RecordUsageEvent) {
  return async function POST(request: Request): Promise<Response> {
    const text = await readBodyWithLimit(request, MAX_BODY_BYTES);
    if (text === null) {
      recordUsageEvent.reject("too_large");
      return errorResponse(413, "USAGE_EVENT_TOO_LARGE", `Body exceeds ${MAX_BODY_BYTES} bytes`);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      recordUsageEvent.reject("invalid");
      return errorResponse(400, "USAGE_EVENT_INVALID", "Body is not valid JSON");
    }

    const result = await recordUsageEvent.record({ body, trafficHeader: request.headers.get(TRAFFIC_HEADER) });
    if (result.status === "rejected") {
      return errorResponse(400, "USAGE_EVENT_INVALID", "Event does not match the usage event contract");
    }
    return Response.json({ status: "accepted" }, { status: 202, headers: NO_STORE });
  };
}
