import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const guard = path.join(root, "scripts/guard-forbidden-key.sh");
// Assembled at runtime so no file in the repo contains the literal key name.
const forbiddenKey = ["ANTHROPIC", "API", "KEY"].join("_");

const tempDirs: string[] = [];
function makeDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "guard-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return dir;
}

function runGuard(dir: string): number | null {
  return spawnSync("bash", [guard, dir], { encoding: "utf8" }).status;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("forbidden-key guard (scripts/guard-forbidden-key.sh)", () => {
  it("fails when the key name appears in a workflow", () => {
    const dir = makeDir({ "workflows/deploy.yml": `env:\n  KEY: \${{ secrets.${forbiddenKey} }}\n` });
    expect(runGuard(dir)).toBe(1);
  });

  it("passes on a clean directory", () => {
    const dir = makeDir({ "workflows/ci.yml": "name: ci\n", CODEOWNERS: "/CLAUDE.md @someone\n" });
    expect(runGuard(dir)).toBe(0);
  });

  it("passes on the repository's own .github directory", () => {
    expect(runGuard(path.join(root, ".github"))).toBe(0);
  });
});
