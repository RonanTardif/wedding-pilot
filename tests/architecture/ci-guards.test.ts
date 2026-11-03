import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const deployWorkflow = readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");
const buildWorkflow = readFileSync(path.join(root, ".github/workflows/build.yml"), "utf8");
const reviewWorkflow = readFileSync(path.join(root, ".github/workflows/review.yml"), "utf8");
// Assembled at runtime so no file in the repo contains the forbidden name.
const forbiddenKey = new RegExp(["anthropic", "api", "key"].join("[_-]?"), "i");

/** Bodies of every `run:` step (single-line or block scalar). */
function runBlocks(content: string): string[] {
  const lines = content.split("\n");
  const indentOf = (line: string) => line.length - line.trimStart().length;
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(- )?run:\s?(.*)$/.exec(lines[i] ?? "");
    if (!match) continue;
    const [, indent = "", dash, value = ""] = match;
    const keyIndent = indent.length + (dash ? 2 : 0);
    if (!/^[|>][-+]?$/.test(value)) {
      blocks.push(value);
      continue;
    }
    const body: string[] = [];
    for (let next = lines[i + 1]; next !== undefined && (next.trim() === "" || indentOf(next) > keyIndent); next = lines[i + 1]) {
      body.push(next);
      i++;
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

/** The text of one job of a workflow, from its key to the next job (or the end of the file). */
function jobOf(content: string, name: string): string {
  const start = content.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`no job ${name}`);
  const next = content.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? content.slice(start) : content.slice(start, start + 1 + next);
}

/** Lines granting a write permission, outside the App token `permission-*` inputs. */
function writeGrants(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /:\s*write\b/.test(line) && !/^\s+permission-[\w-]+: write$/.test(line))
    .map((line) => line.trim());
}

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

  it("smoke-tests that / renders the bundled programme and venues, not the fallback", () => {
    const smoke = workflow.slice(workflow.indexOf("- name: Docker image smoke test"));
    expect(smoke).toContain("jq -r '.coupleNames' src/event-programme/adapters/outbound/event.json");
    expect(smoke).toContain('grep -qF "$couple_html" page.html');
    expect(smoke).toContain('grep -qF "Programme du jour" page.html');
    expect(smoke).toContain("jq -r '.venues[0].name' src/venues/adapters/outbound/venues.json");
    expect(smoke).toContain('grep -qF "$venue_html" page.html');
    expect(smoke).toContain('grep -qF "Itinéraire" page.html');
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
    // The only other permissions block is the smoke job's, which drops id-token.
    expect(deployWorkflow.match(/^\s*permissions:/gm)).toHaveLength(2);
    expect(jobOf(deployWorkflow, "smoke")).toMatch(/^ {4}permissions:\n {6}contents: read\n(?! {6})/m);
    const writes = deployWorkflow.match(/:\s*write\b/g) ?? [];
    expect(writes).toEqual([": write"]);
  });

  it("names each run after the deployed SHA, so the Factory can read its verdict (story 6.2)", () => {
    expect(deployWorkflow).toContain("run-name: deploy ${{ github.event.workflow_run.head_sha || github.sha }}\n");
  });

  it("smoke-tests the public URL with the e2e suite after /version, without cloud credentials (story 6.2)", () => {
    const deploy = jobOf(deployWorkflow, "deploy");
    const smoke = jobOf(deployWorkflow, "smoke");
    // The URL is published only once /version serves the deployed SHA and / answers 200.
    const live = deploy.indexOf("- name: Verify /version serves the deployed SHA");
    expect(live).toBeGreaterThan(-1);
    expect(deploy.indexOf('echo "service_url=$url" >> "$GITHUB_OUTPUT"')).toBeGreaterThan(deploy.indexOf('if [ "$served" = "$DEPLOY_SHA" ]; then'));
    expect(deploy).toContain("service_url: ${{ steps.live.outputs.service_url }}");
    expect(smoke).toMatch(/^ {4}needs: deploy\n/m);
    expect(smoke).toContain("if: needs.deploy.outputs.service_url != ''");
    expect(smoke).toContain("E2E_BASE_URL: ${{ needs.deploy.outputs.service_url }}");
    expect(smoke).toContain("pnpm exec playwright install --with-deps chromium");
    expect(runBlocks(smoke).some((block) => /\n\s*pnpm test:e2e\s*$/.test(block) || /^pnpm test:e2e$/m.test(block))).toBe(true);
    expect(smoke).not.toMatch(/google-github-actions|secrets\.|id-token|environment:/);
    expect(smoke).toContain("ref: ${{ env.DEPLOY_SHA }}");
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

describe("Factory agent workflows (build.yml, review.yml)", () => {
  for (const [name, content] of [
    ["build.yml", buildWorkflow],
    ["review.yml", reviewWorkflow],
  ] as const) {
    describe(name, () => {
      it("authenticates Claude with the subscription token only, never an API key", () => {
        expect(content).toContain("claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}");
        expect(content).not.toMatch(forbiddenKey);
      });

      it("pins claude-code-action and create-github-app-token, with the App bot in allowed_bots", () => {
        expect(content).toContain("uses: anthropics/claude-code-action@d535f5172dec02b204866b393d6b20b9b2aaf98d # v1");
        expect(content).toContain("uses: actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3.3.0");
        expect(content).toMatch(/allowed_bots: \$\{\{ (vars\.ATLAS_APP_SLUG|steps\.identity\.outputs\.app-slug) \}\}\[bot\]/);
      });

      it("mints App tokens only in the atlas-agents environment", () => {
        expect(content).toContain("environment: atlas-agents");
        expect(content).toContain("app-id: ${{ secrets.ATLAS_APP_ID }}");
        expect(content).toContain("private-key: ${{ secrets.ATLAS_APP_PRIVATE_KEY }}");
      });

      it("mints the App write token only after the agent has run, and never hands it to the agent", () => {
        const agent = content.indexOf("uses: anthropics/claude-code-action@");
        const writeToken = content.indexOf("permission-contents: write");
        expect(agent).toBeGreaterThan(0);
        expect(writeToken).toBeGreaterThan(agent);
        const agentStep = content.slice(agent, content.indexOf("- name:", agent));
        expect(agentStep).toContain("github_token: ${{ github.token }}");
        expect(agentStep).not.toContain("app-token");
      });

      it("never interpolates expressions into run: blocks (inputs reach steps through env)", () => {
        const blocks = runBlocks(content);
        expect(blocks.length).toBeGreaterThan(0);
        for (const block of blocks) {
          expect(block).not.toContain("${{");
        }
      });

      it("checks out without persisting credentials", () => {
        const checkouts = content.match(/uses: actions\/checkout@/g) ?? [];
        const persist = content.match(/persist-credentials: false/g) ?? [];
        expect(checkouts.length).toBeGreaterThan(0);
        expect(persist).toHaveLength(checkouts.length);
      });
    });
  }
});

describe("Build workflow (Factory code agent)", () => {
  it("is dispatched on main only, with the mission inputs", () => {
    expect(buildWorkflow).toMatch(/^on:\n {2}workflow_dispatch:\n {4}inputs:\n/m);
    for (const input of ["run_id", "mission_id", "intent", "mini_spec", "feedback"]) {
      expect(buildWorkflow).toMatch(new RegExp(`^ {6}${input}:\n`, "m"));
    }
    expect(buildWorkflow).not.toMatch(/^\s*(push|pull_request|pull_request_target|workflow_run):/m);
    expect(buildWorkflow).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("grants the job token contents: read only", () => {
    expect(buildWorkflow).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
    expect(buildWorkflow).toMatch(/^ {4}permissions:\n {6}contents: read\n(?! {6})/m);
    expect(writeGrants(buildWorkflow)).toEqual([]);
  });

  it("validates run_id and mission_id before anything else", () => {
    const runId = buildWorkflow.indexOf('[[ "$RUN_ID" =~ ^run_[0-9A-HJKMNP-TV-Z]{26}$ ]]');
    const missionId = buildWorkflow.indexOf('[[ "$MISSION_ID" =~ ^msn_[0-9A-HJKMNP-TV-Z]{26}$ ]]');
    expect(runId).toBeGreaterThan(0);
    expect(missionId).toBeGreaterThan(0);
    // Only the egress block (harden-runner) comes first; every other action runs after the ids are valid.
    const firstUses = buildWorkflow.indexOf("uses:");
    expect(buildWorkflow.slice(firstUses)).toMatch(/^uses: step-security\/harden-runner@[0-9a-f]{40} /);
    const secondUses = buildWorkflow.indexOf("uses:", firstUses + 1);
    expect(runId).toBeLessThan(secondUses);
    expect(missionId).toBeLessThan(secondUses);
  });

  it("gives the agent a free shell only inside an egress block, without root, Docker or WebFetch (story 6.1)", () => {
    const allowedLists = [...buildWorkflow.matchAll(/--allowedTools "([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(allowedLists).toHaveLength(2);
    for (const allowed of allowedLists) {
      expect(allowed.split(",").sort()).toEqual(["Bash", "Edit", "Glob", "Grep", "MultiEdit", "Read", "TodoWrite", "WebSearch", "Write"]);
    }
    const disallowedLists = [...buildWorkflow.matchAll(/--disallowedTools "([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(disallowedLists).toHaveLength(2);
    for (const disallowed of disallowedLists) expect(disallowed.split(",")).toContain("WebFetch");
    expect(buildWorkflow).toContain('CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1"');
    // The egress block is the agent job's first step, in block mode.
    const agentJob = buildWorkflow.slice(buildWorkflow.indexOf("\n  agent:\n"), buildWorkflow.indexOf("\n  publish:\n"));
    const firstStep = agentJob.slice(agentJob.indexOf("    steps:\n"));
    expect(firstStep).toMatch(/^ {4}steps:\n(?: {6}#[^\n]*\n)* {6}- name: [^\n]+\n {8}uses: step-security\/harden-runner@[0-9a-f]{40} [^\n]*\n {8}with:\n {10}egress-policy: block\n/);
    // sudo and Docker are gone before the agent runs, and the step fails if sudo still works.
    const drop = agentJob.indexOf("- name: Drop root and containers before the agent runs");
    expect(drop).toBeGreaterThan(-1);
    expect(drop).toBeLessThan(agentJob.indexOf("uses: anthropics/claude-code-action@"));
    expect(agentJob).toContain("rm -f /var/run/docker.sock");
    expect(agentJob).toContain('if sudo -n true > /dev/null 2>&1; then');
    expect(agentJob.slice(agentJob.indexOf("uses: anthropics/claude-code-action@"))).not.toMatch(/\bsudo\b/);
  });

  it("runs the agent in a job with no App secret and no environment; only publish gets them", () => {
    const agentJob = buildWorkflow.slice(buildWorkflow.indexOf("\n  agent:\n"), buildWorkflow.indexOf("\n  publish:\n"));
    const publishJob = buildWorkflow.slice(buildWorkflow.indexOf("\n  publish:\n"));
    expect(agentJob).toContain("uses: anthropics/claude-code-action@");
    expect(agentJob).not.toMatch(/secrets\.ATLAS_/);
    expect(agentJob).not.toMatch(/^\s+environment:/m);
    expect(agentJob).not.toContain("create-github-app-token");
    expect(agentJob).toContain("allowed_bots: ${{ vars.ATLAS_APP_SLUG }}[bot]");
    expect(publishJob).toMatch(/^ {4}needs: agent\n/m);
    expect(publishJob).toContain("environment: atlas-agents");
    expect(publishJob).not.toContain("claude-code-action");
    expect(publishJob).not.toMatch(/\bpnpm\b/);
    // The .github/ rule is checked again on what publish is about to push.
    expect(publishJob).toContain("git diff --cached --name-only --no-renames | grep -E '^\\.github/'");
  });

  it("merges main into an existing branch before the agent runs, failing on conflict", () => {
    const merge = buildWorkflow.indexOf('merge --no-edit --no-ff "$main_sha"');
    expect(merge).toBeGreaterThan(0);
    expect(merge).toBeLessThan(buildWorkflow.indexOf("uses: anthropics/claude-code-action@"));
    expect(buildWorkflow).toContain("conflicts with main; it cannot be updated automatically.");
    expect(buildWorkflow).toContain('git merge --quiet --no-edit --no-ff -m "Merge main into $BRANCH" "$MAIN_SHA"');
  });

  it("re-runs every quality gate after the agent and before the App token exists", () => {
    // The gate runner is written to $RUNNER_TEMP before the agent runs, outside the agent-controlled workspace.
    const runner = buildWorkflow.indexOf('cat > "$RUNNER_TEMP/atlas-gates.sh"');
    expect(runner).toBeGreaterThan(-1);
    expect(runner).toBeLessThan(buildWorkflow.indexOf("uses: anthropics/claude-code-action@"));
    expect(buildWorkflow).toContain("for gate in install lint typecheck test arch build test:e2e acceptance; do");
    expect(buildWorkflow).toContain('if ! run > "$log" 2>&1; then');
    // The agent's shell can write under $RUNNER_TEMP: the runner's hash is checked before each of its two runs.
    expect(buildWorkflow.match(/\/usr\/bin\/sha256sum --check --status/g)?.length).toBeGreaterThanOrEqual(3);
    // Final check after the (optional) repair run, before any App token.
    const finalGates = buildWorkflow.indexOf("- name: Verify the quality gates after the repair");
    expect(finalGates).toBeGreaterThan(buildWorkflow.indexOf("id: agent_fix"));
    expect(finalGates).toBeLessThan(buildWorkflow.indexOf("permission-contents: write"));
    expect(buildWorkflow).toContain("if: steps.gates.outcome == 'success'");
  });

  it("refuses changes under .github/ and pushes only atlas/ branches, never main", () => {
    expect(buildWorkflow).toContain("grep -E '^\\.github/'");
    expect(buildWorkflow).toMatch(/case "\$BRANCH" in\n\s+atlas\/\*\) ;;\n\s+\*\) echo "::error::refusing to push/);
    const pushes = buildWorkflow.match(/\bpush\b[^\n]*origin[^\n]*/g) ?? [];
    expect(pushes).toEqual(['push --quiet origin "HEAD:refs/heads/$BRANCH"']);
    expect(buildWorkflow).toContain('echo "branch=atlas/$RUN_ID/$MISSION_ID"');
  });

  it("reports a distinct rate_limited status without failing the job", () => {
    expect(buildWorkflow).toContain("status=rate_limited");
    expect(buildWorkflow).toMatch(/if \[ "\$status" = "failed" \]; then\n[^\n]*\n\s*exit 1/);
    for (const output of ["status:", "pr_number:", "input_tokens:", "output_tokens:"]) {
      expect(buildWorkflow).toMatch(new RegExp(`^ {6}${output} \\$\\{\\{ steps\\.result\\.outputs\\.`, "m"));
    }
  });
});

describe("Build workflow proof counts (story 6.2)", () => {
  it("writes the Vitest and Playwright JSON reports and the proof counts from the gate runner", () => {
    expect(buildWorkflow).toContain('pnpm test --reporter=default --reporter=json "--outputFile.json=$proof_raw/vitest.json"');
    expect(buildWorkflow).toContain('--slurpfile e2e test-results/e2e.json');
    expect(buildWorkflow).toContain('mv "$proof_raw/proof.json" "$RUNNER_TEMP/atlas-out/proof.json"');
    // Written only after the last gate passed.
    expect(buildWorkflow).toMatch(/\n {10}done\n {10}write_proof\n {10}GATES\n/);
  });

  it("adds the re-validated counts (or null) to result.json in publish, counts only", () => {
    const publishJob = buildWorkflow.slice(buildWorkflow.indexOf("\n  publish:\n"));
    expect(publishJob).toContain('if [ "$status" = "succeeded" ] && [ -s "$proof_file" ]');
    expect(publishJob).toContain("acceptance: {criteria: (.acceptance.criteria | count), covered: (.acceptance.covered | count)}");
    expect(publishJob).toContain('--argjson proof "$proof"');
    expect(publishJob).toContain("proof: $proof}");
  });

  it("puts the mini-spec in the PR body, where the reviewer reads the acceptance criteria", () => {
    expect(buildWorkflow).toContain('echo "## Mini-spec"');
    expect(buildWorkflow).toContain('cat "$input_dir/mini-spec.md"');
  });
});

describe("Review workflow: verify job (story 6.2)", () => {
  const verify = jobOf(reviewWorkflow, "verify");

  it("runs for ATLAS branches of this repository only, with a read-only token, no secret and no environment", () => {
    expect(verify).toMatch(
      /if: >-\n\s+startsWith\(github\.event\.pull_request\.head\.ref, 'atlas\/'\) &&\n\s+github\.event\.pull_request\.head\.repo\.full_name == github\.repository\n/,
    );
    expect(verify).toMatch(/^ {4}permissions:\n {6}contents: read\n(?! {6})/m);
    expect(verify).not.toMatch(/secrets\.|^\s+environment:|github\.token|claude-code-action|create-github-app-token/m);
    expect(verify).not.toMatch(/^\s+needs:/m);
  });

  it("blocks egress first, with the build allowlist minus every Anthropic host", () => {
    const firstStep = verify.slice(verify.indexOf("    steps:\n"));
    expect(firstStep).toMatch(/^ {4}steps:\n(?: {6}#[^\n]*\n)* {6}- name: [^\n]+\n {8}uses: step-security\/harden-runner@[0-9a-f]{40} [^\n]*\n {8}with:\n {10}egress-policy: block\n/);
    const allowed = (/allowed-endpoints: >\n((?: {12}\S+\n)+)/.exec(verify)?.[1] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    expect(allowed).toContain("registry.npmjs.org:443");
    expect(allowed).toContain("cdn.playwright.dev:443");
    expect(allowed.filter((host) => /anthropic|claude/.test(host))).toEqual([]);
    const buildAllowed = (/allowed-endpoints: >\n((?: {12}\S+\n)+)/.exec(buildWorkflow)?.[1] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    expect(allowed.sort()).toEqual(buildAllowed.filter((host) => !/anthropic|claude/.test(host)).sort());
  });

  it("checks out the PR head without credentials and runs no PR script before sudo is gone", () => {
    expect(verify).toMatch(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\s+persist-credentials: false\n/);
    const install = verify.indexOf("pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile");
    const drop = verify.indexOf("- name: Drop root and containers before the PR code runs");
    const gates = verify.indexOf("- name: Run the gates and collect the evidence");
    expect(install).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(install);
    expect(gates).toBeGreaterThan(drop);
    expect(verify).toContain('if sudo -n true > /dev/null 2>&1; then');
    expect(verify.slice(gates)).not.toMatch(/\bsudo\b/);
  });

  it("runs every gate including e2e and uploads the evidence bundle even when a gate fails", () => {
    expect(verify).toContain("for gate in install lint typecheck test arch build test:e2e; do");
    expect(verify).toContain('"--outputFile.json=$out/vitest.json"');
    expect(verify).toContain('cp test-results/e2e.json "$out/e2e.json"');
    const upload = verify.slice(verify.indexOf("- name: Upload the evidence bundle"));
    expect(upload).toMatch(/^- name: Upload the evidence bundle\n {8}if: always\(\)\n {8}uses: actions\/upload-artifact@[0-9a-f]{40} [^\n]*\n {8}with:\n {10}name: atlas-proof\n/);
    expect(verify).toContain("if: steps.gates.outputs.failed != '0'");
  });
});

describe("Review workflow (independent reviewer)", () => {
  it("runs on pull_request_target only, for PRs into main", () => {
    expect(reviewWorkflow).toMatch(/^on:\n {2}pull_request_target:\n {4}types: \[opened, synchronize, reopened\]\n {4}branches: \[main\]\n/m);
    expect(reviewWorkflow).not.toMatch(/^\s*(push|pull_request|workflow_dispatch|workflow_run):/m);
  });

  it("grants no default permission and only statuses: write per job", () => {
    expect(reviewWorkflow).toMatch(/^permissions: \{\}\n/m);
    expect(writeGrants(reviewWorkflow)).toEqual(["statuses: write", "statuses: write"]);
    expect(reviewWorkflow).toMatch(/^ {4}permissions:\n {6}contents: read\n {6}pull-requests: read\n {6}statuses: write\n(?! {6})/m);
  });

  it("never runs PR code outside the verify job: no install, build, test or node step", () => {
    for (const job of [jobOf(reviewWorkflow, "pass-through"), jobOf(reviewWorkflow, "review")]) {
      const blocks = runBlocks(job);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).not.toMatch(/\b(pnpm|npm|npx|node|yarn|bun|corepack|make|bash \.|sh \.)\b/);
        expect(block).not.toMatch(/\.atlas-pr\/[^\s"']*\.(sh|js|ts|mjs|cjs|jq)\b/);
      }
      expect(job).not.toContain("actions/setup-node@");
    }
    expect(reviewWorkflow).not.toMatch(/uses: \.\//);
  });

  it("reviews after verify, even when verify failed, but not for a cancelled run (story 6.2)", () => {
    const review = jobOf(reviewWorkflow, "review");
    expect(review).toMatch(/^ {4}needs: verify\n/m);
    expect(review).toMatch(/if: >-\n\s+!cancelled\(\) &&\n\s+startsWith\(github\.event\.pull_request\.head\.ref, 'atlas\/'\) &&\n/);
  });

  it("hands the evidence to the reviewer as validated data only (story 6.2)", () => {
    const review = jobOf(reviewWorkflow, "review");
    const download = review.indexOf("uses: actions/download-artifact@");
    expect(download).toBeGreaterThan(review.indexOf("- name: Checkout the PR head as data"));
    expect(review.slice(download)).toMatch(/^uses: actions\/download-artifact@[0-9a-f]{40} [^\n]*\n {8}with:\n {10}name: atlas-proof\n {10}path: \$\{\{ runner\.temp \}\}\/atlas-proof-raw\n/);
    const evidence = review.slice(review.indexOf("- name: Validate the evidence"), review.indexOf("- name: Install bubblewrap"));
    // Symbolic links or special files refuse the bundle; only JSON objects and real PNGs, size-capped, are copied.
    expect(evidence).toContain('find "$raw" \\( -type l -o \\( ! -type f ! -type d \\) \\) -print -quit');
    expect(evidence).toContain("gates.json | vitest.json | e2e.json)");
    expect(evidence).toContain('[ "$magic" != "89504e470d0a1a0a" ]');
    expect(evidence).toContain("max_json=$((5 * 1024 * 1024))");
    expect(evidence).toContain("max_png=$((5 * 1024 * 1024))");
    expect(evidence).toContain("-f .github/atlas/proof-summary.jq > \"$dest/summary.json\"");
    // The summary is computed before the reviewer runs, which still only reads.
    expect(review.indexOf("- name: Validate the evidence")).toBeLessThan(review.indexOf("uses: anthropics/claude-code-action@"));
    expect(review).toContain('--allowedTools "Read,Glob,Grep"');
    expect(review).toContain('--disallowedTools "Bash,Edit,MultiEdit,Write,NotebookEdit,WebFetch,WebSearch"');
  });

  it("turns an approval without full proof into a change request, in code (story 6.2)", () => {
    const post = reviewWorkflow.slice(reviewWorkflow.indexOf("- name: Post the verdict"));
    const override = post.indexOf('if [ "$verdict" = "approve" ] && ! jq -e \'.proved == true\' "$proof" > /dev/null; then');
    expect(override).toBeGreaterThan(-1);
    expect(override).toBeLessThan(post.indexOf('if [ "$verdict" = "approve" ]; then event=APPROVE'));
    expect(post).toContain('verdict=request_changes');
  });

  it("reads instructions from the base branch and the PR head only as stripped data", () => {
    const baseCheckout = reviewWorkflow.slice(
      reviewWorkflow.indexOf("- name: Checkout the base branch"),
      reviewWorkflow.indexOf("- name: Checkout the PR head"),
    );
    expect(baseCheckout).not.toMatch(/\bref:/);
    const headCheckout = reviewWorkflow.slice(reviewWorkflow.indexOf("- name: Checkout the PR head"));
    expect(headCheckout).toMatch(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\s+path: \.atlas-pr\n/);
    expect(reviewWorkflow).toContain("cat .github/atlas/review-prompt.md");
    expect(reviewWorkflow).toContain("-name CLAUDE.md -o -name CLAUDE.local.md -o -name .claude -o -name .mcp.json");
    expect(reviewWorkflow).toContain("-type l -print0 | xargs -0 -r rm -f");
    expect(reviewWorkflow).toContain('--allowedTools "Read,Glob,Grep"');
    // The PR checkout must stay visible to Glob/Grep (ripgrep honours git excludes).
    expect(reviewWorkflow).not.toMatch(/\.atlas-pr\/?[^\n]*>> \.git\/info\/exclude/);
  });

  it("validates the atlas/{run_id}/{mission_id} branch name", () => {
    expect(reviewWorkflow).toContain(
      '[[ "$HEAD_REF" =~ ^atlas/run_[0-9A-HJKMNP-TV-Z]{26}/msn_[0-9A-HJKMNP-TV-Z]{26}$ ]]',
    );
  });

  it("sets atlas-review for same-repo PRs only (never on a fork's head), with the job token", () => {
    const passThrough = reviewWorkflow.slice(reviewWorkflow.indexOf("  pass-through:"), reviewWorkflow.indexOf("  review:"));
    expect(passThrough).toMatch(
      /if: >-\n\s+github\.event\.pull_request\.head\.repo\.full_name == github\.repository &&\n\s+!startsWith\(github\.event\.pull_request\.head\.ref, 'atlas\/'\)\n/,
    );
    expect(passThrough).toContain("-f state=success -f context=atlas-review");
    expect(reviewWorkflow).toContain('set_status failure "ATLAS reviewer requested changes"');
    expect(reviewWorkflow).toContain('set_status success "ATLAS reviewer approved"');
    expect(reviewWorkflow).toContain("STATUS_TOKEN: ${{ github.token }}");
  });

  it("enables auto-merge only after approval, on the reviewed head, outside CODEOWNERS paths", () => {
    const merge = reviewWorkflow.indexOf('--auto --squash --match-head-commit "$HEAD_SHA"');
    expect(merge).toBeGreaterThan(reviewWorkflow.indexOf('set_status success "ATLAS reviewer approved"'));
    expect(merge).toBeGreaterThan(reviewWorkflow.indexOf('if [ "$SENSITIVE" = "true" ]; then'));
    expect(reviewWorkflow).toContain(".github/CODEOWNERS");
    expect(reviewWorkflow.match(/--auto\b/g)).toHaveLength(1);
  });
});

describe("Every workflow action is pinned by commit SHA", () => {
  for (const [name, content] of [
    ["ci.yml", workflow],
    ["deploy.yml", deployWorkflow],
    ["build.yml", buildWorkflow],
    ["review.yml", reviewWorkflow],
  ] as const) {
    it(name, () => {
      const uses = [...content.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1] ?? "");
      expect(uses.length).toBeGreaterThan(0);
      for (const ref of uses) {
        expect(ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      }
    });
  }
});
