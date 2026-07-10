---
type: is
id: is-01kx6rm4xrn1hhdqxcqwf54h2d
title: "Harden generated closing-reminder hooks: bash invocation, repo-root cwd, pinned fallback"
kind: bug
status: open
priority: 1
version: 1
labels:
  - hooks
  - setup
dependencies: []
created_at: 2026-07-10T19:38:42.488Z
updated_at: 2026-07-10T19:38:42.488Z
---
Bugbot review of jlevy/skills-research#1 (a repo freshly set up by `tbd setup --auto`, tbd v0.3.0) found two defects in the generated closing-reminder hooks, fixed downstream in commit 8de07e0a3d9a9419f8625937f48877f11576db9e. Both originate verbatim from tbd's templates in `packages/tbd/src/cli/commands/setup.ts`, so every consumer repo gets them. A third hardening was applied by hand earlier in the same PR and also belongs in the template.

**1. Claude PostToolUse hook execs the script directly (exec-bit fragility)**
`CLAUDE_PROJECT_HOOKS` (setup.ts ~line 315) emits `"$CLAUDE_PROJECT_DIR"/.claude/hooks/tbd-closing-reminder.sh` with no `bash` prefix. Setup chmods 0o755 at install time, but the exec bit is lost on filesystems with `core.filemode=false` (Windows, some mounts) and on archive checkouts. Every other hook tbd writes — SessionStart, PreCompact, gh-cli, and all Codex hooks including the Codex closing reminder — already invokes via `bash ...`. Fix: add the `bash ` prefix for consistency. Also fix tbd's own dogfooded `.claude/settings.json` and `packages/tbd/.claude/settings.json`.

**2. `.tbd` check in TBD_CLOSE_PROTOCOL_SCRIPT is cwd-relative**
The script (setup.ts ~line 326, written to both `.claude/hooks/` and `.codex/`) gates on `[ -d ".tbd" ]` in whatever cwd the hook starts in. If the session/hook starts in a subdirectory of the repo (e.g. monorepo package dir), the reminder silently never fires. Downstream fix: `repo_root=$(git rev-parse --show-toplevel 2>/dev/null) && cd "$repo_root"` before the check.

**3. (Related hardening, earlier commit in same PR) `tbd closing` has no PATH/pinned fallback**
`tbd-session.sh` does local-first PATH setup plus a pinned `npx --yes get-tbd@<version>` fallback; the closing script calls bare `tbd closing`, which silently no-ops when tbd isn't on the hook's PATH (bash prints command-not-found, script still exits 0). Port the same PATH export + pinned-npx fallback into TBD_CLOSE_PROTOCOL_SCRIPT using `PINNED_NPM_VERSION`.

**Migration gotcha for the fix:** the hook *script* is rewritten unconditionally on every `tbd setup --auto` (setup.ts ~line 897), so script fixes self-propagate. But the settings.json PostToolUse entry is merged with `mergedHooks[hookType] ??= hookEntries` (~line 809) — it is only added when absent, so existing consumer repos would keep the old un-prefixed command forever. The fix must replace/normalize an existing `tbd-closing-reminder` entry (like the SessionStart merge filters `tbd-session.sh` entries before re-adding), not just skip when present.

Also update `setup-flows.test.ts` expectations and consider the same relative-path cwd assumption in the SessionStart/PreCompact commands (`bash .claude/scripts/tbd-session.sh`), which fail if hook cwd is not the repo root.

Reference: https://github.com/jlevy/skills-research/pull/1 (commit 8de07e0).
