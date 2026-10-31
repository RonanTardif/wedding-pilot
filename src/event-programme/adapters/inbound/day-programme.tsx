import type { DayProgramme as DayProgrammeModel } from "../../application/get-day-programme";

const TIME_ZONE = "Europe/Paris";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const calendarDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

const BADGES = { current: "En cours", next: "Prochaine étape" } as const;

/** Formats an ISO calendar date (YYYY-MM-DD) as a French day, e.g. "samedi 19 juin 2027". */
function formatDay(isoDate: string): string {
  // Noon UTC is the same calendar day in Europe/Paris.
  return dayFormat.format(new Date(`${isoDate}T12:00:00Z`));
}

/** End time, with " (+1 j)" when it falls on a later Europe/Paris calendar day than the start. */
function formatEnd(start: Date, end: Date): string {
  const nextDay = calendarDayFormat.format(end) !== calendarDayFormat.format(start);
  return nextDay ? `${timeFormat.format(end)} (+1 j)` : timeFormat.format(end);
}

const NO_VENUE_NAMES: ReadonlyMap<string, string> = new Map();

/**
 * Server component: event header and the day's timeline, with the current-or-next step highlighted.
 * `venueNameById` (supplied by the composition root) resolves a step's `venueId` to a display name;
 * an unknown or absent `venueId` simply renders no venue.
 */
export function DayProgramme({
  programme,
  venueNameById = NO_VENUE_NAMES,
}: Readonly<{ programme: DayProgrammeModel; venueNameById?: ReadonlyMap<string, string> }>) {
  const { highlight } = programme;
  return (
    <>
      <header className="event-header">
        <h1>{programme.coupleNames}</h1>
        <p className="event-meta">
          <time dateTime={programme.date}>{formatDay(programme.date)}</time>
          <span aria-hidden="true"> · </span>
          <span>{programme.mainVenueLabel}</span>
        </p>
      </header>
      <section aria-labelledby="programme-title">
        <h2 id="programme-title">Programme du jour</h2>
        <ol className="timeline">
          {programme.steps.map((step) => {
            const kind = highlight?.stepId === step.id ? highlight.kind : null;
            const venueName = step.venueId === undefined ? undefined : venueNameById.get(step.venueId);
            return (
              <li
                key={step.id}
                className={kind ? `step step--${kind}` : "step"}
                aria-current={kind ? "step" : undefined}
              >
                <p className="step-time">
                  <time dateTime={step.start.toISOString()}>{timeFormat.format(step.start)}</time>
                  {" – "}
                  <time dateTime={step.end.toISOString()}>{formatEnd(step.start, step.end)}</time>
                  {venueName ? <span className="step-venue">{` · ${venueName}`}</span> : null}
                </p>
                <h3 className="step-title">
                  {step.title}
                  {kind ? (
                    <>
                      {" "}
                      <span className="badge">{BADGES[kind]}</span>
                    </>
                  ) : null}
                </h3>
                {step.description ? <p className="step-description">{step.description}</p> : null}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
