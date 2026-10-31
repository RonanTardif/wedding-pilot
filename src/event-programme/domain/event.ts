import type { ProgrammeStep } from "./programme-step";

/** The (fictional) wedding: who, which day, where, and the day's steps. */
export interface WeddingEvent {
  /** Display name of the couple, e.g. "Inès & Gaspard". */
  readonly coupleNames: string;
  /** Calendar day of the wedding, ISO 8601 date (YYYY-MM-DD), in the event's local time zone. */
  readonly date: string;
  /** Label of the main venue (venue details belong to the `venues` context). */
  readonly mainVenueLabel: string;
  readonly steps: readonly ProgrammeStep[];
}
