import { createGetDayProgramme } from "@/event-programme/application/get-day-programme";
import { JsonEventRepositoryAdapter } from "@/event-programme/adapters/outbound/json-event-repository-adapter";
import { createListVenues } from "@/venues/application/list-venues";
import { JsonVenueRepositoryAdapter } from "@/venues/adapters/outbound/json-venue-repository-adapter";
import { createListComments } from "@/comments/application/comment-wall";
import { CommentWall } from "@/comments/adapters/inbound/comment-wall";
import { commentWall } from "./comment-wall-instance";
import { HomeContent } from "./home-content";
import { loadHomeData } from "./load-home-data";

// The highlighted step depends on the current time: render on every request.
export const dynamic = "force-dynamic";

const getDayProgramme = createGetDayProgramme(new JsonEventRepositoryAdapter());
const listVenues = createListVenues(new JsonVenueRepositoryAdapter());
const listComments = createListComments(commentWall.repository);

export default async function HomePage({ searchParams }: Readonly<{ searchParams: Promise<{ comment?: string }> }>) {
  const now = new Date();
  const [{ programme, venues }, comments, query] = await Promise.all([
    loadHomeData(() => getDayProgramme(now), listVenues),
    listComments().catch(() => null),
    searchParams,
  ]);
  return (
    <HomeContent
      programme={programme}
      venues={venues}
      comments={<CommentWall comments={comments} action="/api/comments" failed={query.comment === "invalid"} />}
    />
  );
}
