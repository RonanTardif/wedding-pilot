import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const guard = path.join(root, "scripts/guard-forbidden-key.sh");
// Assembled at runtime so no file in the repo contains the forbidden name.
const parts = ["ANTHROPIC", "API", "KEY"];
const forbiddenKey = parts.join("_");

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
  for (const dir of tempDirs.splice(0)) {
    chmodSync(dir, 0o755);
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("forbidden-key guard (scripts/guard-forbidden-key.sh)", () => {
  it("fails when the key name appears in a workflow", () => {
    const dir = makeDir({ ".github/workflows/deploy.yml": `env:\n  KEY: \${{ secrets.${forbiddenKey} }}\n` });
    expect(runGuard(dir)).toBe(1);
  });

  it.each([
    ["lower case, dashes", parts.join("-").toLowerCase()],
    ["mixed case, no separator", parts.map((part) => part[0] + part.slice(1).toLowerCase()).join("")],
  ])("fails on a variant spelling (%s) anywhere in the tree", (_label, variant) => {
    const dir = makeDir({ "src/config.ts": `export const name = "${variant}";\n` });
    expect(runGuard(dir)).toBe(1);
  });

  it("ignores node_modules, .next and .git", () => {
    const content = `${forbiddenKey}=x\n`;
    const dir = makeDir({
      "node_modules/pkg/index.js": content,
      ".next/cache.txt": content,
      ".git/config": content,
      "src/ok.ts": "export const ok = 1;\n",
    });
    expect(runGuard(dir)).toBe(0);
  });

  it("passes on a clean directory", () => {
    const dir = makeDir({ ".github/workflows/ci.yml": "name: ci\n", ".github/CODEOWNERS": "/CLAUDE.md @someone\n" });
    expect(runGuard(dir)).toBe(0);
  });

  it.skipIf(process.getuid?.() === 0)("fails with exit code 2 when a file cannot be read", () => {
    const dir = makeDir({ "src/clean.ts": "export const ok = 1;\n", "src/locked.ts": "export const x = 1;\n" });
    chmodSync(path.join(dir, "src/locked.ts"), 0o000);
    expect(runGuard(dir)).toBe(2);
  });

  it("fails with exit code 2 when the directory does not exist", () => {
    expect(runGuard(path.join(tmpdir(), "guard-does-not-exist-" + process.pid))).toBe(2);
  });

  it("passes on the repository itself", () => {
    expect(runGuard(root)).toBe(0);
  });
});
