import type { StepHighlight } from "../domain/highlight";
import { highlightStep } from "../domain/highlight";
import { sortStepsChronologically, type ProgrammeStep } from "../domain/programme-step";
import type { EventRepositoryPort } from "./event-repository-port";

export interface DayProgramme {
  readonly coupleNames: string;
  readonly date: string;
  readonly mainVenueLabel: string;
  /** Chronological order. */
  readonly steps: readonly ProgrammeStep[];
  readonly highlight: StepHighlight | null;
}

export type GetDayProgramme = (now: Date) => Promise<DayProgramme>;

/** Use case: the day's programme with the step to highlight at instant `now`. */
export function createGetDayProgramme(repository: EventRepositoryPort): GetDayProgramme {
  return async function getDayProgramme(now: Date): Promise<DayProgramme> {
    const event = await repository.getEvent();
    return {
      coupleNames: event.coupleNames,
      date: event.date,
      mainVenueLabel: event.mainVenueLabel,
      steps: sortStepsChronologically(event.steps),
      highlight: highlightStep(event.steps, now),
    };
  };
}
