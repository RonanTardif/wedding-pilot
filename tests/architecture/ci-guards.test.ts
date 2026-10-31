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
    for (const step of ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm arch", "pnpm build", "gitleaks", "grep -rn"]) {
      expect(workflow).toContain(step);
    }
  });
});
