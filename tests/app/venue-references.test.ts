import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeContent } from "../../src/app/home-content";
import type { DayProgramme } from "../../src/event-programme/application/get-day-programme";
import { JsonEventRepositoryAdapter } from "../../src/event-programme/adapters/outbound/json-event-repository-adapter";
import type { ListedVenue } from "../../src/venues/application/list-venues";
import { JsonVenueRepositoryAdapter } from "../../src/venues/adapters/outbound/json-venue-repository-adapter";

describe("bundled data consistency", () => {
  it("every programme step venueId refers to a bundled venue", async () => {
    const [event, venues] = await Promise.all([
      new JsonEventRepositoryAdapter().getEvent(),
      new JsonVenueRepositoryAdapter().listVenues(),
    ]);
    const venueIds = new Set(venues.map((v) => v.id));
    const referenced = event.steps.flatMap((step) => (step.venueId === undefined ? [] : [step.venueId]));
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((id) => !venueIds.has(id))).toEqual([]);
  });
});

const programme: DayProgramme = {
  coupleNames: "Alix & Noé",
  date: "2027-05-08",
  mainVenueLabel: "Ferme des Essais",
  steps: [
    { id: "welcome", title: "Accueil", start: new Date("2027-05-08T13:00:00Z"), end: new Date("2027-05-08T13:30:00Z"), venueId: "jardin" },
    { id: "dinner", title: "Dîner", start: new Date("2027-05-08T17:00:00Z"), end: new Date("2027-05-08T19:00:00Z"), venueId: "grange-disparue" },
  ],
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

const render = (props: Parameters<typeof HomeContent>[0]) => renderToStaticMarkup(createElement(HomeContent, props));

describe("HomeContent composition", () => {
  it("resolves venue names into the programme and still renders a step whose venue is missing", () => {
    const html = render({ programme, venues });
    expect(html).toContain("Programme du jour");
    expect(html).toContain('<span class="step-venue"> · Jardin des Essais</span>');
    expect(html).toContain("Dîner");
    expect(html.match(/class="step-venue"/g)).toHaveLength(1);
    expect(html).not.toContain("grange-disparue");
    expect(html).toContain(">Lieux</h2>");
    expect(html).not.toContain("momentanément indisponible");
  });

  it("keeps the programme when venues are unavailable, with a short message in the venues section", () => {
    const html = render({ programme, venues: null });
    expect(html).toContain("Programme du jour");
    expect(html).toContain("Accueil");
    expect(html).not.toContain("step-venue");
    expect(html).toContain("Les lieux sont momentanément indisponibles.");
  });

  it.each([
    { label: "everything available", props: { programme, venues } },
    { label: "nothing available", props: { programme: null, venues: null } },
  ])("renders the fictional-page footer exactly once ($label)", ({ props }) => {
    const html = render(props);
    expect(html.match(/Page fictive générée par ATLAS/g)).toHaveLength(1);
    expect(html).toContain('<footer class="site-footer">Page fictive générée par ATLAS</footer>');
  });

  it("keeps the venues section when the programme is unavailable", () => {
    const html = render({ programme: null, venues });
    expect(html).toContain("Le programme est momentanément indisponible.");
    expect(html).toContain("Jardin des Essais");
    expect(html).toContain("Itinéraire");
  });
});
