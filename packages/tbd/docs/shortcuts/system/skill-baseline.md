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
3. **Knowledge Injection**: 25+ engineering guidelines (TypeScript, Python, TDD,
   testing, Convex, monorepos) available on demand.
4. **Shortcuts**: Reusable instruction templates for common workflows (code review,
   commits, PRs, cleanup, handoffs).

## Installation

```bash
npm install -g get-tbd@latest      # Install or upgrade the CLI (same command for both)
tbd setup --auto --prefix=<name>   # Fresh project (--prefix is REQUIRED: 2-8 alphabetic chars recommended. ALWAYS ASK THE USER FOR THE PREFIX; do not guess it)
tbd setup --auto                   # Existing tbd project — also the upgrade step (applies any format migration; commit the diff it reports)
tbd setup --from-beads             # Migration from .beads/ if `bd` has been used
```

If tbd refuses with “This repository requires a newer version of tbd”, run the two
install/upgrade commands above.

## Routine Commands

```bash
tbd --help    # Command reference
tbd status    # Status
tbd doctor    # If there are problems

tbd setup --auto   # Run any time to refresh setup
tbd prime      # Restore full context on tbd after compaction
tbd web --open # Open the live, read-only bead viewer
```

## CRITICAL: You Operate tbd, the User Doesn’t

**You are the tbd operator:** Users talk naturally; you translate their requests to tbd
actions. DO NOT tell users to run tbd commands.
That’s your job.

- **WRONG**: “Run `tbd create` to track this bug”

- **RIGHT**: *(you run `tbd create` yourself and tell the user it’s tracked)*

**Live browser requests:** When the user asks to see, show, open, or view beads in a
browser, start `tbd web --open` yourself with the agent platform’s long-running process
facility. Do not merely print the command.
If the requested project is outside your current working directory, start
`tbd web <path> --open`; the path may be its repository root or any subdirectory.
Wait for the startup descriptor, give the user its loopback URL, and leave the process
running until they ask you to stop it or the session environment requires cleanup.

The page is a live, read-only viewer, not an editor.
You remain the tbd operator: make every requested bead change with ordinary `tbd`
commands, and the running page observes the resulting local state automatically.
Browser filters change only the presentation.
Starting the viewer never justifies an implicit fetch, merge, or push; run `tbd sync`
only when the user asks to exchange remote bead state, after which its local result also
appears automatically.

**Welcoming a user:** When users ask “what is tbd?”
or want help → run `tbd shortcut welcome-user`

## User Request → Agent Action

| User Says | You (the Agent) Run |
| --- | --- |
| **Issues/Beads** |  |
| “There’s a bug where …” | `tbd create "..." --type=bug` |
| “Create a task/feature for …” | `tbd create "..." --type=task` or `--type=feature` |
| “Let’s work on issues/beads” | `tbd ready` |
| “Show my beads in a browser” | Start `tbd web --open` yourself, wait for its URL, and keep it running |
| “Show me issue X” (or several) | `tbd show <id1> [<id2> …]` (one call, never a loop; `--max-lines <n>` caps output per issue) |
| “Where do things stand on spec X?” | `tbd list --spec <path-or-filename>` (all specs at once: `tbd list --specs`) |
| “Close this issue” | `tbd close <id>` (several: `tbd close <id1> <id2> …` — one call, never a loop) |
| “Search issues for X” | `tbd search "X"` (matches content and issue IDs, so partial IDs work) |
| “Add label X to issue” | `tbd label add <id> <label>` (several beads: `tbd update <id1> <id2> … --add-label <label>`) |
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
| *(any engineering work)* | Load the **General engineering** group first (see below) |
| “Use TypeScript best practices” | `tbd guidelines typescript-rules typescript-lint-format-rules` |
| “Use Python best practices” | `tbd guidelines python-rules` |
| “Set up TS/JS lint, format, or hooks” | `tbd guidelines typescript-lint-format-rules` |
| “Build a TypeScript CLI” | `tbd guidelines typescript-cli-tool-rules` |
| “Improve monorepo setup” | `tbd guidelines pnpm-monorepo-patterns` or `bun-monorepo-patterns` |
| “Add golden/e2e testing” | `tbd guidelines golden-testing-guidelines` |
| “Use TDD” / “Test-driven development” | `tbd guidelines general-tdd-guidelines` |
| “Convex best practices” | `tbd guidelines convex-rules` |
| **Documentation** |  |
| “Research this topic” | `tbd shortcut new-research-brief` |
| “Document architecture” | `tbd shortcut new-architecture-doc` |
| “What guidelines/docs are there?” | `tbd docs list` |
| “Make the guidelines visible / customize doc X” | `tbd docs fork --category=general --category=<lang>` (recommended: general + the repo’s languages), or `tbd docs fork <name>` / `--all`; then edit in `docs/tbd/` |
| “Update the guidelines to the latest” | `tbd docs update`; on conflicts ask the user, then `--merge` or `--keep-ours` |
| “I deleted a forked doc file” | `tbd docs status` shows it `missing`; restore with `tbd docs fork <name> --force` or finalize with `tbd docs unfork <name>` |
| **Cleanup & Maintenance** |  |
| “Clean up this code” / “Remove dead code” | `tbd shortcut code-cleanup-all` |
| “Fix repository problems” | `tbd doctor --fix` |
| **Sessions & Handoffs** |  |
| “Hand off to another agent” | `tbd shortcut agent-handoff` |
| “Check out this library’s source” | `tbd shortcut checkout-third-party-repo` |
| *(your choice whenever appropriate)* | `tbd list`, `tbd dep add`, `tbd close`, `tbd sync`, etc. |

