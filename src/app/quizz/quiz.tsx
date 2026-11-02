"use client";

import { useState } from "react";

export type QuizQuestion = Readonly<{ question: string; choices: readonly string[]; answer: number }>;

export function Quiz({ questions }: Readonly<{ questions: readonly QuizQuestion[] }>) {
  const [answers, setAnswers] = useState<Readonly<Record<number, number>>>({});
  const done = Object.keys(answers).length === questions.length;
  const score = questions.filter((q, i) => answers[i] === q.answer).length;

  return (
    <div>
      {questions.map((q, i) => {
        const picked = answers[i];
        return (
          <fieldset key={q.question} className="quiz-question">
            <legend>{q.question}</legend>
            {q.choices.map((choice, c) => (
              <button
                key={choice}
                type="button"
                className="quiz-choice"
                disabled={picked !== undefined}
                aria-pressed={picked === c}
                onClick={() => setAnswers((prev) => ({ ...prev, [i]: c }))}
              >
                {choice}
              </button>
            ))}
            {picked !== undefined && (
              <p role="status">{picked === q.answer ? "Bonne réponse !" : `Raté, la réponse était : ${q.choices[q.answer]}`}</p>
            )}
          </fieldset>
        );
      })}
      {done && (
        <p role="status" className="quiz-score">
          Score : {score} / {questions.length}
        </p>
      )}
      <button type="button" className="quiz-choice" onClick={() => setAnswers({})}>
        Recommencer
      </button>
    </div>
  );
}
