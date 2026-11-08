#!/bin/bash
# Ensure the tbd CLI is available and run `tbd prime`.
# Installed by: tbd setup --auto. Runs on SessionStart and PreCompact.
#
# Local-first when the installed CLI can read this repository's tbd_format. Otherwise,
# run the exact version recorded by setup in .tbd/config.yml, under a 14-day supply-chain
# cool-off (see tbd_run_configured_fallback). Keeping the pin in config avoids rewriting
# this script for every compatible patch.

# Prefer common user-local bin directories. TBD_HOOK_PATH_PREFIX replaces this list; an
# empty value leaves PATH unchanged.
tbd_hook_path_prefix=${TBD_HOOK_PATH_PREFIX-"$HOME/.local/bin:$HOME/bin:/usr/local/bin"}
if [ -n "$tbd_hook_path_prefix" ]; then
  export PATH="$tbd_hook_path_prefix:$PATH"
fi

# Resolve the repository from this script's fixed install location (.claude/scripts/ or
# .codex/), never by searching ancestors or asking git.
script_path=${BASH_SOURCE[0]}
script_parent=${script_path%/*}
if [ "$script_parent" = "$script_path" ]; then
  script_parent=.
fi
if ! script_dir=$(CDPATH= cd -- "$script_parent" && pwd -P); then
  echo "[tbd] Cannot resolve the session hook directory." >&2
  exit 1
fi
case "$script_dir" in
  */.claude/scripts) repo_root=${script_dir%/.claude/scripts} ;;
  */.codex) repo_root=${script_dir%/.codex} ;;
  *)
    echo "[tbd] Unexpected session hook location: $script_dir" >&2
    exit 1
    ;;
esac
repo_root=${repo_root:-/}
if [ ! -f "$repo_root/.tbd/config.yml" ]; then
  echo "[tbd] Cannot locate repository .tbd/config.yml at $repo_root." >&2
  exit 1
fi
if ! cd -- "$repo_root"; then
  echo "[tbd] Cannot enter repository root: $repo_root" >&2
  exit 1
fi

tbd_configured_fallback_version() {
  local config_path=$1
  local line configured_fallback_version
  local version_pattern='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'

  while IFS= read -r line; do
    if [[ $line =~ ^tbd_fallback_version:[[:space:]]*([^[:space:]]+)[[:space:]]*$ ]]; then
      configured_fallback_version=${BASH_REMATCH[1]}
      if [[ $configured_fallback_version =~ $version_pattern ]]; then
        printf '%s\n' "$configured_fallback_version"
        return 0
      fi
      return 1
    fi
  done < "$config_path"
  return 1
}

tbd_local_can_read_repository() {
  command -v tbd &> /dev/null && tbd config get tbd_format >/dev/null 2>&1
}

TBD_FALLBACK_COOL_OFF_DAYS=14

tbd_fallback_cutoff() {
  local cutoff
  if ! command -v node &> /dev/null; then
    echo "[tbd] node is required to compute the cool-off cutoff for the npx fallback." >&2
    return 1
  fi
  if ! cutoff=$(node -e 'console.log(new Date(Date.now() - Number(process.argv[1]) * 86400000).toISOString())' "$TBD_FALLBACK_COOL_OFF_DAYS") ||
    [[ ! $cutoff =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$ ]]; then
    echo "[tbd] node failed to compute the cool-off cutoff for the npx fallback." >&2
    return 1
  fi
  printf '%s\n' "$cutoff"
}

# Run the configured fallback get-tbd@<pin> with "$@" under the cool-off, and return its
# exit status. Read and validate the exact pin first, so a malformed or hand-edited config
# value never becomes an executable package spec.
tbd_run_configured_fallback() {
  local configured_fallback_version cutoff status
  if ! configured_fallback_version=$(tbd_configured_fallback_version ".tbd/config.yml"); then
    echo "[tbd] .tbd/config.yml does not contain a valid exact tbd_fallback_version." >&2
    echo "[tbd] Run a current 'tbd setup --auto' to repair the managed launcher." >&2
    return 1
  fi
  if ! command -v npx &> /dev/null; then
    if command -v tbd &> /dev/null; then
      echo "[tbd] Local tbd cannot read this repository format, and npx is unavailable." >&2
    else
      echo "[tbd] tbd CLI not found and npx is unavailable." >&2
    fi
    if cutoff=$(tbd_fallback_cutoff 2> /dev/null); then
      echo "[tbd] Install it with: npm install -g --ignore-scripts --before=$cutoff get-tbd@$configured_fallback_version" >&2
    else
      echo "[tbd] Install it with: npm install -g --ignore-scripts get-tbd@$configured_fallback_version" >&2
      echo "[tbd] Use a get-tbd release published at least $TBD_FALLBACK_COOL_OFF_DAYS days ago." >&2
    fi
    return 1
  fi
  if command -v tbd &> /dev/null; then
    echo "[tbd] Local tbd cannot read this repository format; using configured fallback get-tbd@$configured_fallback_version." >&2
  else
    echo "[tbd] tbd CLI not found; using configured fallback get-tbd@$configured_fallback_version." >&2
  fi
  if ! cutoff=$(tbd_fallback_cutoff); then
    return 1
  fi
  npx --yes --before="$cutoff" --ignore-scripts --cache="${XDG_CACHE_HOME:-$HOME/.cache}/tbd-fallback-npm" "get-tbd@$configured_fallback_version" "$@"
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "[tbd] The get-tbd@$configured_fallback_version fallback exited with status $status." >&2
    echo "[tbd] If npm found no matching version, the pin was published after $cutoff and is still inside the $TBD_FALLBACK_COOL_OFF_DAYS-day cool-off." >&2
  fi
  return "$status"
}

if tbd_local_can_read_repository; then
  # Mint this working directory's agent id once, before priming, so tbd start has an
  # identity to claim under. Idempotent: SessionStart fires again on resume, clear, and
  # compact, and re-running must not mint a second agent for the same session.
  # Failure here is never fatal - identity resolution falls back to a derived name, and
  # an agent that cannot name itself precisely should still get its briefing.
  tbd whoami --ensure-id --quiet >/dev/null 2>&1 || true
  tbd prime "$@"
  exit $?
fi

tbd_run_configured_fallback prime "$@"
exit $?
