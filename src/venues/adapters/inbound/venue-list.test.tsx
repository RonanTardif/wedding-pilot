import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ListedVenue } from "../../application/list-venues";
import { VenueList } from "./venue-list";

const venues: ListedVenue[] = [
  {
    id: "jardin",
    name: "Jardin & Co",
    kind: "ceremonie",
    address: "3 rue C, 99000 Nulle-Part",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=3%20rue%20C%2C%2099000%20Nulle-Part",
  },
  {
    id: "gite",
    name: "Gîte",
    kind: "hebergement",
    address: "1 rue A, 99000 Nulle-Part",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=1%20rue%20A%2C%2099000%20Nulle-Part",
  },
];

const items = (html: string) => html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];

describe("VenueList", () => {
  it("renders the Lieux section with name, French kind label, address and a directions link per venue", () => {
    const html = renderToStaticMarkup(<VenueList venues={venues} />);
    expect(html).toContain(">Lieux</h2>");
    const [jardin, gite] = items(html);
    expect(items(html)).toHaveLength(2);
    expect(jardin).toContain("Jardin &amp; Co");
    expect(jardin).toContain("Cérémonie");
    expect(jardin).toContain("3 rue C, 99000 Nulle-Part");
    expect(jardin).toContain(
      '<a class="venue-directions" href="https://www.google.com/maps/dir/?api=1&amp;destination=3%20rue%20C%2C%2099000%20Nulle-Part" target="_blank" rel="noopener noreferrer" aria-label="Itinéraire vers Jardin &amp; Co (nouvel onglet)">Itinéraire</a>',
    );
    expect(gite).toContain("Hébergement");
    expect(gite).toContain('aria-label="Itinéraire vers Gîte (nouvel onglet)"');
    expect(html).not.toContain('role="alert"');
  });

  it("labels the cocktail kind as Vin d'honneur", () => {
    const html = renderToStaticMarkup(
      <VenueList venues={[{ id: "orangerie", name: "Orangerie", kind: "cocktail", address: "4 rue D", directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=4%20rue%20D" }]} />,
    );
    expect(html).toContain('<p class="venue-kind">Vin d&#x27;honneur</p>');
  });

  it.each([
    { label: "unavailable (null)", value: null },
    { label: "empty", value: [] },
  ])("shows a fixed short message when venues are $label", ({ value }) => {
    const html = renderToStaticMarkup(<VenueList venues={value} />);
    expect(html).toContain(">Lieux</h2>");
    expect(html).toContain('<p role="alert">Les lieux sont momentanément indisponibles.</p>');
    expect(html).not.toContain("<ul");
  });
});
