#!/bin/bash
# Remind about the close protocol after git push.
# Installed by: tbd setup --auto. Runs after every Bash tool call and reads the hook's
# JSON input on stdin.

# Resolve the repository from this script's fixed install location (.claude/hooks/ or
# .codex/), never by searching ancestors or asking git.
script_path=${BASH_SOURCE[0]}
script_parent=${script_path%/*}
if [ "$script_parent" = "$script_path" ]; then
  script_parent=.
fi
if ! script_dir=$(CDPATH= cd -- "$script_parent" && pwd -P); then
  echo "[tbd] Cannot resolve the closing hook directory." >&2
  exit 1
fi
case "$script_dir" in
  */.claude/hooks) repo_root=${script_dir%/.claude/hooks} ;;
  */.codex) repo_root=${script_dir%/.codex} ;;
  *)
    echo "[tbd] Unexpected closing hook location: $script_dir" >&2
    exit 1
    ;;
esac
repo_root=${repo_root:-/}
if [ ! -d "$repo_root/.tbd" ]; then
  exit 0
fi

# Prefer common user-local bin directories. TBD_HOOK_PATH_PREFIX replaces this list; an
# empty value leaves PATH unchanged.
tbd_hook_path_prefix=${TBD_HOOK_PATH_PREFIX-"$HOME/.local/bin:$HOME/bin:/usr/local/bin"}
if [ -n "$tbd_hook_path_prefix" ]; then
  export PATH="$tbd_hook_path_prefix:$PATH"
fi

# Print yes when the hook input's command runs git push, and no otherwise. The parser
# separates commands and words as a shell does, so it finds `git -C dir push` or a push
# on a later line and ignores `echo git push`. Input that is not valid hook JSON exits 1.
tbd_detect_git_push() {
  if ! command -v node &> /dev/null; then
    echo "[tbd] node is required to read the closing hook input." >&2
    return 1
  fi
  node -e 'const fs = require("node:fs");
const SINGLE_QUOTE = String.fromCharCode(39);
const SEPARATORS = new Set(["\n", ";", "&", "(", ")", "{", "|", "}"]);
const DECORATORS = new Set(["command", "env", "eval", "exec", "nohup", "sudo", "time"]);
const KEYWORDS = new Set(["!", "coproc", "do", "elif", "else", "if", "then", "until", "while"]);
const DECORATOR_VALUE_OPTIONS = new Set([
  "-C", "-D", "-R", "-S", "-T", "-a", "-g", "-h", "-p", "-u", "--argv0", "--chdir",
  "--chroot", "--command-timeout", "--group", "--host", "--prompt", "--split-string",
  "--unset", "--user",
]);
const GIT_VALUE_OPTIONS = new Set([
  "-C", "-c", "--config-env", "--exec-path", "--git-dir", "--namespace",
  "--super-prefix", "--work-tree",
]);
const GIT_TERMINAL_OPTIONS = new Set(["-h", "-v", "--help", "--list-cmds", "--version"]);

function tokenize(command) {
  const tokens = [];
  let word = "";
  let quote = "";
  let escaped = false;
  const flush = () => {
    if (word !== "") tokens.push(word);
    word = "";
  };
  for (const char of command) {
    if (escaped) {
      if (char !== "\n") word += char;
      escaped = false;
    } else if (quote !== "") {
      if (char === quote) quote = "";
      else if (quote === "\"" && char === "\\") escaped = true;
      else word += char;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "\"" || char === SINGLE_QUOTE) {
      quote = char;
    } else if (SEPARATORS.has(char)) {
      flush();
      tokens.push(null);
    } else if (/\s/u.test(char)) {
      flush();
    } else {
      word += char;
    }
  }
  if (escaped) word += "\\";
  flush();
  return tokens;
}

function isTerminalGitOption(token) {
  return GIT_TERMINAL_OPTIONS.has(token) || /^--(help|list-cmds|version)=/u.test(token);
}

function containsGitPush(command) {
  let atCommandStart = true;
  let scanningGit = false;
  let sawDecorator = false;
  let skipDecoratorValue = false;
  let skipGitValue = false;
  for (const token of tokenize(command)) {
    if (token === null) {
      atCommandStart = true;
      scanningGit = false;
      sawDecorator = false;
      skipDecoratorValue = false;
      skipGitValue = false;
    } else if (scanningGit) {
      if (skipGitValue) skipGitValue = false;
      else if (token === "push") return true;
      else if (isTerminalGitOption(token)) scanningGit = false;
      else if (GIT_VALUE_OPTIONS.has(token)) skipGitValue = true;
      else if (!token.startsWith("-")) scanningGit = false;
    } else if (atCommandStart) {
      if (skipDecoratorValue) skipDecoratorValue = false;
      else if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(token) || KEYWORDS.has(token)) continue;
      else if (DECORATORS.has(token)) sawDecorator = true;
      else if (sawDecorator && DECORATOR_VALUE_OPTIONS.has(token)) skipDecoratorValue = true;
      else if (sawDecorator && token.startsWith("-")) continue;
      else if (token === "git" || token.endsWith("/git")) {
        scanningGit = true;
        atCommandStart = false;
      } else atCommandStart = false;
    }
  }
  return false;
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  console.error("[tbd] The closing hook received invalid hook JSON on stdin.");
  process.exit(1);
}
const command = input?.tool_input?.command;
process.stdout.write(typeof command === "string" && containsGitPush(command) ? "yes" : "no");
'
}

if ! is_git_push=$(tbd_detect_git_push); then
  exit 1
fi
if [ "$is_git_push" != "yes" ]; then
  exit 0
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

# Same local-first selection and cool-off fallback as tbd-session.sh. Failures propagate,
# so a reminder that cannot run is visible instead of silently skipped.
if tbd_local_can_read_repository; then
  tbd closing
  exit $?
fi

tbd_run_configured_fallback closing
exit $?
