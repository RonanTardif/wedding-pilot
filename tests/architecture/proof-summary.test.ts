import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// Story 6.2: the shared evidence rules under .github/atlas/ — the criteria parser (acceptance-criteria.awk, used by
// build.yml on the mini-spec and by review.yml on the PR body), the named-test definition (named-tests.jq, used by
// build.yml's acceptance gate and review.yml's summary) and the summary itself (proof-summary.jq). They run with
// awk and jq in the workflows (ubuntu runners ship both); the jq suite is skipped where jq is not installed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const atlas = (name: string) => path.join(root, ".github/atlas", name);
const summaryProgram = `${readFileSync(atlas("named-tests.jq"), "utf8")}\n${readFileSync(atlas("proof-summary.jq"), "utf8")}`;
const hasJq = (() => {
  try {
    execFileSync("jq", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const HEAD = "a".repeat(40);
const GATES = ["install", "lint", "typecheck", "test", "arch", "build", "test:e2e"];
const UNIT_FILE = "src/quiz/domain/quiz.test.ts";
const E2E_FILE = "tests/e2e/quiz.e2e.ts";

const dir = mkdtempSync(path.join(tmpdir(), "proof-summary-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Inputs {
  criteria: string[];
  gates: unknown;
  unit: unknown;
  e2e: unknown;
  shots: string[];
  problems: string[];
  changed: string[];
  scrutinize: string[];
  ci: string;
  headSha: string;
}

interface Summary {
  proved: boolean;
  reasons: string[];
  scrutinize: string[];
  unit: { passed: number; failed: number } | null;
  e2e: { passed: number; failed: number } | null;
  acceptance: {
    criteria: number;
    covered: number;
    items: { id: string; covered: boolean; tests: { kind: string; file: string; name: string; proves: boolean }[] }[];
  };
}

function summarise(overrides: Partial<Inputs> = {}): Summary {
  const { ci, headSha, ...files } = { ...baseline(), ...overrides };
  const args = ["-n", "--arg", "head_sha", headSha, "--arg", "ci", ci];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify(value));
    args.push("--slurpfile", name, file);
  }
  args.push(summaryProgram);
  return JSON.parse(execFileSync("jq", args, { encoding: "utf8" })) as Summary;
}

type UnitStatus = "passed" | "failed" | "skipped" | "todo" | "pending";
function vitestReport(tests: { title: string; status: UnitStatus }[]) {
  return {
    numPassedTests: tests.filter((t) => t.status === "passed").length,
    numFailedTests: tests.filter((t) => t.status === "failed").length,
    testResults: [
      {
        name: `/home/runner/work/wedding-pilot/wedding-pilot/${UNIT_FILE}`,
        assertionResults: tests.map((t) => ({ title: t.title, fullName: `quiz ${t.title}`, status: t.status })),
      },
    ],
  };
}

type Run = { expectedStatus: "passed" | "skipped" | "failed"; results: ("passed" | "failed" | "skipped" | "timedOut")[] };
const passed: Run = { expectedStatus: "passed", results: ["passed"] };
function playwrightReport(specs: { title: string; runs?: Run[] }[], stats?: unknown) {
  const all = specs.flatMap((s) => s.runs ?? [passed, passed]);
  const ok = (run: Run) => run.expectedStatus === "passed" && run.results.length > 0 && run.results.every((r) => r === "passed");
  return {
    config: { rootDir: "/home/runner/work/wedding-pilot/wedding-pilot/tests/e2e" },
    stats: stats ?? { expected: all.filter(ok).length, unexpected: all.filter((r) => !ok(r)).length, flaky: 0, skipped: 0 },
    suites: [
      {
        title: "quiz.e2e.ts",
        file: "quiz.e2e.ts",
        specs: [],
        suites: [
          {
            title: "quiz page",
            specs: specs.map((s) => ({
              title: s.title,
              file: "quiz.e2e.ts",
              ok: true, // never trusted: the runs decide
              tests: (s.runs ?? [passed, passed]).map((run) => ({
                expectedStatus: run.expectedStatus,
                results: run.results.map((status) => ({ status })),
              })),
            })),
          },
        ],
      },
    ],
  };
}

function baseline(): Inputs {
  return {
    criteria: ["Le quiz affiche dix questions", "Le score s'affiche à la fin", "La page est lisible sur mobile"],
    gates: { head_sha: HEAD, gates: GATES.map((name) => ({ name, status: "passed" })) },
    unit: vitestReport([
      { title: "AC1: draws ten questions", status: "passed" },
      { title: "AC2: computes the score", status: "passed" },
      { title: "AC10 is not AC1", status: "passed" },
    ]),
    e2e: playwrightReport([{ title: "AC2: shows the score at the end" }, { title: "AC3: quiz page on a phone" }]),
    shots: [".atlas-proof/shots/quiz-mobile.png", ".atlas-proof/shots/quiz-desktop.png"],
    problems: [],
    changed: [UNIT_FILE, E2E_FILE, "src/quiz/domain/quiz.ts"],
    scrutinize: [],
    ci: "success",
    headSha: HEAD,
  };
}

describe.skipIf(!hasJq)("delivery evidence summary (named-tests.jq + proof-summary.jq)", () => {
  it("proved PR: every gate green, AC1..AC3 covered by passing named tests", () => {
    const summary = summarise();
    expect(summary.proved).toBe(true);
    expect(summary.reasons).toEqual([]);
    expect(summary.unit).toEqual({ passed: 3, failed: 0 });
    expect(summary.e2e).toEqual({ passed: 4, failed: 0 });
    expect(summary.acceptance).toMatchObject({ criteria: 3, covered: 3 });
    expect(summary.acceptance.items.map((item) => item.id)).toEqual(["AC1", "AC2", "AC3"]);
    // AC1 is proved by its own test only, not by "AC10"; files are repository-relative.
    expect(summary.acceptance.items[0]?.tests.map((t) => [t.name, t.file])).toEqual([["quiz AC1: draws ten questions", UNIT_FILE]]);
    expect(summary.acceptance.items[1]?.tests.map((t) => [t.kind, t.file])).toEqual([
      ["unit", UNIT_FILE],
      ["e2e", E2E_FILE],
    ]);
  });

  it("unproved criterion: AC2 without a passing named test is reported and blocks the proof", () => {
    const summary = summarise({
      unit: vitestReport([{ title: "AC1: draws ten questions", status: "passed" }]),
      e2e: playwrightReport([{ title: "AC3: quiz page on a phone" }]),
    });
    expect(summary.proved).toBe(false);
    expect(summary.acceptance.covered).toBe(2);
    expect(summary.reasons).toEqual(["AC2 has no test named after it in the files this PR changes"]);
  });

  it("only tests in files the PR changes count (an older named test elsewhere proves nothing)", () => {
    const summary = summarise({ changed: [UNIT_FILE] });
    expect(summary.reasons).toEqual(["AC3 has no test named after it in the files this PR changes"]);
    expect(summary.acceptance.items[1]?.tests.map((t) => t.kind)).toEqual(["unit"]);
  });

  it("a failing named test does not cover its criterion", () => {
    const summary = summarise({
      e2e: playwrightReport([
        { title: "AC2: shows the score at the end", runs: [passed, { expectedStatus: "passed", results: ["failed"] }] },
        { title: "AC3: quiz page on a phone" },
      ]),
    });
    expect(summary.proved).toBe(false);
    expect(summary.reasons).toContain("AC2 has a named test that did not pass (failed,passed)");
    expect(summary.reasons).toContain("1 e2e test(s) failed or flaky");
  });

  it("skipped, fixme, todo and retried (flaky) tests never prove", () => {
    const only = (unit: UnitStatus, run: Run) =>
      summarise({
        criteria: ["x"],
        unit: vitestReport([{ title: "AC1: unit", status: unit }]),
        e2e: playwrightReport([{ title: "AC1: page", runs: [run] }, { title: "other", runs: [passed] }], { expected: 1, unexpected: 0, flaky: 0 }),
      }).acceptance.items[0]?.covered;
    for (const status of ["skipped", "todo", "pending"] as const) expect(only(status, passed)).toBe(false);
    // Playwright test.skip, test.fixme (expected skipped, no result), a flaky retry, a run without result.
    const notProving: Run[] = [
      { expectedStatus: "skipped", results: ["skipped"] },
      { expectedStatus: "skipped", results: [] },
      { expectedStatus: "passed", results: ["failed", "passed"] },
      { expectedStatus: "passed", results: [] },
    ];
    for (const run of notProving) expect(only("passed", run)).toBe(false);
    expect(only("passed", passed)).toBe(true);
  });

  it("malformed reports never crash the summary and never prove", () => {
    const malformed: unknown[] = [
      { stats: "garbage", suites: "nope" },
      { stats: null, suites: [{ specs: [{ title: "AC1: x", tests: "nope" }] }] },
      [],
      "text",
      42,
    ];
    for (const e2e of malformed) {
      const summary = summarise({ criteria: ["x"], unit: { numPassedTests: "1", testResults: { a: 1 } }, e2e });
      expect(summary.proved).toBe(false);
      expect(summary.unit).toBeNull();
      expect(summary.e2e).toBeNull();
      expect(summary.reasons).toEqual(
        expect.arrayContaining([
          "no readable unit test report",
          "no readable e2e report",
          "AC1 has no test named after it in the files this PR changes",
        ]),
      );
    }
  });

  it("ci failed: the failing and skipped gates and the run conclusion are carried to the reviewer", () => {
    const status = (name: string) => (name === "build" ? "failed" : name === "test:e2e" ? "not_run" : "passed");
    const summary = summarise({ ci: "failure", gates: { head_sha: HEAD, gates: GATES.map((name) => ({ name, status: status(name) })) } });
    expect(summary.proved).toBe(false);
    expect(summary.reasons).toEqual(
      expect.arrayContaining(["the ci run on the PR head did not succeed (failure)", "gate build failed", "gate test:e2e not run"]),
    );
  });

  it("no bundle: nothing is proved and every missing piece is named", () => {
    const summary = summarise({ gates: null, unit: null, e2e: null, shots: [], problems: ["no completed ci run on the PR head"] });
    expect(summary.proved).toBe(false);
    expect(summary.reasons).toEqual(
      expect.arrayContaining(["no completed ci run on the PR head", "no readable unit test report", "no readable e2e report", "no screenshot"]),
    );
  });

  it("evidence for another head, or a PR body without criteria, is not a proof; scrutiny flags pass through", () => {
    expect(summarise({ headSha: "b".repeat(40) }).reasons).toEqual([`the evidence is not for the PR head ${"b".repeat(40)}`]);
    expect(summarise({ criteria: [] }).reasons).toEqual(["the PR body has no numbered acceptance criteria under its mini-spec"]);
    const flagged = summarise({ scrutinize: ["package.json scripts changed", "changed: playwright.config.ts"] });
    expect(flagged.proved).toBe(true);
    expect(flagged.scrutinize).toEqual(["package.json scripts changed", "changed: playwright.config.ts"]);
  });
});

// --- One criteria parser for the build (mini-spec.md) and the review (the PR body build.yml writes). ---

const buildWorkflow = readFileSync(path.join(root, ".github/workflows/build.yml"), "utf8");

/** The PR body template of build.yml's publish job, run with bash on the given inputs. */
function prBodyFromBuildTemplate(intent: string, miniSpec: string): string {
  const start = buildWorkflow.indexOf('if [ -z "$pr_number" ]; then\n');
  const open = buildWorkflow.indexOf("{\n", start);
  const close = buildWorkflow.indexOf('} > "$RUNNER_TEMP/atlas-pr-body.md"', open);
  expect(start).toBeGreaterThan(0);
  expect(close).toBeGreaterThan(open);
  const template = buildWorkflow.slice(open, close + 1);
  const input = mkdtempSync(path.join(dir, "input-"));
  writeFileSync(path.join(input, "intent.md"), `${intent}\n`);
  writeFileSync(path.join(input, "mini-spec.md"), `${miniSpec}\n`);
  return execFileSync("bash", ["-c", template], {
    encoding: "utf8",
    env: { ...process.env, input_dir: input, MISSION_ID: "msn_X", RUN_ID: "run_X", run_url: "https://github.com/x/actions/runs/1" },
  });
}

let mdCount = 0;
function criteria(markdown: string): string[] {
  const file = path.join(dir, `md-${(mdCount += 1)}.md`);
  writeFileSync(file, markdown);
  return execFileSync("awk", ["-f", atlas("acceptance-criteria.awk"), file], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");
}

// The mini-spec as the Factory renders it for build.yml (build-feature-steps.ts), with a rule before the criteria.
const MINI_SPEC = [
  "# Mini-spec art_01JBQ7Z8X9V4R2M3N5P6Q7S8T9",
  "",
  "## Objective",
  "Ajouter une page quiz.",
  "",
  "---",
  "",
  "## Pilot context",
  "event-programme",
  "",
  "## In scope",
  "- la page /quiz",
  "",
  "## Out of scope",
  "- (none)",
  "",
  "## Acceptance criteria",
  "1. Le quiz affiche dix questions",
  "2. Le score s'affiche à la fin --- même sur mobile",
  "",
  "3. La page est lisible sur mobile (375 px)",
].join("\n");

describe("acceptance-criteria.awk: one parser for build.yml and review.yml", () => {
  const expected = ["Le quiz affiche dix questions", "Le score s'affiche à la fin --- même sur mobile", "La page est lisible sur mobile (375 px)"];

  it("parity: the mini-spec and the PR body build.yml writes from it give the same criteria", () => {
    // An intention that itself quotes a criteria list and a rule must not add criteria.
    const intent = "Fais un quiz.\n\n---\n\n## Acceptance criteria\n1. intruder from the intention";
    const body = prBodyFromBuildTemplate(intent, MINI_SPEC);
    expect(body).toContain("## Mini-spec");
    expect(body).toContain("\n---\nReviewed by the ATLAS reviewer");
    expect(criteria(MINI_SPEC)).toEqual(expected);
    expect(criteria(body)).toEqual(expected);
  });

  it("stops at the next heading or horizontal rule; accepts 1) items and CRLF", () => {
    expect(criteria("## Acceptance criteria\r\n1) a\r\n2. b\r\n***\r\n3. after a rule\r\n")).toEqual(["a", "b"]);
    expect(criteria("## Acceptance criteria\n1. a\n### Notes\n2. not a criterion\n")).toEqual(["a"]);
    expect(criteria("## Objective\n1. not a criterion\n")).toEqual([]);
  });
});
