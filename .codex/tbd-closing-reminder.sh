#!/bin/bash
# Remind about close protocol after git push
# Installed by: tbd setup --auto

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Check if this is a git push command and .tbd exists
if [[ "$command" == git\ push* ]] || [[ "$command" == *"&& git push"* ]] || [[ "$command" == *"; git push"* ]]; then
  # The hook may start in a subdirectory; check .tbd at the repo root.
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null) && cd "$repo_root"
  if [ -d ".tbd" ]; then
    # Same local-first, version-pinned fallback as tbd-session.sh, so the
    # reminder still fires when tbd is missing or too old for this repository.
    export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
    tbd_version_at_least() {
  local version_pattern='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
  local installed_major installed_minor installed_patch
  local required_major required_minor required_patch

  if [[ $1 =~ $version_pattern ]]; then
    installed_major=${BASH_REMATCH[1]}
    installed_minor=${BASH_REMATCH[2]}
    installed_patch=${BASH_REMATCH[3]}
  else
    return 1
  fi
  if [[ $2 =~ $version_pattern ]]; then
    required_major=${BASH_REMATCH[1]}
    required_minor=${BASH_REMATCH[2]}
    required_patch=${BASH_REMATCH[3]}
  else
    return 1
  fi

  if (( installed_major != required_major )); then
    (( installed_major > required_major ))
    return
  fi
  if (( installed_minor != required_minor )); then
    (( installed_minor > required_minor ))
    return
  fi
  (( installed_patch >= required_patch ))
}
    installed_tbd_version=""
    if command -v tbd &> /dev/null; then
      installed_tbd_version=$(tbd --version 2>/dev/null || true)
    fi
    if [ -n "$installed_tbd_version" ] && tbd_version_at_least "$installed_tbd_version" "0.6.2"; then
      tbd closing
    elif command -v npx &> /dev/null; then
      npx --yes get-tbd@0.6.2 closing
    fi
  fi
fi

exit 0
