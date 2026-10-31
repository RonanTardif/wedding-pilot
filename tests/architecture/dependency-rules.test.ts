import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cruise, type IConfiguration, type ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "fixtures");
const require = createRequire(import.meta.url);
const config = require("../../.dependency-cruiser.cjs") as IConfiguration;

async function violatedRules(fixture: string): Promise<string[]> {
  const result = await cruise(["src"], {
    baseDir: path.join(fixturesDir, fixture),
    validate: true,
    ruleSet: { forbidden: config.forbidden },
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: config.options?.enhancedResolveOptions,
  });
  const output = result.output as ICruiseResult;
  // Guard against a vacuous pass: the fixture must actually have been cruised.
  expect(output.modules.some((module) => module.source.startsWith("src/"))).toBe(true);
  return [...new Set(output.summary.violations.map((violation) => violation.rule.name))].sort();
}

describe("AD-21 dependency rules (dependency-cruiser)", () => {
  it("accepts a well-layered tree composed in src/app", async () => {
    expect(await violatedRules("clean")).toEqual([]);
  });

  it.each([
    ["domain-imports-adapter", "domain-not-to-outer-layers"],
    ["domain-imports-application", "domain-not-to-outer-layers"],
    ["application-imports-adapter", "application-not-to-adapters"],
    ["domain-imports-next", "domain-no-external-deps"],
    ["domain-imports-google-cloud", "domain-no-external-deps"],
    ["domain-imports-node-core", "domain-no-external-deps"],
    ["cross-context", "no-cross-context-core"],
    ["circular", "no-circular"],
  ])("flags fixture %s with rule %s", async (fixture, rule) => {
    expect(await violatedRules(fixture)).toContain(rule);
  });
});
