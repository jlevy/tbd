---
name: tbd
description: Lightweight, git-native issue tracking (aka beads) for AI agents. Use for creating, planning, updating, and tracking issues with dependencies. Invoke when user mentions tbd, beads, to-do lists, planning, tracking tasks, issues, or bugs.
allowed-tools: Bash(tbd:*), Read, Write
---
# tbd Workflow

`tbd` provides lightweight, git-native task and issue tracking using beads, which are
just lightweight issues managed from the CLI.

> **Context Recovery**: Run `tbd prime` after compaction, clear, or new session.
> Installed Claude hooks call this at session start and before compaction when `.tbd/`
> is detected.
> 
> **Setup/Refresh**: A fresh repository needs `tbd setup --auto --prefix=<name>`; ask
> the user for the prefix.
> Run `tbd setup --auto` to refresh an existing tbd repository.

# SESSION CLOSING PROTOCOL

**CRITICAL**: Before saying “done” or “complete”, you MUST run this checklist:

```
[ ] 1. Stage and commit: git add + git commit
[ ] 2. Push to remote: git push
[ ] 3. Start CI watch (BLOCKS until done): gh pr checks <PR> --watch 2>&1
[ ] 4. While CI runs: tbd close/update <id> for issues worked on
[ ] 5. While CI runs: tbd sync
[ ] 6. Return to step 3 and CONFIRM CI passed
[ ] 7. If CI failed: fix, re-push, restart from step 3
```

## NON-NEGOTIABLE Requirements

### CI: Wait for `--watch` to finish

The `--watch` flag blocks until ALL checks complete.
Do NOT see “passing” in early output and move on—wait for the **final summary** showing
all checks passed.

### tbd: Update issues and sync

Every session must end with tbd in a clean state:
- Close/update **every issue** you worked on
- Run `tbd sync` and confirm it completed

**Work is not done until pushed, CI passes, and tbd is synced.**

## Core Rules

- Track *all task work* not being done immediately as beads using `tbd` (discovered
  work, future work, TODOs for the session, multi-session work)
- When in doubt, prefer tbd for tracking tasks, bugs, and issues
- Remote/proxied session where GitHub seems blocked?
  If the environment has egress, `gh` works through a scoped `NO_PROXY` bypass — run
  `tbd shortcut setup-github-cli` and follow “Proxied Remote Sessions” before concluding
  gh is unavailable
- Use `tbd create` for creating beads
- Git workflow: update or close issues and run `tbd sync` at session end
- If not given specific directions, check `tbd ready` for available work

## Essential Commands

### Finding Work

- `tbd ready` - Show issues ready to work (open; no delegate, hold, future deferral, or
  non-closed blocker)
- `tbd list --status open` - All open issues
- `tbd list --status in_progress` - All in-progress work
- `tbd show <id>` - Detailed issue view with dependencies

### Creating & Updating

- `tbd create "title" --type=bug --priority=1` - New issue (run `tbd create --help` for
  all types and priorities)
  - Priority: P0-P4 (P0=critical, P2=medium, P4=backlog).
    Do NOT use "high"/"medium"/"low"
- `tbd start <id>` - Claim work
- `tbd update <id> --assignee username` - Assign to someone
- `tbd close <id>` - Mark complete
- `tbd close <id> --reason "explanation"` - Close with reason
- **Tip**: When creating multiple issues, use parallel subagents for efficiency

Use `tbd start`, not a raw status update, to claim work.
It records the acting agent in `delegate`. On an already in-progress bead, it reports a
different visible delegate instead of overwriting that claim.
It does not require readiness or coordinate with a stale clone.
Before editing, run `tbd sync --pull`, re-read the bead, use `tbd start <id>`, and run
`tbd sync` so other replicas can see the accepted claim.
`assignee` remains the person accountable for the work.
The acting name resolves from `start --as`, then `TBD_AGENT`, then the machine-local
session identity, and finally a derived `<harness>@<host>` fallback.
Use `tbd whoami` to inspect it; setup hooks initialize the local identity with
`tbd whoami --ensure-id`.

### Dependencies & Blocking

- `tbd dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `tbd blocked` - Show all blocked issues
- `tbd show <id>` - See what’s blocking/blocked by this issue

### Sync & Collaboration

- `tbd sync` - Sync with git remote (run at session end)
- `tbd sync --status` - Check docs and issue Git status without syncing

Note: `tbd sync` handles all git operations for issues--no manual git push needed.
Plain sync also handles trackers according to `integrations.on_tbd_sync`. Top-level
`--push`/`--pull` selects the issue Git surface and excludes trackers unless
`--integrations` is explicit.
`tbd sync --status` checks docs and issue Git only; use `tbd integration status` for
tracker health.

### Project Health

- `tbd stats` - Project statistics (open/closed/blocked counts)
- `tbd doctor` - Check for issues (sync problems, missing hooks)

## Common Workflows

**Starting work:**

```bash
tbd sync --pull                        # Refresh shared state
tbd ready                              # Find available work
tbd show <id>                          # Review current issue details
tbd start <id>                         # Claim it
tbd sync                               # Publish the claim
```

**Completing work:**

```bash
tbd close <id>    # Mark complete
tbd sync          # Push to remote
```

**Creating dependent work:**

```bash
tbd create "Implement feature X" --type feature
tbd create "Write tests for X" --type task
tbd dep add <tests-id> <feature-id>   # Tests depend on feature
```

## Setup Commands

- `tbd setup --auto --prefix=<name>` - Initialize a fresh repository
- `tbd setup --auto` - Refresh an existing tbd repository
- `tbd setup --from-beads` - In an uninitialized repository, import and archive
  `.beads/`; verify the import because setup can continue after a warning
- `tbd setup --auto --surfaces=<list>` - Generate a comma-separated subset of
  `portable`, `agents-md`, `claude`, and `codex`; omission installs all four

The surface selector controls only generated agent files, not initialization,
migrations, or docs refresh.
Bare `tbd setup` displays help.
Beads migration renames only `.beads/` to `.beads-disabled/`; it does not remove other
Beads integrations.

## Quick Reference

- **Priority levels**: 0=critical, 1=high, 2=medium (default), 3=low, 4=backlog
- **Issue types**: default `task`; run `tbd create --help` for the valid types
- **Status values**: open, in_progress, blocked, deferred, closed
- **JSON output**: Data-oriented commands honor `--json`; raw document commands such as
  `readme`, `prime`, `skill`, and `closing` remain text
