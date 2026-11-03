import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// Story 6.2: `.github/atlas/proof-summary.jq` decides, in code, whether a PR's delivery is proved. It runs with
// jq in review.yml (ubuntu runners ship jq); the suite is skipped where jq is not installed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const program = path.join(root, ".github/atlas/proof-summary.jq");
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

interface Inputs {
  criteria: string[];
  gates: unknown;
  unit: unknown;
  e2e: unknown;
  shots: string[];
  problems: string[];
  verify: string;
  headSha: string;
}

interface Summary {
  proved: boolean;
  reasons: string[];
  unit: { passed: number; failed: number } | null;
  e2e: { passed: number; failed: number } | null;
  acceptance: { criteria: number; covered: number; items: { id: string; covered: boolean; tests: { kind: string; name: string; passed: boolean }[] }[] };
  screenshots: string[];
}

const dir = mkdtempSync(path.join(tmpdir(), "proof-summary-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function summarise(overrides: Partial<Inputs> = {}): Summary {
  const inputs: Inputs = { ...baseline(), ...overrides };
  const files: Record<string, unknown> = {
    criteria: inputs.criteria,
    gates: inputs.gates,
    unit: inputs.unit,
    e2e: inputs.e2e,
    shots: inputs.shots,
    problems: inputs.problems,
  };
  const args = ["-n", "--arg", "head_sha", inputs.headSha, "--arg", "verify", inputs.verify];
  for (const [name, value] of Object.entries(files)) {
    const file = path.join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify(value));
    args.push("--slurpfile", name, file);
  }
  args.push("-f", program);
  return JSON.parse(execFileSync("jq", args, { encoding: "utf8" })) as Summary;
}

function vitestReport(tests: { title: string; status: "passed" | "failed" }[]) {
  return {
    numPassedTests: tests.filter((t) => t.status === "passed").length,
    numFailedTests: tests.filter((t) => t.status === "failed").length,
    testResults: [
      {
        name: "/home/runner/work/wedding-pilot/wedding-pilot/src/quiz/domain/quiz.test.ts",
        assertionResults: tests.map((t) => ({ title: t.title, fullName: `quiz ${t.title}`, status: t.status })),
      },
    ],
  };
}

function playwrightReport(specs: { title: string; ok: boolean }[]) {
  return {
    stats: { expected: specs.filter((s) => s.ok).length, unexpected: specs.filter((s) => !s.ok).length, flaky: 0, skipped: 0 },
    suites: [{ title: "quiz.e2e.ts", specs: [], suites: [{ title: "quiz page", specs: specs.map((s) => ({ ...s, file: "quiz.e2e.ts" })) }] }],
  };
}

function baseline(): Inputs {
  return {
    criteria: ["Le quiz affiche dix questions", "Le score s'affiche à la fin", "La page est lisible sur mobile"],
    gates: { head_sha: HEAD, gates: GATES.map((name) => ({ name, status: "passed", output: null })) },
    unit: vitestReport([
      { title: "AC1: draws ten questions", status: "passed" },
      { title: "AC2: computes the score", status: "passed" },
      { title: "AC10 is not AC1", status: "passed" },
    ]),
    e2e: playwrightReport([
      { title: "AC2: shows the score at the end", ok: true },
      { title: "AC3: quiz page on a phone", ok: true },
    ]),
    shots: [".atlas-proof/shots/quiz-mobile.png", ".atlas-proof/shots/quiz-desktop.png"],
    problems: [],
    verify: "success",
    headSha: HEAD,
  };
}

describe.skipIf(!hasJq)("delivery evidence summary (proof-summary.jq)", () => {
  it("proved PR: every gate green, AC1..AC3 covered by passing named tests", () => {
    const summary = summarise();
    expect(summary.proved).toBe(true);
    expect(summary.reasons).toEqual([]);
    expect(summary.unit).toEqual({ passed: 3, failed: 0 });
    expect(summary.e2e).toEqual({ passed: 2, failed: 0 });
    expect(summary.acceptance.criteria).toBe(3);
    expect(summary.acceptance.covered).toBe(3);
    expect(summary.acceptance.items.map((item) => item.id)).toEqual(["AC1", "AC2", "AC3"]);
    // AC1 is proved by its own test only, not by "AC10".
    expect(summary.acceptance.items[0]?.tests.map((t) => t.name)).toEqual(["quiz AC1: draws ten questions"]);
    expect(summary.acceptance.items[1]?.tests.map((t) => t.kind)).toEqual(["unit", "e2e"]);
  });

  it("unproved criterion: AC2 without a passing named test is reported and blocks the proof", () => {
    const summary = summarise({
      unit: vitestReport([{ title: "AC1: draws ten questions", status: "passed" }]),
      e2e: playwrightReport([{ title: "AC3: quiz page on a phone", ok: true }]),
    });
    expect(summary.proved).toBe(false);
    expect(summary.acceptance.covered).toBe(2);
    expect(summary.reasons).toEqual(["AC2 has no test named after it"]);
  });

  it("a failing named test does not cover its criterion", () => {
    const summary = summarise({
      e2e: playwrightReport([
        { title: "AC2: shows the score at the end", ok: false },
        { title: "AC3: quiz page on a phone", ok: true },
      ]),
    });
    expect(summary.proved).toBe(false);
    expect(summary.reasons).toContain("AC2 has a failing named test");
    expect(summary.reasons).toContain("1 e2e test(s) failed");
  });

  it("verify failed: the failing gate and the job result are carried to the reviewer", () => {
    const summary = summarise({
      verify: "failure",
      gates: {
        head_sha: HEAD,
        gates: GATES.map((name) => ({ name, status: name === "test:e2e" ? "failed" : "passed", output: name === "test:e2e" ? "1 failed" : null })),
      },
    });
    expect(summary.proved).toBe(false);
    expect(summary.reasons).toEqual(expect.arrayContaining(["the verify job did not succeed (failure)", "gate test:e2e failed"]));
  });

  it("no bundle: nothing is proved and every missing piece is named", () => {
    const summary = summarise({ gates: null, unit: null, e2e: null, shots: [], problems: ["verify uploaded no evidence bundle"] });
    expect(summary.proved).toBe(false);
    expect(summary.unit).toBeNull();
    expect(summary.e2e).toBeNull();
    expect(summary.reasons).toEqual(
      expect.arrayContaining(["verify uploaded no evidence bundle", "no readable unit test report", "no readable e2e report", "no screenshot"]),
    );
  });

  it("evidence for another head, or a PR body without criteria, is not a proof", () => {
    expect(summarise({ headSha: "b".repeat(40) }).reasons).toEqual([`the evidence is not for the PR head ${"b".repeat(40)}`]);
    expect(summarise({ criteria: [] }).reasons).toEqual(["the PR body has no numbered acceptance criteria under its mini-spec"]);
  });
});
