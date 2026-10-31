import type { DayProgramme as DayProgrammeModel } from "../event-programme/application/get-day-programme";
import { DayProgramme } from "../event-programme/adapters/inbound/day-programme";
import type { ListedVenue } from "../venues/application/list-venues";
import { VenueList } from "../venues/adapters/inbound/venue-list";
import { UsageBeacon } from "../usage-analytics/adapters/inbound/usage-beacon";

/** Venue display names by id: the only thing the programme learns about venues. */
export function buildVenueNameById(venues: readonly ListedVenue[] | null): ReadonlyMap<string, string> {
  return new Map((venues ?? []).map((venue) => [venue.id, venue.name]));
}

/**
 * Composition of the home page: the programme (with venue names resolved here) and the venues.
 * Each part is `null` when it could not be loaded; the other part still renders.
 */
export function HomeContent({
  programme,
  venues,
}: Readonly<{ programme: DayProgrammeModel | null; venues: readonly ListedVenue[] | null }>) {
  return (
    <main>
      {programme ? (
        <DayProgramme programme={programme} venueNameById={buildVenueNameById(venues)} />
      ) : (
        <>
          <h1>Mariage</h1>
          <p role="alert">Le programme est momentanément indisponible.</p>
        </>
      )}
      <VenueList venues={venues} />
      <UsageBeacon path="/" highlightedStepKind={programme ? (programme.highlight?.kind ?? "none") : undefined} />
    </main>
  );
}
