import { describe, expect, it } from "vitest";
import { highlightStep } from "../../../src/event-programme/domain/highlight";
import { sortStepsChronologically, type ProgrammeStep } from "../../../src/event-programme/domain/programme-step";

const step = (id: string, start: string, end: string): ProgrammeStep => ({
  id,
  title: id,
  start: new Date(start),
  end: new Date(end),
});

const welcome = step("welcome", "2027-06-19T14:30:00+02:00", "2027-06-19T15:00:00+02:00");
const ceremony = step("ceremony", "2027-06-19T15:00:00+02:00", "2027-06-19T16:00:00+02:00");
const dinner = step("dinner", "2027-06-19T19:30:00+02:00", "2027-06-19T22:30:00+02:00");
const steps = [welcome, ceremony, dinner];

const at = (iso: string) => new Date(iso);

describe("highlightStep", () => {
  it("highlights the first step as next before the day starts", () => {
    expect(highlightStep(steps, at("2027-06-19T09:00:00+02:00"))).toEqual({ stepId: "welcome", kind: "next" });
  });

  it("highlights the running step as current (start inclusive)", () => {
    expect(highlightStep(steps, at("2027-06-19T15:00:00+02:00"))).toEqual({ stepId: "ceremony", kind: "current" });
    expect(highlightStep(steps, at("2027-06-19T15:59:59+02:00"))).toEqual({ stepId: "ceremony", kind: "current" });
  });

  it("highlights the following step as next between two steps (end exclusive)", () => {
    expect(highlightStep(steps, at("2027-06-19T16:00:00+02:00"))).toEqual({ stepId: "dinner", kind: "next" });
    expect(highlightStep(steps, at("2027-06-19T19:00:00+02:00"))).toEqual({ stepId: "dinner", kind: "next" });
  });

  it("highlights nothing once the last step has ended", () => {
    expect(highlightStep(steps, at("2027-06-19T22:30:00+02:00"))).toBeNull();
    expect(highlightStep(steps, at("2027-06-20T10:00:00+02:00"))).toBeNull();
  });

  it("evaluates unsorted steps in chronological order", () => {
    const unsorted = [dinner, ceremony, welcome];
    expect(highlightStep(unsorted, at("2027-06-19T08:00:00+02:00"))).toEqual({ stepId: "welcome", kind: "next" });
    expect(highlightStep(unsorted, at("2027-06-19T17:00:00+02:00"))).toEqual({ stepId: "dinner", kind: "next" });
  });

  it("compares instants, whatever the offset of the input", () => {
    // 13:15 UTC = 15:15 in Paris (CEST), during the ceremony.
    expect(highlightStep(steps, at("2027-06-19T13:15:00Z"))).toEqual({ stepId: "ceremony", kind: "current" });
  });

  it("highlights nothing when there are no steps", () => {
    expect(highlightStep([], at("2027-06-19T15:00:00+02:00"))).toBeNull();
  });
});

describe("sortStepsChronologically", () => {
  it("sorts by start without mutating the input", () => {
    const unsorted = [dinner, welcome, ceremony];
    expect(sortStepsChronologically(unsorted).map((s) => s.id)).toEqual(["welcome", "ceremony", "dinner"]);
    expect(unsorted.map((s) => s.id)).toEqual(["dinner", "welcome", "ceremony"]);
  });
});
