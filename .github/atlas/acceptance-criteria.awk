# Acceptance criteria of a mini-spec, one per line, in order: line n is criterion ACn (story 6.2).
# The one parser of criteria: build.yml runs it on `.atlas-run/mini-spec.md` (before the agent runs), review.yml
# on the PR body, which holds the same mini-spec under `## Mini-spec` (written by build.yml's publish job).
# - With a `## Mini-spec` heading, only what follows the last one counts (an intention quoted above it cannot
#   add criteria).
# - The list is the numbered items (`1. ...` or `1) ...`) under `## Acceptance criteria`, up to the next heading or
#   a horizontal rule (`---`, `***`, `___`); blank or unnumbered lines inside it are skipped.
# POSIX awk only (no interval expressions): mawk, gawk and BSD awk agree.
{ sub(/\r$/, "") }
/^##[[:space:]]+Mini-spec[[:space:]]*$/ { in_list = 0; n = 0; next }
/^##[[:space:]]+Acceptance criteria/ { in_list = 1; next }
in_list && /^#+[[:space:]]/ { in_list = 0; next }
in_list && /^[[:space:]]*(---+|\*\*\*+|___+)[[:space:]]*$/ { in_list = 0; next }
in_list && /^[[:space:]]*[0-9]+[.)][[:space:]]+[^[:space:]]/ {
  line = $0
  sub(/^[[:space:]]*[0-9]+[.)][[:space:]]+/, "", line)
  criteria[++n] = line
  next
}
END { for (i = 1; i <= n; i++) print criteria[i] }
