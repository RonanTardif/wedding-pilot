#!/usr/bin/env bash
# Fails if the Anthropic API key variable name appears anywhere under <dir> (default: repo root),
# in any case and with "_", "-" or no separator. node_modules, .next and .git are skipped.
# The pattern is assembled at runtime so this script does not match itself.
# Exit codes: 0 clean, 1 forbidden key found, 2 scan error (missing dir, unreadable file, ...).
set -uo pipefail

dir="${1:-.}"
if [ ! -d "$dir" ]; then
  echo "::error::guard-forbidden-key: directory not found: $dir" >&2
  exit 2
fi

sep="[_-]?"
pattern="anthropic${sep}api${sep}key"

grep -rniE --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git -- "$pattern" "$dir"
status=$?

case "$status" in
  0)
    echo "::error::guard-forbidden-key: the Anthropic API key name must never appear in this repo (found under $dir)"
    exit 1
    ;;
  1)
    echo "guard-forbidden-key: no occurrence of the forbidden key under $dir"
    exit 0
    ;;
  *)
    echo "::error::guard-forbidden-key: scan failed (grep exit code $status)" >&2
    exit 2
    ;;
esac
