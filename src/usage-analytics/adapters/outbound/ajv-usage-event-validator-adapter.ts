import Ajv2020 from "ajv/dist/2020";
import type { UsageEventValidatorPort } from "../../application/usage-event-validator-port";
import type { CandidateUsageEvent, UsageEvent } from "../../domain/usage-event";
import usageEventSchema from "../../../../contracts/usage-event.v1.json";

/** RFC 3339 UTC date-time; the vendored schema also pins the exact shape with a `pattern`. */
function isUtcDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function compileUsageEventSchema() {
  const ajv = new Ajv2020({ strict: true, allErrors: false });
  ajv.addFormat("date-time", { type: "string", validate: isUtcDateTime });
  return ajv.compile(usageEventSchema);
}

// Compiled once per process.
let validateUsageEvent: ReturnType<typeof compileUsageEventSchema> | undefined;

/** Validates envelopes against the vendored Factory contract `contracts/usage-event.v1.json`. */
export class AjvUsageEventValidatorAdapter implements UsageEventValidatorPort {
  isValid(candidate: CandidateUsageEvent): candidate is CandidateUsageEvent & UsageEvent {
    validateUsageEvent ??= compileUsageEventSchema();
    return validateUsageEvent(candidate) === true;
  }
}