**Loading guidelines for engineering work:** Before writing or reviewing code, load the
**General engineering** group—the `general-*` rules plus `error-handling-rules`—since
these apply to all code regardless of language.
Then load the group for the language or framework in use (TypeScript, Python, Convex,
etc.). Load a whole group in **one call**; `guidelines`, `shortcut`, `template`, and
`docs show` all take several names:

```bash
tbd guidelines general-coding-rules general-comment-rules error-handling-rules general-testing-rules
```

Run `tbd guidelines --list` to see all available guidelines.

**Note:** Never gitignore `.tbd/workspaces/`; the outbox must be committed to your
working branch. See `tbd guidelines tbd-sync-troubleshooting` for details.

## CRITICAL: Session Closing Protocol

**Before saying “done”, you MUST complete this checklist:**

```
[ ] 1. git add + git commit
[ ] 2. git push
[ ] 3. gh pr checks <PR> --watch 2>&1 (IMPORTANT: WAIT for final summary, do NOT tell user it is done until you confirm it passes CI!)
[ ] 4. tbd close <id1> <id2> ... --reason "..." — one bulk call per group of beads sharing a reason (never a per-ID loop)
[ ] 5. tbd sync
[ ] 6. CONFIRM CI passed (if failed: fix, run tests, re-push, restart from step 3)
```

**Work is not done until pushed, CI passes, and tbd is synced.**

**Remote/proxied session where GitHub seems blocked?** If the environment has egress,
`gh` works through a scoped `NO_PROXY` bypass — run `tbd shortcut setup-github-cli` and
follow “Proxied Remote Sessions” before concluding gh is unavailable.

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
| `tbd list --spec <path>` | Beads tracking a spec (filename or suffix is enough) |
| `tbd list --sort updated --limit 10` | Recent activity; `--count` for totals |
| `tbd show <id1> [<id2> …]` | Bead details with dependencies (bulk: delimited per issue; `--max-lines <n>` caps each) |

### Creating & Updating

| Command | Purpose |
| --- | --- |
| `tbd create "title" --type=bug --priority=1` | New bead; run `tbd create --help` for all types and priorities (P0-P4, not “high/medium/low”) |
| `tbd create "title" --parent <epic> --depends-on <id>` | Create fully wired: parent and blockers in one call (`--depends-on` is repeatable) |
| `tbd update <id> --status in_progress` | Claim work |
| `tbd close <id> [--reason "..."]` | Mark complete |
| `tbd close <id1> <id2> <id3> --reason "..."` | Close several at once (always preferred over one-at-a-time) |
| `tbd update <id1> <id2> <id3> --priority 1` | Bulk-update shared fields on several beads |

**IMPORTANT: if you are about to shell-loop or pipe around tbd, stop; the bulk or filter
form exists.** `show`, `close`, `reopen`, and `update` take multiple IDs;
`guidelines`/`shortcut`/`template`/`docs show` take multiple names; `dep add` takes
multiple blockers; list/search/show have `--limit`/`--count`/`--max-lines`. NEVER
`for id in …; do tbd close $id; done` (one call gives one lock, one summary, `--json`,
and `--ignore-missing`), NEVER `tbd show X | head` (use `--max-lines`), NEVER
`tbd list | grep <id>` (use `tbd search <partial-id>`). A bulk call shares one reason
(and, for `update`, one set of field changes), so group the beads that share the same
mutation and make one call per group.

### Dependencies & Sync

| Command | Purpose |
| --- | --- |
| `tbd dep add <bead> <blocker1> [<blocker2> …]` | Add blocker dependencies (one call per bead) |
| `tbd blocked` | Show blocked beads |
| `tbd sync` | Sync with git remote (run at session end) |
| `tbd stats` | Project statistics |
| `tbd doctor` | Check for problems |
| `tbd doctor --fix` | Auto-fix repository problems |

### Labels & Search

| Command | Purpose |
| --- | --- |
| `tbd search <query>` | Search issues by text or (partial) issue ID |
| `tbd label add <id> <label>` | Add label to issue (several beads: `tbd update <ids…> --add-label`) |
| `tbd label remove <id> <label>` | Remove label from issue |
| `tbd label list` | List all labels in use |
| `tbd stale` | List issues not updated recently |

### Documentation

| Command | Purpose |
| --- | --- |
| `tbd shortcut <name>` | Run a shortcut |
| `tbd shortcut --list` | List shortcuts |
| `tbd guidelines <name> [<name> …]` | Load coding guidelines (a whole group in one call) |
| `tbd guidelines --list` | List guidelines |
| `tbd template <name>` | Output a template |
| `tbd docs` / `tbd docs list` | Managed-docs overview / cross-kind list with state markers |
| `tbd docs fork/unfork/update <name>` | Fork docs into `docs/tbd/`, return to upstream, pull upstream updates |

## Quick Reference

- **Priority**: P0=critical, P1=high, P2=medium (default), P3=low, P4=backlog
- **Types**: issues default to `task`; run `tbd create --help` for the valid types
- **Status**: open, in_progress, closed
- **JSON output**: Add `--json` to any command
