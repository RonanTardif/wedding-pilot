# Delivery evidence summary (story 6.2), run by review.yml with jq from the base branch, never by PR code.
# Inputs (jq -n, all --slurpfile so each is [value]):
#   $criteria  [string]        acceptance criteria of the PR body's mini-spec, in order (AC1, AC2...)
#   $gates     {head_sha, gates: [{name, status, output}]} | null   per-gate results from the verify job
#   $unit      Vitest JSON report | null
#   $e2e       Playwright JSON report | null
#   $shots     [path]          validated screenshots under .atlas-proof/shots/
#   $problems  [string]        what the bundle validation dropped or refused
# and --arg head_sha, --arg verify (the verify job result). Output: .atlas-proof/summary.json.
# A criterion is covered when at least one test named after it (title starting with AC<n>, e.g. "AC2: ...")
# exists in the reports and every such test passed.

def count: if type == "number" and . >= 0 and . == floor then . else null end;
def text($max): if type == "string" then (if length > $max then .[0:$max] + "…" else . end) else null end;
def named($i): test("^AC-?" + ($i | tostring) + "([^0-9]|$)");
def relpath: if type == "string" then sub("^.*?/(?=(src|tests)/)"; "") else "" end;

[ "install", "lint", "typecheck", "test", "arch", "build", "test:e2e" ] as $expected_gates
| ($criteria[0] // [] | if type == "array" then . else [] end) as $acs
| ($gates[0] // {} | if type == "object" then . else {} end) as $g
| ($unit[0] // {} | if type == "object" then . else {} end) as $u
| ($e2e[0] // {} | if type == "object" then . else {} end) as $e
| ($shots[0] // []) as $screenshots
| ($problems[0] // [] | map(select(. != ""))) as $bundle_problems

| [ $g.gates[]? | select(type == "object")
    | { name: (.name | text(40)), status: (if .status == "passed" then "passed" else "failed" end),
        output: (.output | text(20000)) } ] as $gate_results

| [ $u.testResults[]? | select(type == "object") | (.name | relpath) as $file
    | .assertionResults[]? | select(type == "object")
    | { kind: "unit", file: $file, title: (.title | text(300) // ""), name: (.fullName | text(300) // ""),
        passed: (.status == "passed") } ] as $unit_tests
| [ $e | .. | objects | select(has("specs")) | .specs[]? | select(type == "object")
    | { kind: "e2e", file: (.file | text(300) // ""), title: (.title | text(300) // ""), name: (.title | text(300) // ""),
        passed: (.ok == true) } ] as $e2e_tests

| (if ($u.numPassedTests | count) != null and ($u.numFailedTests | count) != null
   then { passed: $u.numPassedTests, failed: $u.numFailedTests } else null end) as $unit_counts
| (if ($e.stats.expected | count) != null and ($e.stats.unexpected | count) != null
   then { passed: ($e.stats.expected + ($e.stats.flaky // 0 | count // 0)), failed: $e.stats.unexpected } else null end) as $e2e_counts

| [ $acs | to_entries[] | (.key + 1) as $i
    | [ ($unit_tests + $e2e_tests)[] | select(.title | named($i)) ] as $tests
    | { id: "AC\($i)", text: (.value | text(500)), covered: (($tests | length) > 0 and all($tests[]; .passed)),
        tests: [ $tests[] | { kind, file, name, passed } ] } ] as $items

| ([ $items[] | select(.covered) ] | length) as $covered
| [ $expected_gates[] as $name
    | ([ $gate_results[] | select(.name == $name) ] | first // null) as $r
    | if $r == null then "gate \($name) did not report"
      elif $r.status != "passed" then "gate \($name) failed"
      else empty end ] as $gate_reasons

| ( $bundle_problems
    + (if $verify != "success" then [ "the verify job did not succeed (\($verify))" ] else [] end)
    + (if ($g.head_sha // "") != $head_sha then [ "the evidence is not for the PR head \($head_sha)" ] else [] end)
    + $gate_reasons
    + (if $unit_counts == null then [ "no readable unit test report" ]
       elif $unit_counts.failed > 0 then [ "\($unit_counts.failed) unit test(s) failed" ] else [] end)
    + (if $e2e_counts == null then [ "no readable e2e report" ]
       elif $e2e_counts.failed > 0 then [ "\($e2e_counts.failed) e2e test(s) failed" ]
       elif $e2e_counts.passed == 0 then [ "no e2e test passed" ] else [] end)
    + (if ($acs | length) == 0 then [ "the PR body has no numbered acceptance criteria under its mini-spec" ] else [] end)
    + [ $items[] | select(.covered | not)
        | if (.tests | length) == 0 then "\(.id) has no test named after it" else "\(.id) has a failing named test" end ]
    + (if ($screenshots | length) == 0 then [ "no screenshot" ] else [] end)
  ) as $reasons

| {
    head_sha: $head_sha,
    verify_job: $verify,
    proved: (($reasons | length) == 0),
    reasons: $reasons,
    unit: $unit_counts,
    e2e: $e2e_counts,
    acceptance: { criteria: ($acs | length), covered: $covered, items: $items },
    gates: $gate_results,
    screenshots: $screenshots,
    reports: {
      unit: (if $unit[0] == null then null else ".atlas-proof/vitest.json" end),
      e2e: (if $e2e[0] == null then null else ".atlas-proof/e2e.json" end),
      gates: (if $gates[0] == null then null else ".atlas-proof/gates.json" end)
    },
    bundle_problems: $bundle_problems
  }
