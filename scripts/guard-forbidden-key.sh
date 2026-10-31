#!/usr/bin/env bash
# Fails (exit 1) if the Anthropic API key name appears anywhere under <dir>.
# The key name is assembled at runtime so this script does not match itself.
set -euo pipefail

dir="${1:-.github}"
if [ ! -d "$dir" ]; then
  echo "guard-forbidden-key: directory not found: $dir" >&2
  exit 2
fi

forbidden="ANTHROPIC""_API_KEY"
if grep -rn -- "$forbidden" "$dir"; then
  echo "::error::$forbidden must never appear under $dir/"
  exit 1
fi
echo "guard-forbidden-key: no occurrence of the forbidden key under $dir/"
