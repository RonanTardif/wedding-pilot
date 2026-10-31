import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeContent } from "../../src/app/home-content";
import { loadHomeData } from "../../src/app/load-home-data";
import { EventRepositoryError } from "../../src/event-programme/application/event-repository-port";
import type { DayProgramme } from "../../src/event-programme/application/get-day-programme";
import type { ListedVenue } from "../../src/venues/application/list-venues";
import { VenueRepositoryError } from "../../src/venues/application/venue-repository-port";

const programme: DayProgramme = {
  coupleNames: "Alix & Noé",
  date: "2027-05-08",
  mainVenueLabel: "Ferme des Essais",
  steps: [{ id: "welcome", title: "Accueil", start: new Date("2027-05-08T13:00:00Z"), end: new Date("2027-05-08T13:30:00Z") }],
  highlight: null,
};

const venues: ListedVenue[] = [
  {
    id: "jardin",
    name: "Jardin des Essais",
    kind: "ceremonie",
    address: "3 rue C, 99000 Nulle-Part",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=3%20rue%20C%2C%2099000%20Nulle-Part",
  },
];

async function loadAndRender(getProgramme: () => Promise<DayProgramme>, listVenues: () => Promise<readonly ListedVenue[]>) {
  const lines: string[] = [];
  const data = await loadHomeData(getProgramme, listVenues, (line) => lines.push(line));
  const html = renderToStaticMarkup(createElement(HomeContent, data));
  return { data, html, logs: lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe("loadHomeData", () => {
  it("returns both parts and logs nothing when both load", async () => {
    const { data, logs } = await loadAndRender(async () => programme, async () => venues);
    expect(data).toEqual({ programme, venues });
    expect(logs).toEqual([]);
  });

  it("keeps the programme and logs one JSON line when venues fail", async () => {
    const { data, html, logs } = await loadAndRender(
      async () => programme,
      () => Promise.reject(new VenueRepositoryError("VENUE_DATA_INVALID", "Invalid venue data at: venues.0.kind")),
    );
    expect(data.venues).toBeNull();
    expect(html).toContain("Programme du jour");
    expect(html).toContain("Les lieux sont momentanément indisponibles.");
    expect(logs).toEqual([
      expect.objectContaining({ severity: "ERROR", event: "venues_unavailable", code: "VENUE_DATA_INVALID", retryable: false }),
    ]);
  });

  it("keeps the venues and logs one JSON line when the programme fails", async () => {
    const { data, html, logs } = await loadAndRender(
      () => Promise.reject(new EventRepositoryError("EVENT_DATA_INVALID", "Invalid event data at: steps")),
      async () => venues,
    );
    expect(data.programme).toBeNull();
    expect(html).toContain("Le programme est momentanément indisponible.");
    expect(html).toContain("Jardin des Essais");
    expect(logs).toEqual([
      expect.objectContaining({ severity: "ERROR", event: "day_programme_unavailable", code: "EVENT_DATA_INVALID", retryable: false }),
    ]);
  });
});
