---
name: tbd
description: >-
  Git-native issue tracking, coding guidelines, and workflow shortcuts for AI
  coding agents. Use when managing tasks, committing code, following engineering
  best practices, planning features, setting up a Linear/external tracker integration
  or personal Linear API key, or viewing beads in a live browser.
license: MIT
compatibility: Requires Node.js 22.12.0 or newer and git. Install CLI first: npm install -g get-tbd@latest
metadata:
  author: jlevy
  repository: https://github.com/jlevy/tbd
---
# tbd

**Git-native issue tracking, coding guidelines, and workflow shortcuts.**

tbd helps humans and agents ship code with greater speed, quality, and discipline.

Users speak naturally; run tbd commands for them rather than telling them what to run.
For “Show my beads in a browser,” start `tbd web --open`, wait for its loopback URL,
report that URL, and keep the long-running process alive.
For a project outside the current working directory, use `tbd web <path> --open`; the
path may be the repository or one of its subdirectories.
The browser is a live, read-only viewer, not an editor.
Make requested changes yourself with ordinary `tbd` commands; the page updates from
local state. Never sync merely because the viewer started.

## Prerequisites

Before using tbd commands, ensure the CLI is installed:

```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=<name>  # Fresh repository; ask the user for the prefix
tbd setup --auto                  # Existing tbd repository; reads its config
tbd setup --from-beads            # Uninitialized repo: import and archive .beads/
```

If `tbd` is not available, install it first.
All commands below require the CLI. Setup installs all four agent surfaces by default;
`--surfaces=<comma-list>` narrows only generated agent files, not initialization,
migrations, or docs refresh.
Verify a Beads import because setup can continue after a warning.
Bare `tbd setup` displays help.

## Capabilities

1. **Issue Tracking (Beads)**: Create, track, and close git-native issues.
   Track tasks, bugs, and features across sessions.
2. **Coding Guidelines**: 40+ engineering guidelines (TypeScript, Python, Rust, TDD,
   testing, monorepos) loaded on demand.
3. **Workflow Shortcuts**: Reusable instruction templates for code review, commits, PRs,
   planning, cleanup, and handoffs.
4. **Spec-Driven Planning**: Plan features, break into trackable beads, implement
   systematically.

## Core Commands

```bash
tbd ready              # Find work ready to start
tbd show <id1> [<id2> …]  # Issue details (several in one call)
tbd create "title"     # Create new issue
tbd start <id>         # Claim under the acting-agent identity
tbd close <id>         # Mark complete
tbd sync               # Sync with remote
tbd web --open         # Open the live, read-only bead viewer
tbd status             # Project status
```

Before editing a bead, run `tbd sync --pull`, re-read it, use `tbd start <id>`, and run
`tbd sync` so other replicas can see the claim.
The guard is local and advisory; a stale clone can still race it.
`start` preserves the accountable `assignee` and writes the acting name to `delegate`.
That name resolves from `--as`, then `TBD_AGENT`, then the machine-local session
identity, and finally `<harness>@<host>`; inspect it with `tbd whoami`. Top-level
`sync --pull` updates issue Git only.
Plain `tbd sync` also runs trackers according to `integrations.on_tbd_sync`; use
`tbd integration status` for tracker health.

## Key Shortcuts

| Command | Purpose |
| --- | --- |
| `tbd shortcut code-review-and-commit` | Pre-commit checks and commit |
| `tbd shortcut create-or-update-pr-simple` | Create or update a PR |
| `tbd shortcut new-plan-spec` | Plan a new feature |
| `tbd shortcut setup-linear` | Set up Linear or add a personal Linear key |
| `tbd shortcut review-code` | Comprehensive code review |
| `tbd shortcut implement-beads` | Implement from a spec |
| `tbd shortcut merge-upstream` | Merge main into branch |
| `tbd shortcut agent-handoff` | Hand off to another agent |

Run `tbd shortcut --list` for all available shortcuts.

## Key Guidelines

| Command | Purpose |
| --- | --- |
| `tbd guidelines typescript-rules` | TypeScript best practices |
| `tbd guidelines python-rules` | Python best practices |
| `tbd guidelines general-tdd-guidelines` | Test-driven development |
| `tbd guidelines golden-testing-guidelines` | Snapshot/golden testing |
| `tbd guidelines general-coding-rules` | General coding rules |

Run `tbd guidelines --list` for all available guidelines.

## Session Protocol

Before ending any session:

1. Commit and push code
2. Watch CI: `gh pr checks <PR> --watch 2>&1`
3. Update issues: `tbd close <id>`
4. Sync: `tbd sync`
5. Confirm CI passed

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
