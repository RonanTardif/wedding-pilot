import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cruise, type ICruiseOptions, type IConfiguration, type ICruiseResult } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const fixturesDir = path.join(here, "fixtures");
const require = createRequire(import.meta.url);
const config = require("../../.dependency-cruiser.cjs") as IConfiguration;

/** Same options as `pnpm arch`, rooted at the fixture; tsconfig from the fixture if present, else the repo's. */
async function violatedRules(fixture: string): Promise<string[]> {
  const baseDir = path.join(fixturesDir, fixture);
  const configTsConfig = config.options?.tsConfig?.fileName ?? "tsconfig.json";
  const fixtureTsConfig = path.join(baseDir, configTsConfig);
  const tsConfigFile = existsSync(fixtureTsConfig) ? fixtureTsConfig : path.join(repoRoot, configTsConfig);
  const options: ICruiseOptions = {
    ...structuredClone(config.options),
    baseDir,
    tsConfig: { fileName: tsConfigFile },
    validate: true,
    ruleSet: { forbidden: config.forbidden },
  };
  const result = await cruise(["src"], options, undefined, { tsConfig: extractTSConfig(tsConfigFile) });
  const output = result.output as ICruiseResult;
  // Guard against a vacuous pass: the fixture must actually have been cruised.
  expect(output.modules.some((module) => module.source.startsWith("src/"))).toBe(true);
  return [...new Set(output.summary.violations.map((violation) => violation.rule.name))].sort();
}

describe("AD-21 dependency rules (dependency-cruiser)", () => {
  it("accepts a well-layered tree composed in src/app, with a same-domain @/ alias import", async () => {
    expect(await violatedRules("clean")).toEqual([]);
  });

  it.each([
    ["domain-imports-adapter", ["domain-not-to-outer-layers", "domain-stays-in-own-domain"]],
    ["domain-imports-application", ["domain-not-to-outer-layers", "domain-stays-in-own-domain"]],
    ["domain-imports-app", ["domain-stays-in-own-domain", "no-cross-context"]],
    ["domain-imports-next", ["domain-no-external-deps"]],
    // Not installed, so it cannot resolve; once installed, domain-no-external-deps applies (see domain-imports-next).
    ["domain-imports-google-cloud", ["not-to-unresolvable"]],
    ["domain-imports-node-core", ["domain-no-external-deps"]],
    ["application-imports-adapter", ["application-not-to-adapters"]],
    ["application-imports-app", ["application-not-to-adapters", "no-cross-context"]],
    ["application-imports-next", ["application-no-external-deps"]],
    ["cross-context", ["no-cross-context"]],
    ["cross-context-adapters", ["no-cross-context"]],
    ["circular", ["no-circular"]],
    ["unresolvable", ["not-to-unresolvable"]],
  ])("flags fixture %s with exactly %j", async (fixture, rules) => {
    expect(await violatedRules(fixture)).toEqual([...rules].sort());
  });
});
