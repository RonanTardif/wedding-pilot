import type { CandidateUsageEvent, UsageEvent } from "../domain/usage-event";

/** Validates a built envelope against the Factory contract (vendored JSON Schema `usage-event.v1.json`). */
export interface UsageEventValidatorPort {
  isValid(candidate: CandidateUsageEvent): candidate is CandidateUsageEvent & UsageEvent;
}
