import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DayProgramme as DayProgrammeModel } from "../../application/get-day-programme";
import { DayProgramme } from "./day-programme";

const base: DayProgrammeModel = {
  coupleNames: "Alix & Noé",
  date: "2027-05-08",
  mainVenueLabel: "Ferme des Essais",
  steps: [
    { id: "welcome", title: "Accueil", start: new Date("2027-05-08T13:00:00Z"), end: new Date("2027-05-08T13:30:00Z") },
    { id: "dinner", title: "Dîner", start: new Date("2027-05-08T17:00:00Z"), end: new Date("2027-05-08T19:00:00Z"), description: "Sous le tilleul" },
  ],
  highlight: null,
};

const render = (programme: DayProgrammeModel) => renderToStaticMarkup(<DayProgramme programme={programme} />);

/** The rendered `<li>` of each step, in order. */
const items = (html: string) => html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];

const BADGE_TEXTS = ["En cours", "Prochaine étape"];

function expectUnmarked(li: string) {
  expect(li).not.toContain("aria-current");
  expect(li).not.toMatch(/step--(current|next)/);
  expect(li).not.toContain('class="badge"');
  for (const text of BADGE_TEXTS) expect(li).not.toContain(text);
}

describe("DayProgramme", () => {
  it("renders the header and the steps with Europe/Paris times", () => {
    const html = render(base);
    expect(html).toContain("Alix &amp; Noé");
    expect(html).toContain("samedi 8 mai 2027");
    expect(html).toContain("Ferme des Essais");
    const [welcome, dinner] = items(html);
    expect(welcome).toContain("15:00"); // 13:00 UTC = 15:00 CEST
    expect(welcome).toContain("Accueil");
    expect(dinner).toContain("19:00");
    expect(dinner).toContain("Sous le tilleul");
    expect(items(html)).toHaveLength(2);
    items(html).forEach(expectUnmarked);
  });

  it.each([
    { stepId: "dinner", kind: "next", text: "Prochaine étape" },
    { stepId: "welcome", kind: "current", text: "En cours" },
  ] as const)("marks only the $kind step ($stepId) with badge, class and aria-current", ({ stepId, kind, text }) => {
    const lis = items(render({ ...base, highlight: { stepId, kind } }));
    const index = base.steps.findIndex((s) => s.id === stepId);
    const target = lis[index] ?? "";
    expect(target).toContain('aria-current="step"');
    expect(target).toContain(`step--${kind}`);
    expect(target).toMatch(new RegExp(`<span class="badge">${text}</span>`));
    lis.filter((_, i) => i !== index).forEach(expectUnmarked);
  });

  it("flags an end time on the next Paris calendar day with (+1 j)", () => {
    const html = render({
      ...base,
      steps: [
        // 23:00 -> 03:00 Paris time (CEST).
        { id: "party", title: "Soirée", start: new Date("2027-05-08T21:00:00Z"), end: new Date("2027-05-09T01:00:00Z") },
        // 23:30 -> 23:59 Paris time: same day.
        { id: "late", title: "Tard", start: new Date("2027-05-08T21:30:00Z"), end: new Date("2027-05-08T21:59:00Z") },
      ],
    });
    const [party, late] = items(html);
    expect(party).toContain("03:00 (+1 j)");
    expect(late).toContain("23:59");
    expect(late).not.toContain("+1 j");
    // The +1 j decision uses Paris days, not UTC days: 01:30 -> 02:00 Paris is 23:30Z -> 00:00Z.
    const crossUtc = items(
      render({
        ...base,
        steps: [{ id: "x", title: "X", start: new Date("2027-05-08T23:30:00Z"), end: new Date("2027-05-09T00:00:00Z") }],
      }),
    )[0];
    expect(crossUtc).toContain("02:00");
    expect(crossUtc).not.toContain("+1 j");
  });
});
