import type { ListedVenue } from "../../application/list-venues";
import type { VenueKind } from "../../domain/venue";

const KIND_LABELS: Record<VenueKind, string> = {
  ceremonie: "Cérémonie",
  cocktail: "Vin d'honneur",
  diner: "Dîner",
  hebergement: "Hébergement",
};

/** Server component: the "Lieux" section; `null` (not loaded) or an empty list shows a short fallback message. */
export function VenueList({ venues }: Readonly<{ venues: readonly ListedVenue[] | null }>) {
  return (
    <section aria-labelledby="venues-title">
      <h2 id="venues-title">Lieux</h2>
      {venues === null || venues.length === 0 ? (
        <p role="alert">Les lieux sont momentanément indisponibles.</p>
      ) : (
        <ul className="venues">
          {venues.map((venue) => (
            <li key={venue.id} className="venue">
              <p className="venue-kind">{KIND_LABELS[venue.kind]}</p>
              <h3 className="venue-name">{venue.name}</h3>
              <p className="venue-address">{venue.address}</p>
              <a
                className="venue-directions"
                href={venue.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Itinéraire vers ${venue.name} (nouvel onglet)`}
              >
                Itinéraire
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
