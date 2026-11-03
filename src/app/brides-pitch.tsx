import Link from "next/link";

export const BRIDES_ARGUMENTS = [
  {
    title: "Moins de charge mentale",
    text: "Un seul endroit pour le programme, les lieux et les infos pratiques : fini les messages à répétition.",
  },
  {
    title: "Tout est centralisé",
    text: "Horaires, itinéraires, mot des invités : vos proches trouvent tout au même endroit, au bon moment.",
  },
  {
    title: "Un thème à votre image",
    text: "Choisissez l'ambiance qui vous ressemble : élégante, chaleureuse ou féerique.",
  },
  {
    title: "Quizz et cagnotte",
    text: "Amusez vos invités avec un quizz sur les mariés et offrez-leur une cagnotte simple d'accès.",
  },
  {
    title: "Zéro téléchargement",
    text: "Vos invités ouvrent simplement un lien : aucune application à installer.",
  },
] as const;

/** Marketing pitch aimed at future brides, shown at the top of the home page. */
export function BridesPitch() {
  return (
    <section className="brides-pitch" aria-labelledby="brides-pitch-title">
      <p className="brides-pitch-kicker">Futures mariées</p>
      <h2 id="brides-pitch-title">Votre plus beau jour, sans le stress</h2>
      <p className="brides-pitch-lead">
        Offrez à vos invités une page élégante et sereine, pendant que vous profitez de chaque instant.
      </p>
      <ul className="brides-pitch-list">
        {BRIDES_ARGUMENTS.map((argument) => (
          <li key={argument.title} className="brides-pitch-item">
            <h3>{argument.title}</h3>
            <p>{argument.text}</p>
          </li>
        ))}
      </ul>
      <Link className="brides-pitch-cta" href="/quizz">
        Découvrir le quizz des mariés
      </Link>
    </section>
  );
}
