export const metadata = { title: "Cagnotte – Mariage pilote ATLAS" };

export default function CagnottePage() {
  return (
    <>
      <main>
        <h1>Cagnotte</h1>
        <p className="event-meta">Si vous souhaitez participer au voyage de noces des mariés fictifs, merci !</p>
        <h2>Comment contribuer</h2>
        <ul className="info-list">
          <li>
            Lien de la cagnotte :{" "}
            <a href="https://example.com/cagnotte-fictive" rel="noopener noreferrer">
              example.com/cagnotte-fictive
            </a>
          </li>
          <li>Montant libre, à partir de 5 €.</li>
          <li>Vous pouvez aussi remettre une enveloppe le jour de la fête.</li>
        </ul>
        <p className="event-meta">Cette page est fictive : aucun paiement n&apos;est possible.</p>
      </main>
      <footer className="site-footer">Page fictive générée par ATLAS</footer>
    </>
  );
}
