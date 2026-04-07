---
title: tbd Workflow
description: Full tbd workflow guide for agents
---
**`tbd` helps humans and agents ship code with greater speed, quality, and discipline.**

1. **Beads**: Git-native issue tracking (tasks, bugs, features).
   Never lose work across sessions.
   Drop-in replacement for `bd`.
2. **Spec-Driven Workflows**: Plan features → break into beads → implement
   systematically.
3. **Knowledge Injection**: 17+ engineering guidelines (TypeScript, Python, TDD,
   testing, Convex, monorepos) available on demand.
4. **Shortcuts**: Reusable instruction templates for common workflows (code review,
   commits, PRs, cleanup, handoffs).

## Installation

```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=<name>   # Fresh project (--prefix is REQUIRED: 2-8 alphabetic chars recommended. ALWAYS ASK THE USER FOR THE PREFIX; do not guess it)
tbd setup --auto                   # Existing tbd project (prefix already set)
tbd setup --from-beads             # Migration from .beads/ if `bd` has been used
```

## Routine Commands

```bash
tbd --help    # Command reference
tbd status    # Status
tbd doctor    # If there are problems

tbd setup --auto   # Run any time to refresh setup
tbd prime      # Restore full context on tbd after compaction
```

## CRITICAL: You Operate tbd — The User Doesn’t

**You are the tbd operator:** Users talk naturally; you translate their requests to tbd
actions. DO NOT tell users to run tbd commands.
That’s your job.

- **WRONG**: “Run `tbd create` to track this bug”

- **RIGHT**: *(you run `tbd create` yourself and tell the user it’s tracked)*

**Welcoming a user:** When users ask “what is tbd?”
or want help → run `tbd shortcut welcome-user`

## User Request → Agent Action

| User Says | You (the Agent) Run |
| --- | --- |
| **Issues/Beads** |  |
| “There’s a bug where …” | `tbd create "..." --type=bug` |
| “Create a task/feature for …” | `tbd create "..." --type=task` or `--type=feature` |
| “Let’s work on issues/beads” | `tbd ready` |
| “Show me issue X” | `tbd show <id>` |
| “Close this issue” | `tbd close <id>` |
| “Search issues for X” | `tbd search "X"` |
| “Add label X to issue” | `tbd label add <id> <label>` |
| “What issues are stale?” | `tbd stale` |
| **Planning & Specs** |  |
| “Plan a new feature” / “Create a spec” | `tbd shortcut new-plan-spec` |
| “Break spec into beads” | `tbd shortcut plan-implementation-with-beads` |
| “Implement these beads” | `tbd shortcut implement-beads` |
| **Code Review & Commits** |  |
| “Review this code” / “Code review” | `tbd shortcut review-code` |
| “Review this PR” | `tbd shortcut review-github-pr` |
| “Commit this” / “Use the commit shortcut” | `tbd shortcut code-review-and-commit` |
| “Create a PR” / “File a PR” | `tbd shortcut create-or-update-pr-simple` |
| “Merge main into my branch” | `tbd shortcut merge-upstream` |
| **Guidelines & Knowledge** |  |
| “Use TypeScript best practices” | `tbd guidelines typescript-rules` |
| “Use Python best practices” | `tbd guidelines python-rules` |
| “Build a TypeScript CLI” | `tbd guidelines typescript-cli-tool-rules` |
| “Improve monorepo setup” | `tbd guidelines pnpm-monorepo-patterns` or `bun-monorepo-patterns` |
| “Add golden/e2e testing” | `tbd guidelines golden-testing-guidelines` |
| “Use TDD” / “Test-driven development” | `tbd guidelines general-tdd-guidelines` |
| “Convex best practices” | `tbd guidelines convex-rules` |
| **Documentation** |  |
| “Research this topic” | `tbd shortcut new-research-brief` |
| “Document architecture” | `tbd shortcut new-architecture-doc` |
| **Cleanup & Maintenance** |  |
| “Clean up this code” / “Remove dead code” | `tbd shortcut code-cleanup-all` |
| “Fix repository problems” | `tbd doctor --fix` |
| **Sessions & Handoffs** |  |
| “Hand off to another agent” | `tbd shortcut agent-handoff` |
| “Check out this library’s source” | `tbd shortcut checkout-third-party-repo` |
| *(your choice whenever appropriate)* | `tbd list`, `tbd dep add`, `tbd close`, `tbd sync`, etc. |

**Note:** Never gitignore `.tbd/workspaces/` — the outbox must be committed to your
working branch. See `tbd guidelines tbd-sync-troubleshooting` for details.

## CRITICAL: Session Closing Protocol

**Before saying “done”, you MUST complete this checklist:**

```
[ ] 1. git add + git commit
[ ] 2. git push
[ ] 3. gh pr checks <PR> --watch 2>&1 (IMPORTANT: WAIT for final summary, do NOT tell user it is done until you confirm it passes CI!)
[ ] 4. tbd close/update <id> for all beads worked on
[ ] 5. tbd sync
[ ] 6. CONFIRM CI passed (if failed: fix, run tests, re-push, restart from step 3)
```

**Work is not done until pushed, CI passes, and tbd is synced.**

## Bead Tracking Rules

- Track all task work not done immediately as beads (discovered work, TODOs,
  multi-session work)
- When in doubt, create a bead
- Check `tbd ready` when not given specific directions
- Always close/update beads and run `tbd sync` at session end

## Commands

### Finding Work

| Command | Purpose |
| --- | --- |
| `tbd ready` | Beads ready to work (no blockers) |
| `tbd list --status open` | All open beads |
| `tbd list --status in_progress` | Your active work |
| `tbd show <id>` | Bead details with dependencies |

### Creating & Updating

| Command | Purpose |
| --- | --- |
| `tbd create "title" --type task\|bug\|feature --priority=P2` | New bead (P0-P4, not “high/medium/low”) |
| `tbd update <id> --status in_progress` | Claim work |
| `tbd close <id> [--reason "..."]` | Mark complete |

### Dependencies & Sync

| Command | Purpose |
| --- | --- |
| `tbd dep add <bead> <depends-on>` | Add dependency |
| `tbd blocked` | Show blocked beads |
| `tbd sync` | Sync with git remote (run at session end) |
| `tbd stats` | Project statistics |
| `tbd doctor` | Check for problems |
| `tbd doctor --fix` | Auto-fix repository problems |

### Labels & Search

| Command | Purpose |
| --- | --- |
| `tbd search <query>` | Search issues by text |
| `tbd label add <id> <label>` | Add label to issue |
| `tbd label remove <id> <label>` | Remove label from issue |
| `tbd label list` | List all labels in use |
| `tbd stale` | List issues not updated recently |

### Documentation

| Command | Purpose |
| --- | --- |
| `tbd shortcut <name>` | Run a shortcut |
| `tbd shortcut --list` | List shortcuts |
| `tbd guidelines <name>` | Load coding guidelines |
| `tbd guidelines --list` | List guidelines |
| `tbd template <name>` | Output a template |

## Quick Reference

- **Priority**: P0=critical, P1=high, P2=medium (default), P3=low, P4=backlog
- **Types**: task, bug, feature, epic
- **Status**: open, in_progress, closed
- **JSON output**: Add `--json` to any command
