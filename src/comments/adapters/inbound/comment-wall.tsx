import { MAX_AUTHOR_LENGTH, MAX_MESSAGE_LENGTH, type Comment } from "../../domain/comment";

/** Server component: the "Mur de commentaires" section (public form + list). */
export function CommentWall({
  comments,
  action,
  failed = false,
}: Readonly<{ comments: readonly Comment[] | null; action: string; failed?: boolean }>) {
  return (
    <section aria-labelledby="comments-title" id="comments">
      <h2 id="comments-title">Mur de commentaires</h2>
      <p className="comment-intro">
        Bienvenue sur le livre d&apos;or des mariés : laissez-leur un petit mot, il apparaîtra sur ce mur.
      </p>
      <ul className="comment-rules">
        <li>Indiquez votre nom, puis votre message.</li>
        <li>Votre message doit faire {MAX_MESSAGE_LENGTH} caractères au maximum.</li>
        <li>Aucune inscription ni connexion n&apos;est nécessaire.</li>
        <li>Cliquez sur « Publier » : votre message s&apos;affiche aussitôt.</li>
      </ul>
      <form className="comment-form" method="post" action={action}>
        <label>
          Nom
          <input type="text" name="author" required maxLength={MAX_AUTHOR_LENGTH} autoComplete="off" />
        </label>
        <label>
          Message ({MAX_MESSAGE_LENGTH} caractères maximum)
          <input type="text" name="message" required maxLength={MAX_MESSAGE_LENGTH} autoComplete="off" />
        </label>
        <button type="submit">Publier</button>
      </form>
      {failed ? <p role="alert">Votre commentaire n&apos;a pas pu être publié.</p> : null}
      {comments === null ? (
        <p role="alert">Les commentaires sont momentanément indisponibles.</p>
      ) : comments.length === 0 ? (
        <p className="comment-empty">Aucun commentaire pour le moment.</p>
      ) : (
        <ul className="comments">
          {comments.map((comment) => (
            <li key={comment.id} className="comment">
              <span className="comment-author">{comment.author}</span>
              <span className="comment-message">{comment.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
