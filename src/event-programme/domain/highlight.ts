import { sortStepsChronologically, type ProgrammeStep } from "./programme-step";

export type HighlightKind = "current" | "next";

export interface StepHighlight {
  readonly stepId: string;
  readonly kind: HighlightKind;
}

/**
 * Picks the step a guest should look at, at instant `now`:
 * - the first step (chronologically) with start <= now < end is "current";
 * - otherwise the first step starting after `now` is "next";
 * - otherwise (the day is over) nothing is highlighted.
 */
export function highlightStep(steps: readonly ProgrammeStep[], now: Date): StepHighlight | null {
  const sorted = sortStepsChronologically(steps);
  const t = now.getTime();

  const current = sorted.find((step) => step.start.getTime() <= t && t < step.end.getTime());
  if (current) return { stepId: current.id, kind: "current" };

  const next = sorted.find((step) => step.start.getTime() > t);
  if (next) return { stepId: next.id, kind: "next" };

  return null;
}
