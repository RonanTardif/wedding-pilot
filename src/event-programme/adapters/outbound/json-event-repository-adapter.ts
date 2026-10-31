import { z } from "zod";
import { EventRepositoryError, type EventRepositoryPort } from "../../application/event-repository-port";
import type { WeddingEvent } from "../../domain/event";
import eventData from "./event.json";

const nonEmpty = z.string().trim().min(1);
// ISO 8601 date-time with an explicit offset (or Z), e.g. 2027-06-19T15:00:00+02:00.
const instant = z.iso.datetime({ offset: true });
// Opaque venue reference (kebab-case); this context never resolves it.
const venueId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "venueId must be kebab-case");

const stepSchema = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    start: instant,
    end: instant,
    description: nonEmpty.optional(),
    venueId: venueId.optional(),
  })
  .refine((step) => Date.parse(step.end) > Date.parse(step.start), {
    message: "end must be after start",
    path: ["end"],
  });

const eventSchema = z.object({
  coupleNames: nonEmpty,
  date: z.iso.date(),
  mainVenueLabel: nonEmpty,
  steps: z
    .array(stepSchema)
    .min(1)
    .refine((steps) => new Set(steps.map((s) => s.id)).size === steps.length, {
      message: "step ids must be unique",
    }),
});

/** Reads the (fictional) event from a JSON document, validated at this boundary. */
export class JsonEventRepositoryAdapter implements EventRepositoryPort {
  /** @param raw parsed JSON; defaults to the bundled `event.json`. */
  constructor(private readonly raw: unknown = eventData) {}

  async getEvent(): Promise<WeddingEvent> {
    const parsed = eventSchema.safeParse(this.raw);
    if (!parsed.success) {
      const where = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
      throw new EventRepositoryError("EVENT_DATA_INVALID", `Invalid event data at: ${where}`);
    }
    const data = parsed.data;
    return {
      coupleNames: data.coupleNames,
      date: data.date,
      mainVenueLabel: data.mainVenueLabel,
      steps: data.steps.map((step) => ({
        id: step.id,
        title: step.title,
        start: new Date(step.start),
        end: new Date(step.end),
        ...(step.description === undefined ? {} : { description: step.description }),
        ...(step.venueId === undefined ? {} : { venueId: step.venueId }),
      })),
    };
  }
}
