# Delivery evidence summary (story 6.2). review.yml runs it with jq, from the base branch, prepended with
# named-tests.jq; no PR code runs there. The evidence itself (reports, screenshots, gate outcomes) comes from the
# PR's `ci` run: it is self-reported by PR code and checked here only for shape and consistency.
# Inputs (jq -n, each --slurpfile gives [value]):
#   $criteria   [string]                     criteria of the PR body's mini-spec (acceptance-criteria.awk)
#   $gates      {head_sha, gates: [{name, status}]} | null   gate outcomes recorded by `ci`
#   $unit       Vitest JSON report | null
#   $e2e        Playwright JSON report | null
#   $shots      [path]                       validated screenshots under .atlas-proof/shots/
#   $problems   [string]                     what fetching or validating the bundle refused or dropped
#   $changed    [path]                       files the PR adds or changes (only their tests can prove)
#   $scrutinize [string]                     changes that could bend the evidence (scripts, test configs, reporters)
# --arg head_sha (the PR head) and --arg ci (the conclusion of the `ci` run on it). Output: .atlas-proof/summary.json.

def count: if type == "number" and . >= 0 and . == floor then . else null end;
def text($max): if type == "string" then (if length > $max then .[0:$max] + "…" else . end) else null end;
def strings_of: if type == "array" then map(select(type == "string")) else [] end;

[ "install", "lint", "typecheck", "test", "arch", "build", "test:e2e" ] as $expected_gates
| ($criteria[0] | strings_of) as $acs
| ($gates[0] | if type == "object" then . else {} end) as $g
| ($unit[0] | if type == "object" then . else null end) as $u
| ($e2e[0] | if type == "object" then . else null end) as $e
| ($shots[0] | strings_of) as $screenshots
| ($problems[0] | strings_of | map(select(. != ""))) as $bundle_problems
| ($changed[0] | strings_of) as $changed_files
| ($scrutinize[0] | strings_of) as $to_scrutinize

| [ $g.gates | arrays | .[] | objects
    | { name: (.name | text(40)), status: (if .status == "passed" then "passed" elif .status == "failed" then "failed" else "not run" end) } ]
  as $gate_results

| [ named_tests($u; $e)[] | select(in_files($changed_files)) ] as $tests

| ($u | if type == "object" then . else {} end) as $uo
| ($e | if type == "object" then (.stats | if type == "object" then . else {} end) else {} end) as $es
| (if ($uo.numPassedTests | count) != null and ($uo.numFailedTests | count) != null
   then { passed: $uo.numPassedTests, failed: $uo.numFailedTests } else null end) as $unit_counts
| (if ($es.expected | count) != null and ($es.unexpected | count) != null
   then { passed: $es.expected, failed: ($es.unexpected + ($es.flaky | count // 0)) } else null end) as $e2e_counts

| [ $acs | to_entries[] | (.key + 1) as $i
    | criterion_coverage($i; $tests)
    | { id, text: ($acs[$i - 1] | text(500)), covered,
        tests: [ .tests[] | { kind, file, name: (.name | text(300)), status, proves } ] } ] as $items

| ([ $items[] | select(.covered) ] | length) as $covered
| [ $expected_gates[] as $name
    | ([ $gate_results[] | select(.name == $name) ] | first) as $r
    | if $r == null then "gate \($name) did not report"
      elif $r.status != "passed" then "gate \($name) \($r.status)"
      else empty end ] as $gate_reasons

| ( $bundle_problems
    + (if $ci != "success" then [ "the ci run on the PR head did not succeed (\($ci))" ] else [] end)
    + (if ($g.head_sha // "") != $head_sha then [ "the evidence is not for the PR head \($head_sha)" ] else [] end)
    + $gate_reasons
    + (if $unit_counts == null then [ "no readable unit test report" ]
       elif $unit_counts.failed > 0 then [ "\($unit_counts.failed) unit test(s) failed" ] else [] end)
    + (if $e2e_counts == null then [ "no readable e2e report" ]
       elif $e2e_counts.failed > 0 then [ "\($e2e_counts.failed) e2e test(s) failed or flaky" ]
       elif $e2e_counts.passed == 0 then [ "no e2e test passed" ] else [] end)
    + (if ($acs | length) == 0 then [ "the PR body has no numbered acceptance criteria under its mini-spec" ] else [] end)
    + [ $items[] | select(.covered | not)
        | if (.tests | length) == 0 then "\(.id) has no test named after it in the files this PR changes"
          else "\(.id) has a named test that did not pass (\([ .tests[] | select(.proves | not) | .status ] | unique | join(", ")))" end ]
    + (if ($screenshots | length) == 0 then [ "no screenshot" ] else [] end)
  ) as $reasons

| {
    head_sha: $head_sha,
    ci_conclusion: $ci,
    proved: (($reasons | length) == 0),
    reasons: $reasons,
    scrutinize: $to_scrutinize,
    unit: $unit_counts,
    e2e: $e2e_counts,
    acceptance: { criteria: ($acs | length), covered: $covered, items: $items },
    gates: $gate_results,
    screenshots: $screenshots,
    reports: {
      unit: (if $u == null then null else ".atlas-proof/vitest.json" end),
      e2e: (if $e == null then null else ".atlas-proof/e2e.json" end),
      gates: (if $gates[0] == null then null else ".atlas-proof/gates.json" end)
    },
    bundle_problems: $bundle_problems
  }
