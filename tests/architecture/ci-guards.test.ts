import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

describe("CI workflow guardrails", () => {
  it("grants only contents: read", () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(workflow).not.toMatch(/:\s*write\b/);
  });

  it("runs every quality gate, the secret scan and the forbidden-key guard", () => {
    for (const step of [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm arch",
      "pnpm build",
      "./gitleaks git",
      "bash scripts/guard-forbidden-key.sh .\n",
    ]) {
      expect(workflow).toContain(step);
    }
  });

  it("self-tests gitleaks on a planted fake secret right after the scan, failing if it is not detected", () => {
    const scan = workflow.indexOf("- name: Secret scan (gitleaks)");
    const selfTest = workflow.indexOf("- name: Secret scan self-test");
    const nextStep = workflow.indexOf("- name:", scan + 1);
    expect(scan).toBeGreaterThanOrEqual(0);
    expect(selfTest).toBe(nextStep);
    const step = workflow.slice(selfTest, workflow.indexOf("- name:", selfTest + 1));
    expect(step).toContain("mktemp -d");
    expect(step).toMatch(/\.\/gitleaks dir [^\n]*--exit-code 42 "\$canary_dir" \|\| rc=\$\?/);
    expect(step).toMatch(/if \[ "\$rc" -ne 42 \]; then\n[^\n]*did not detect[^\n]*\n\s*exit 1/);
  });
});
