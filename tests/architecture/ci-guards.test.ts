import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const deployWorkflow = readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");

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
      "terraform -chdir=infrastructure fmt -check -recursive",
      "terraform -chdir=infrastructure validate",
      "docker build -t wedding-page:ci .",
    ]) {
      expect(workflow).toContain(step);
    }
  });

  it("fails the build unless / is dynamic", () => {
    const build = workflow.slice(workflow.indexOf("- name: Build"), workflow.indexOf("- name:", workflow.indexOf("- name: Build") + 1));
    expect(build).toContain("set -o pipefail");
    expect(build).toContain("pnpm build | tee build.log");
    expect(build).toMatch(/grep -Eq 'ƒ \/[^\n]*build\.log/);
  });

  it("smoke-tests that / renders the bundled programme, not the fallback", () => {
    const smoke = workflow.slice(workflow.indexOf("- name: Docker image smoke test"));
    expect(smoke).toContain("jq -r '.coupleNames' src/event-programme/adapters/outbound/event.json");
    expect(smoke).toContain('grep -qF "$couple_html" page.html');
    expect(smoke).toContain('grep -qF "Programme du jour" page.html');
    expect(smoke).toContain('grep -qF "momentanément indisponible" page.html');
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

describe("Deploy workflow guardrails", () => {
  it("grants exactly contents: read and id-token: write, nothing else", () => {
    expect(deployWorkflow).toMatch(/^permissions:\n {2}contents: read\n {2}id-token: write\n(?! )/m);
    expect(deployWorkflow.match(/^\s*permissions:/gm)).toHaveLength(1);
    const writes = deployWorkflow.match(/:\s*write\b/g) ?? [];
    expect(writes).toEqual([": write"]);
  });

  it("deploys only after a successful ci run on main, without cancelling a deploy in flight", () => {
    expect(deployWorkflow).toMatch(/workflow_run:\n\s+workflows: \[ci\]\n\s+types: \[completed\]\n\s+branches: \[main\]/);
    expect(deployWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deployWorkflow).toContain("cancel-in-progress: false");
  });

  it("never runs for fork pull requests", () => {
    const condition = deployWorkflow.slice(deployWorkflow.indexOf("    if: >-"), deployWorkflow.indexOf("    runs-on:"));
    expect(condition).toContain("github.event.workflow_run.event == 'push'");
    expect(condition).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(deployWorkflow).not.toMatch(/^\s*pull_request(_target)?\s*:/m);
  });

  it("skips a SHA that is no longer the main head, before authenticating", () => {
    const guard = deployWorkflow.indexOf("git ls-remote https://github.com/${{ github.repository }} refs/heads/main");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(deployWorkflow.indexOf("google-github-actions/auth@"));
  });

  it("authenticates through WIF only, never with a JSON key", () => {
    expect(deployWorkflow).toContain("workload_identity_provider:");
    expect(deployWorkflow).not.toMatch(/credentials_json|GOOGLE_CREDENTIALS|secrets\./);
  });
});

describe("Every workflow action is pinned by commit SHA", () => {
  for (const [name, content] of [
    ["ci.yml", workflow],
    ["deploy.yml", deployWorkflow],
  ] as const) {
    it(name, () => {
      const uses = [...content.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1]);
      expect(uses.length).toBeGreaterThan(0);
      for (const ref of uses) {
        expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      }
    });
  }
});
