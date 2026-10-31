import type { UsageEventSinkPort } from "../../application/usage-event-sink-port";
import type { UsageEvent } from "../../domain/usage-event";

/** Keeps written events in memory (tests, local experiments). */
export class InMemoryUsageEventSinkAdapter implements UsageEventSinkPort {
  readonly events: UsageEvent[] = [];

  async write(event: UsageEvent): Promise<void> {
    this.events.push(event);
  }
}
