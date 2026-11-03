# The one definition of a test that proves an acceptance criterion (story 6.2), shared by build.yml's acceptance
# gate and review.yml's evidence summary (prepended to their jq programs).
# - A named test is a test (never a describe block) whose own title starts with AC<n> followed by a word boundary:
#   "AC2: shows the score" names AC2; "AC20 ..." and "AC2x" do not.
# - It proves only when it passed: Vitest status "passed"; Playwright: at least one run, every run's expected
#   status "passed" and every result "passed" (skipped, fixme, todo, flaky retries and failures never prove).
# - Only tests in the files the change adds or modifies count (`$files`, repository-relative; null = all files).
# - A criterion is covered when it has at least one named test and every one of them proves it.
# Malformed reports give no tests (never an error).

def atlas_text: if type == "string" then . else "" end;
def atlas_relpath: atlas_text | sub("^.*?/(?=(src|tests)/)"; "");

# [{kind, file, title, name, status, proves}] from a Vitest JSON report and a Playwright JSON report (or null).
def named_tests($unit; $e2e):
  [ ($unit | objects | .testResults | arrays | .[] | objects
      | (.name | atlas_relpath) as $file
      | .assertionResults | arrays | .[] | objects
      | { kind: "unit", file: $file, title: (.title | atlas_text), name: (.fullName | atlas_text),
          status: (.status | atlas_text), proves: (.status == "passed") } ),
    ($e2e | objects | ((.config | objects | .rootDir) // "" | atlas_text) as $root
      | .. | objects | select(has("specs")) | .specs | arrays | .[] | objects
      | (.tests | if type == "array" then . else [] end) as $runs
      | { kind: "e2e",
          file: (if $root == "" then (.file | atlas_text) else ($root + "/" + (.file | atlas_text)) | atlas_relpath end),
          title: (.title | atlas_text), name: (.title | atlas_text),
          status: ([ $runs[] | objects | .results | arrays | .[] | objects | .status | atlas_text ] | unique | join(",")),
          proves: (($runs | length) > 0
            and all($runs[]; type == "object" and .expectedStatus == "passed"
              and (.results | type) == "array" and (.results | length) > 0
              and all(.results[]; type == "object" and .status == "passed"))) } ) ];

def in_files($files): if $files == null then true else (.file as $f | any($files[]; . == $f)) end;

def names_criterion($i): .title | test("^AC-?" + ($i | tostring) + "\\b");

# {id, covered, tests} for criterion number $i among $tests (already restricted to the change's files).
def criterion_coverage($i; $tests):
  [ $tests[] | select(names_criterion($i)) ] as $named
  | { id: "AC\($i)", covered: (($named | length) > 0 and all($named[]; .proves)), tests: $named };
