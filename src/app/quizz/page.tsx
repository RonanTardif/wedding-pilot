import { Quiz, type QuizQuestion } from "./quiz";

export const metadata = { title: "Quizz – Mariage pilote ATLAS" };

const QUESTIONS: readonly QuizQuestion[] = [
  {
    question: "Où les mariés fictifs se sont-ils rencontrés ?",
    choices: ["À la bibliothèque", "Dans un train", "À une fête de village"],
    answer: 0,
  },
  {
    question: "Quel est le plat préféré des mariés ?",
    choices: ["La raclette", "Les crêpes", "Le couscous"],
    answer: 1,
  },
  {
    question: "Quel animal accompagne le couple ?",
    choices: ["Un chat", "Un chien", "Une tortue"],
    answer: 2,
  },
];

export default function QuizzPage() {
  return (
    <>
      <main>
        <h1>Quizz</h1>
        <p className="event-meta">Que savez-vous des mariés ? (histoires fictives)</p>
        <Quiz questions={QUESTIONS} />
      </main>
      <footer className="site-footer">Page fictive générée par ATLAS</footer>
    </>
  );
}
