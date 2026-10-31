import { EventRepositoryError } from "../event-programme/application/event-repository-port";
import type { DayProgramme } from "../event-programme/application/get-day-programme";
import type { ListedVenue } from "../venues/application/list-venues";
import { VenueRepositoryError } from "../venues/application/venue-repository-port";

export interface HomeData {
  readonly programme: DayProgramme | null;
  readonly venues: readonly ListedVenue[] | null;
}

type Log = (line: string) => void;

/** Runs `load`; on failure logs one structured JSON line (no personal data) and returns null. */
async function loadOrNull<T>(event: string, load: () => Promise<T>, log: Log): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    // Repository error messages hold schema paths only (no personal data); unexpected errors keep their stack.
    const details =
      error instanceof EventRepositoryError || error instanceof VenueRepositoryError
        ? { code: error.code, message: error.message, retryable: error.retryable }
        : error instanceof Error
          ? { code: "UNEXPECTED", message: error.message, stack: error.stack }
          : { code: "UNEXPECTED", message: String(error) };
    log(JSON.stringify({ severity: "ERROR", event, ...details }));
    return null;
  }
}

/** Loads the programme and the venues in parallel; each falls back to null independently. */
export async function loadHomeData(
  getProgramme: () => Promise<DayProgramme>,
  listVenues: () => Promise<readonly ListedVenue[]>,
  log: Log = (line) => console.error(line),
): Promise<HomeData> {
  const [programme, venues] = await Promise.all([
    loadOrNull("day_programme_unavailable", getProgramme, log),
    loadOrNull("venues_unavailable", listVenues, log),
  ]);
  return { programme, venues };
}
