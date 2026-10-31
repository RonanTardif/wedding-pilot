import { createGetDayProgramme } from "@/event-programme/application/get-day-programme";
import { JsonEventRepositoryAdapter } from "@/event-programme/adapters/outbound/json-event-repository-adapter";
import { createListVenues } from "@/venues/application/list-venues";
import { JsonVenueRepositoryAdapter } from "@/venues/adapters/outbound/json-venue-repository-adapter";
import { HomeContent } from "./home-content";
import { loadHomeData } from "./load-home-data";

// The highlighted step depends on the current time: render on every request.
export const dynamic = "force-dynamic";

const getDayProgramme = createGetDayProgramme(new JsonEventRepositoryAdapter());
const listVenues = createListVenues(new JsonVenueRepositoryAdapter());

export default async function HomePage() {
  const now = new Date();
  const { programme, venues } = await loadHomeData(() => getDayProgramme(now), listVenues);
  return <HomeContent programme={programme} venues={venues} />;
}
