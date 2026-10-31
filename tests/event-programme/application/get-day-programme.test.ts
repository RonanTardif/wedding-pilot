import { describe, expect, it } from "vitest";
import type { WeddingEvent } from "../../../src/event-programme/domain/event";
import { EventRepositoryError, type EventRepositoryPort } from "../../../src/event-programme/application/event-repository-port";
import { createGetDayProgramme } from "../../../src/event-programme/application/get-day-programme";

class InMemoryEventRepositoryAdapter implements EventRepositoryPort {
  constructor(private readonly event: WeddingEvent) {}
  async getEvent(): Promise<WeddingEvent> {
    return this.event;
  }
}

const event: WeddingEvent = {
  coupleNames: "Alix & Noé",
  date: "2027-05-08",
  mainVenueLabel: "Ferme des Essais",
  steps: [
    { id: "party", title: "Soirée", start: new Date("2027-05-08T21:00:00+02:00"), end: new Date("2027-05-09T01:00:00+02:00") },
    { id: "welcome", title: "Accueil", start: new Date("2027-05-08T15:00:00+02:00"), end: new Date("2027-05-08T15:30:00+02:00") },
    { id: "dinner", title: "Dîner", start: new Date("2027-05-08T19:00:00+02:00"), end: new Date("2027-05-08T21:00:00+02:00"), venueId: "grange" },
  ],
};

describe("getDayProgramme", () => {
  const getDayProgramme = createGetDayProgramme(new InMemoryEventRepositoryAdapter(event));

  it("returns the event header, the steps in chronological order and the highlight", async () => {
    const programme = await getDayProgramme(new Date("2027-05-08T19:30:00+02:00"));
    expect(programme.coupleNames).toBe("Alix & Noé");
    expect(programme.date).toBe("2027-05-08");
    expect(programme.mainVenueLabel).toBe("Ferme des Essais");
    expect(programme.steps.map((s) => s.id)).toEqual(["welcome", "dinner", "party"]);
    expect(programme.highlight).toEqual({ stepId: "dinner", kind: "current" });
  });

  it("carries each step's optional venueId through unchanged", async () => {
    const programme = await getDayProgramme(new Date("2027-01-01T00:00:00Z"));
    expect(programme.steps.find((s) => s.id === "dinner")?.venueId).toBe("grange");
    expect(programme.steps.find((s) => s.id === "welcome")).not.toHaveProperty("venueId");
  });

  it("highlights the first step as next before the day", async () => {
    expect((await getDayProgramme(new Date("2027-01-01T00:00:00Z"))).highlight).toEqual({ stepId: "welcome", kind: "next" });
  });

  it("highlights nothing after the end of the day", async () => {
    expect((await getDayProgramme(new Date("2027-05-09T01:00:00+02:00"))).highlight).toBeNull();
  });

  it("propagates repository errors", async () => {
    const failing: EventRepositoryPort = {
      getEvent: () => Promise.reject(new EventRepositoryError("EVENT_DATA_INVALID", "broken")),
    };
    await expect(createGetDayProgramme(failing)(new Date())).rejects.toMatchObject({
      code: "EVENT_DATA_INVALID",
      retryable: false,
    });
  });
});
