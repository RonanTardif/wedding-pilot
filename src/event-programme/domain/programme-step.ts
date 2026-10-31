/** One dated step of the wedding day (absolute instants; display time zone is an adapter concern). */
export interface ProgrammeStep {
  readonly id: string;
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly description?: string;
  /** Opaque reference to where the step happens (resolved to a name outside this context). */
  readonly venueId?: string;
}

/** Steps in chronological order (by start, then end, then id), without mutating the input. */
export function sortStepsChronologically(steps: readonly ProgrammeStep[]): ProgrammeStep[] {
  return [...steps].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      a.end.getTime() - b.end.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
