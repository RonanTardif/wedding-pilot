import { describe, expect, it } from "vitest";
import { EventRepositoryError } from "../../application/event-repository-port";
import { highlightStep } from "../../domain/highlight";
import eventData from "./event.json";
import endBeforeStart from "./fixtures/event-end-before-start.json";
import { JsonEventRepositoryAdapter } from "./json-event-repository-adapter";

const validStep = {
  id: "accueil",
  title: "Accueil",
  start: "2027-05-08T15:00:00+02:00",
  end: "2027-05-08T15:30:00+02:00",
};
const validEvent = { coupleNames: "Alix & Noé", date: "2027-05-08", mainVenueLabel: "Ferme des Essais", steps: [validStep] };

function without(value: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
}

async function expectInvalid(raw: unknown) {
  const error = await new JsonEventRepositoryAdapter(raw).getEvent().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(EventRepositoryError);
  expect(error).toMatchObject({ code: "EVENT_DATA_INVALID", retryable: false });
  expect((error as EventRepositoryError).message).toEqual(expect.any(String));
}

describe("JsonEventRepositoryAdapter", () => {
  it("loads the bundled fictional event", async () => {
    const event = await new JsonEventRepositoryAdapter().getEvent();
    expect(event.coupleNames).toBe(eventData.coupleNames);
    expect(event.date).toMatch(/^2027-/);
    expect(event.mainVenueLabel.length).toBeGreaterThan(0);
    expect(event.steps.length).toBeGreaterThanOrEqual(7);
    expect(event.steps.length).toBeLessThanOrEqual(9);
    for (const step of event.steps) {
      expect(step.start).toBeInstanceOf(Date);
      expect(step.end.getTime()).toBeGreaterThan(step.start.getTime());
    }
    // The wedding is in the future: the first step is "next".
    expect(highlightStep(event.steps, new Date("2026-10-31T12:00:00Z"))).toEqual({
      stepId: eventData.steps[0]?.id,
      kind: "next",
    });
  });

  it("converts ISO instants with offset to Dates and keeps optional descriptions", async () => {
    const event = await new JsonEventRepositoryAdapter({
      ...validEvent,
      steps: [{ ...validStep, description: "Sous le tilleul" }, { ...validStep, id: "b" }],
    }).getEvent();
    expect(event.steps[0]?.start.toISOString()).toBe("2027-05-08T13:00:00.000Z");
    expect(event.steps[0]?.description).toBe("Sous le tilleul");
    expect(event.steps[1]).not.toHaveProperty("description");
  });

  it("throws a typed error when a step ends before it starts (broken fixture)", async () => {
    await expectInvalid(endBeforeStart);
  });

  it("throws a typed error on a zero-length step (end == start)", async () => {
    await expectInvalid({ ...validEvent, steps: [{ ...validStep, end: validStep.start }] });
    // Same instant written with another offset.
    await expectInvalid({ ...validEvent, steps: [{ ...validStep, end: "2027-05-08T13:00:00Z" }] });
  });

  it("throws a typed error on a missing field", async () => {
    await expectInvalid({ ...validEvent, steps: [without(validStep, "title")] });
    await expectInvalid(without(validEvent, "mainVenueLabel"));
  });

  it("throws a typed error on a bad date", async () => {
    await expectInvalid({ ...validEvent, steps: [{ ...validStep, start: "19/06/2027 15:00" }] });
    await expectInvalid({ ...validEvent, steps: [{ ...validStep, start: "2027-05-08T15:00:00" }] }); // no offset
    await expectInvalid({ ...validEvent, date: "2027-02-30" });
  });

  it("throws a typed error on duplicate step ids, no steps, or non-object data", async () => {
    await expectInvalid({ ...validEvent, steps: [validStep, validStep] });
    await expectInvalid({ ...validEvent, steps: [] });
    await expectInvalid(null);
  });
});
