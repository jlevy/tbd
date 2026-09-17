# tbd

[![Follow @ojoshe on X](https://img.shields.io/badge/follow_%40ojoshe-black?logo=x&logoColor=white)](https://x.com/ojoshe)
[![CI](https://github.com/jlevy/tbd/actions/workflows/ci.yml/badge.svg)](https://github.com/jlevy/tbd/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/get-tbd)](https://www.npmjs.com/package/get-tbd)

**Task tracking, spec-driven planning, and knowledge injection for AI coding agents.**

`tbd` (short for “To Be Done,” or “TypeScript beads” if you prefer) is a git-native
issue tracker for coding agents, with spec-driven planning workflows, engineering
guidelines the agent loads on demand, reusable workflow shortcuts, a live web view of
the board, and Linear sync.
Beads (issues) are Markdown files on a dedicated sync branch, so agents and humans share
one durable task layer across sessions and machines, with no daemon and no database.
It installs as a skill for Claude Code and Codex, works through the CLI in any other
agent environment, and is a drop-in replacement for the original
[Beads](https://github.com/steveyegge/beads) (`bd`).

## What You Get

1. **Beads**: Git-native issue tracking (tasks, bugs, features).
   Never lose work across sessions.
   Drop-in replacement for `bd`.
2. **Spec-Driven Workflows**: Plan features → break into beads → implement
   systematically.
3. **Knowledge Injection**: 40+ engineering guidelines (TypeScript, Python, Rust, TDD,
   testing, Convex, monorepos) available on demand.
4. **Shortcuts**: Reusable instruction templates for common workflows (code review,
   commits, PRs, cleanup, handoffs).

On top of that, `tbd web` shows beads live in a browser, `tbd watch` wakes agents when
bead state changes, `tbd integration` syncs beads with Linear, and policy grants record
which actions agents may take in the project (see
[Features at a Glance](#features-at-a-glance)).

## Quick Start

Install the CLI:

```bash
npm install -g get-tbd@latest
```

Then tell your agent:

***“Run tbd prime, then set up tbd in this project.”***

The agent asks you for a short issue-ID prefix, runs `tbd setup --auto --prefix=<name>`,
and follows
[`tbd shortcut setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md), which
asks you once, for the project as a whole, which policy grants agents have here (GitHub
editing and merging, stacked PRs, sub-agents, PR review requirements, and Linear sync)
and records the answers in `AGENTS.md`. Say **“Set up tbd”** again after any upgrade: it
asks only about policies that are still unanswered.
From then on you talk to your agent in natural language; “what can I do with tbd?”
runs the welcome shortcut.
For cloud instances and upgrades, see [Installation and Setup](#installation-and-setup).

## Talking to Your Agent

The agent translates your requests into `tbd` commands: some do things, like creating
beads, and others give the agent context, knowledge, or a workflow to follow.
These are the requests the installed skill routes; say them in your own words.

| What you say | What happens | What runs |
| --- | --- | --- |
| “There’s a bug where …” | Agent creates and tracks a bead | `tbd create "..." --type=bug` |
| “Let’s work on issues/beads” | Agent finds ready beads and starts working | `tbd ready` |
| “Show my beads in a browser” | Agent starts the live, read-only viewer, gives you its URL, and keeps it running | `tbd web --open` |
| “Plan a new feature” / “Create a spec” | Agent creates a spec from a template | [`tbd shortcut new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) |
| “Break spec into beads” | Agent creates implementation beads from the spec | [`tbd shortcut plan-implementation-with-beads`](packages/tbd/docs/shortcuts/standard/plan-implementation-with-beads.md) |
| “Implement these beads” | Agent works through the beads systematically | [`tbd shortcut implement-beads`](packages/tbd/docs/shortcuts/standard/implement-beads.md) |
| “Review this code” / “Code review” | Agent reviews uncommitted, branch, or PR changes with all guidelines | [`tbd shortcut review-code`](packages/tbd/docs/shortcuts/standard/review-code.md) |
| “Review PR #N” | Agent publishes one senior engineering review at a pinned head | [`tbd shortcut review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) |
| “Address the reviews on PR #N” | Agent gives every finding a disposition (fixed, rebutted, declined, or deferred), pushes confirmed fixes, and replies | [`tbd shortcut address-pr-review`](packages/tbd/docs/shortcuts/standard/address-pr-review.md) |
| “Review and fix PR #N” | One review round and its addressing; the agent asks before another round | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (fix mode) |
| “Get PR #N merge-ready” | As above, and the merge gate passes at the current head; no merge | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (merge-ready mode) |
| “Make sure PR #N is reviewed and merged” | As above, and the agent merges the PR | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (merge mode) |
| “Commit this” / “Use the commit shortcut” | Agent runs pre-commit checks, reviews, and commits | [`tbd shortcut code-review-and-commit`](packages/tbd/docs/shortcuts/standard/code-review-and-commit.md) |
| “Create a PR” / “File a PR” | Agent creates or updates the pull request | [`tbd shortcut create-or-update-pr-simple`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md) |
| “Create a stacked PR” / “Stack this” | Agent splits the work into a formal stack of dependent PRs | [`tbd shortcut stacked-prs`](packages/tbd/docs/shortcuts/standard/stacked-prs.md) |
| “Merge main into my branch” | Agent merges `origin/main`, resolves conflicts, and watches CI | [`tbd shortcut merge-upstream`](packages/tbd/docs/shortcuts/standard/merge-upstream.md) |
| “Use TypeScript best practices” | Agent loads the TypeScript rules | [`tbd guidelines typescript-rules`](packages/tbd/docs/guidelines/typescript-rules.md) |
| “Use TDD” / “Test-driven development” | Agent loads the TDD guidelines | [`tbd guidelines general-tdd-guidelines`](packages/tbd/docs/guidelines/general-tdd-guidelines.md) |
| “Add golden/e2e testing” | Agent loads the golden testing guidelines | [`tbd guidelines golden-testing-guidelines`](packages/tbd/docs/guidelines/golden-testing-guidelines.md) |
| “Research this topic” | Agent creates a research brief from a template | [`tbd shortcut new-research-brief`](packages/tbd/docs/shortcuts/standard/new-research-brief.md) |
| “Document architecture” | Agent creates an architecture doc | [`tbd shortcut new-architecture-doc`](packages/tbd/docs/shortcuts/standard/new-architecture-doc.md) |
| “Make the guidelines visible / customize doc X” | Agent forks the docs into `docs/tbd/` | `tbd docs fork --category=general --category=<lang>` (or `--all`) |
| “Clean up this code” / “Remove dead code” | Agent removes duplicates and dead code | [`tbd shortcut code-cleanup-all`](packages/tbd/docs/shortcuts/standard/code-cleanup-all.md) |
| “Set up tbd” / *(after upgrading tbd)* | Agent reviews setup and asks about unanswered policy grants | [`tbd shortcut setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) |
| “Set up Linear” / “Add my Linear key” | Agent configures the repository or adds your personal key, whichever applies | [`tbd shortcut setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md) |
| “You can use sub-agents” / *(delegating any work)* | Agent checks the grant, splits the work, and briefs sub-agents by tier | [`tbd shortcut delegate-to-subagents`](packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md) |

Every default in a shortcut yields to your specific guidance: “post the review as a PR
comment”, “also do a security review”, “two rounds”, or “don’t merge anything today”.

## Features at a Glance

- **Git-native beads:** one Markdown file with YAML frontmatter per bead, on a dedicated
  `tbd-sync` branch, so parallel creation never conflicts and your code history stays
  clean; JSON output, bulk commands, and self-documenting help keep it agent-operated.
- **Spec-driven workflows:** shortcuts for the full cycle: plan spec, beads,
  implementation, validation plan, and PR.
- **PR review lifecycle:** reviews published at a pinned head under one review-state
  contract, addressed finding by finding, with a merge gate before any merge (see
  [`pr-review-workflows`](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md)).
- **Policy grants and delegation:** standing, project-wide consent for classes of agent
  actions, recorded in `AGENTS.md` and managed with `tbd policy`, plus one delegation
  procedure for any platform with provider-neutral model tiers (see
  [Agent Policies and Delegation](#agent-policies-and-delegation)).
- **Live web view and watching:** `tbd web --open` serves a loopback-only, read-only
  board that updates as beads change, and `tbd watch` blocks until selected bead state
  changes on the remote, with no daemon (see [Commands](#commands)).
- **Linear sync:** `tbd integration` mirrors or synchronizes selected beads with Linear,
  and plain `tbd sync` covers it (see [Optional Linear Setup](#optional-linear-setup)).
- **Guidelines, shortcuts, and templates:** bundled docs the agent loads by name,
  forkable into `docs/tbd/` and extensible from any URL (see
  [Shortcuts, Guidelines, and Templates](#shortcuts-guidelines-and-templates)).
- **Beads compatible:** largely compatible with `bd` at the CLI level, with
  `tbd setup --from-beads` to migrate (see [Why tbd](#why-tbd)).

## Installation and Setup

**Requirements:**

- Node.js 22.12.0 or newer
- Git 2.42 or newer (orphan worktree support)
- GitHub CLI (`gh`) 2.97.0 or newer, optional: the generated session hook installs it
  when missing or too old; pass `--no-gh-cli` to setup, or set `use_gh_cli: false` under
  `settings:` in `.tbd/config.yml`, to leave `gh` alone.

```bash
npm install -g get-tbd@latest   # Install or upgrade (same command for both)
```

On a fresh cloud instance (such as Claude Code Cloud) where the CLI is not installed,
tell the agent: ***“install tbd (npm install -g get-tbd@latest), run tbd prime, and set
up tbd in this project.”***

### Setup and Upgrading

```bash
tbd setup --auto --prefix=myapp   # Fresh project (--prefix is REQUIRED: a short alphabetic name used in issue IDs, e.g. myapp → myapp-a1b2)
tbd setup --auto                  # Existing tbd project; also the upgrade step after npm install -g
tbd setup --from-beads            # Migrate from Beads (see Migrating from Beads)
```

`tbd setup --auto` is idempotent and safe to run at any time: it initializes `.tbd/`,
refreshes the cached docs and every agent surface, applies any repository format
migration, and writes the policy block in `AGENTS.md` back unchanged.
Commit the diff it reports.
Bare `tbd setup` displays help.
The [`setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) shortcut wraps
these commands: it installs or upgrades the CLI, runs setup, asks about unanswered
policy grants and records the answers, sets up `gh` authentication, stack tooling, and
Linear as the grants require, and verifies with `tbd doctor`. The output of a fresh
setup points to it; run it (say “Set up tbd”) for a new project and after every upgrade.

Upgrading is the same two commands, `npm install -g get-tbd@latest` and
`tbd setup --auto`. If the new version bumps the repository format (`tbd_format` in
`.tbd/config.yml`), setup migrates it and prints a notice; commit the diff, and
teammates on an older tbd see “This repository requires a newer version of tbd” until
they upgrade too. Issue data is never touched, and the migration is revertible (see
“Aborting a Format Upgrade” in the CLI manual, `tbd docs manual`).

### Team Setup

**First contributor:**

```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=proj   # Short alphabetic prefix for issue IDs
git add .tbd/ .agents/ .claude/ .codex/ AGENTS.md
git commit -m "Initialize tbd"
git push
```

**Joining contributors:**

```bash
git clone <repo>
npm install -g get-tbd@latest
tbd setup --auto                 # No --prefix needed: reads the committed config
```

Policy grants are committed with `AGENTS.md`, so joiners inherit them.

### Agent Surfaces

Setup installs six project-local surfaces by default.
`--surfaces=<comma-list>` (or `all`) narrows the generated files; it does not skip
initialization, migration, or the docs refresh.

| Surface | Files | What it gives the agent |
| --- | --- | --- |
| `portable` | `.agents/skills/tbd/SKILL.md` | The tbd skill, for any agent that reads portable skills |
| `agents-md` | A managed block in `AGENTS.md` | Orientation for any agent that reads `AGENTS.md`, plus the policy block |
| `claude` | `.claude/skills/tbd/SKILL.md`, hooks in `.claude/settings.json`, and scripts | The Claude Code skill mirror and hooks |
| `claude-agents` | `.claude/agents/tbd-*.md` | Tier agent definitions for sub-agents |
| `codex` | `.codex/hooks.json` and scripts | The Codex hooks |
| `codex-agents` | `.codex/agents/tbd-*.toml` | Tier agent definitions for sub-agents |

Claude Code and Codex get the same hooks: at session start, `tbd whoami --ensure-id`
sets a stable, machine-local agent identity, `tbd prime` injects workflow context and
the effective policy grants, and `ensure-gh-cli.sh` installs `gh` unless disabled; a
brief `tbd prime` runs before context compaction and the closing reminder after tool
use. Codex also reads `AGENTS.md`; other agents (Cursor, for example) use the portable
skill, `AGENTS.md`, or just the CLI, since `tbd prime` gives any agent the full
workflow.

The four tier agent definitions (`tbd-strong-max`, `tbd-strong`, `tbd-moderate`, and
`tbd-fast`) each set a model and a reasoning level from the dated suggestions in
[`agent-model-tiers`](packages/tbd/docs/guidelines/agent-model-tiers.md); setup
refreshes them on every run, so upgrading tbd updates them, and removing a file’s
`DO NOT EDIT` marker takes it over.
To leave them out, list the other surfaces:
`--surfaces=portable,agents-md,claude,codex`.

`tbd status` lists the installed skill, hooks, and `AGENTS.md` block, though not the
tier agent definitions, which `tbd doctor` reports once they exist.
`tbd uninstall --confirm` removes `.tbd/`, the hidden worktree, the local sync branch
(unless `--keep-branch`), and the generated tier agent definitions; the skills, hooks,
and the `AGENTS.md` block stay in place.

### GitHub Authentication and Stack Tooling

The PR shortcuts use `gh`. Authenticate with `gh auth login`, or set `GH_TOKEN` (a
[Personal Access Token](https://github.com/settings/tokens?type=beta), fine-grained
recommended, with **Contents** and **Pull requests** read/write permissions) and
`GH_PROMPT_DISABLED=1` before starting the session: in the project’s environment
variables on Claude Code Cloud, or in your shell profile locally.
The session hook enforces the `gh` 2.97.0 floor.
Stack tooling (the pinned `gh-stack` extension and its agent skill) is installed only
when the `github-stacked-prs` policy is granted, through `ensure-gh-cli.sh --with-stack`
as the
[setup-github-cli shortcut](packages/tbd/docs/shortcuts/standard/setup-github-cli.md)
describes; without the grant, agents propose separate PRs instead.
Authentication is separate from authorization: a working `gh` login is not a grant, and
a grant never bypasses a tool permission.

### Optional Linear Setup

tbd works without an external tracker.
To add Linear, say **“Set up Linear.”** The agent runs
[`tbd shortcut setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md),
which tells first-time repository configuration apart from a teammate joining a
repository whose configuration is already committed: `.tbd/config.yml` holds the shared
Linear team, project, and policy, while each contributor supplies a personal
`LINEAR_API_KEY` through the environment or a gitignored `.env`, never in chat or in a
commit. When the `linear` policy is granted, the default selection is `epics`: open epic
beads, synchronized in both directions.
`tbd integration status` verifies the connection, plain `tbd sync` then covers Linear,
and
[External Tracker Integrations](packages/tbd/docs/tbd-docs.md#external-tracker-integrations)
in the CLI reference has the policies, selectors, and bulk-change safety.

### Migrating from Beads

```bash
tbd --dry-run setup --from-beads  # Preview; writes nothing
tbd setup --from-beads            # Initialize, import, install surfaces, archive .beads/
tbd stats                         # Verify
tbd list --all
```

Run this before initializing tbd, while `.beads/` still exists.
Setup imports `.beads/issues.jsonl` when present and renames the directory to
`.beads-disabled/`, the rollback source; it can continue after a missing JSONL file or
import warning, so verify the totals.
It does not remove `.beads-hooks/`, Cursor rules, Claude settings, or Beads text in
`AGENTS.md`. Issue IDs are preserved: `proj-123` in Beads is `proj-123` in tbd.

## Agent Policies and Delegation

A **policy grant** records your explicit consent for a class of agent actions, for the
project as a whole, so agents neither ask in every session nor act without consent.
Grants live in a policy block inside the tbd block in `AGENTS.md`, are committed like
any other change, and take effect from the default branch.
The seven policies:

| Policy | Recommended | Covers |
| --- | --- | --- |
| `github-workflows` | `granted` | Issues, labels, and re-running or cancelling CI runs |
| `github-editing` | `granted` | Branches and PRs short of merging: pushing, creating and editing PRs, posting reviews and replies, watching CI |
| `github-merge` | `per-request` | Merging PRs once the review requirements are met; `per-request` covers only a PR you named in the current request, and `unconditional` needs no per-case authorization (recommended against) |
| `github-stacked-prs` | `granted` | Installing the `gh stack` tooling and creating, submitting, syncing, and merging formal stacks |
| `subagents` | `granted` | Delegating to sub-agents following `delegate-to-subagents` |
| `pr-review-requirements` | `standard` | The reviews a PR needs before it merges: one senior engineering review and one addressing pass, plus a dedicated security, performance, or correctness review where the PR is sensitive; `standard + security` or `standard + 2 rounds` adds kinds or rounds |
| `linear` | Asked separately | Syncing beads with Linear; `epics` syncs open epic beads in both directions |

The block, with its fixed prose omitted:

```markdown
<!-- BEGIN TBD POLICY GRANTS v=1 -->

- `github-workflows`: granted
- `github-editing`: granted
- `github-merge`: per-request
- `github-stacked-prs`: granted
- `subagents`: granted
- `pr-review-requirements`: standard
- `linear`: not-granted

Recorded 2026-09-17.
<!-- END TBD POLICY GRANTS -->
```

```bash
tbd policy show                            # Answered and unanswered policies, with effective values
tbd policy grant subagents                 # Record the recommended value
tbd policy revoke github-merge             # Record the not-granted value
tbd policy set pr-review-requirements standard + 2 rounds   # Record any valid value
tbd setup --auto --policies=recommended    # Record the recommended set for every unanswered policy (Linear is asked separately)
```

An unanswered policy is treated as `not-granted` (`standard` for review requirements),
and the agent asks when a task needs it.
Your instructions in the conversation override recorded grants for that task, in either
direction, and a grant never bypasses a tool permission or sandbox.
`tbd prime` prints the effective grants, `tbd doctor` validates the block, and
[`agent-policy-grants`](packages/tbd/docs/guidelines/agent-policy-grants.md) is the full
definition.

**Delegation.** With `subagents` granted, agents follow
[`delegate-to-subagents`](packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md):
your session is the coordinator; it splits the work by role (reviewer, addressing agent,
administrator), assigns each task a tier from
[`agent-model-tiers`](packages/tbd/docs/guidelines/agent-model-tiers.md) (strong,
moderate, or fast, defined by model rank and reasoning level within your own provider),
spawns fresh, named sub-agents through the generated `tbd-*` definitions, writes
self-contained briefs, and verifies every claim that comes back.
[`review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md)
runs the reviews, the addressing pass, the round decision, and the merge gate this way;
without sub-agents, one session performs the same steps in order.
The vendor guidance behind the procedure is in the
[sub-agent research brief](docs/project/research/current/research-2026-09-16-subagent-guidance-anthropic-openai.md).

## Commands

### Beads

```bash
tbd ready                      # Open work with no delegate, hold, deferral, or blocker
tbd list                       # List open beads (--all includes closed; --specs groups by spec)
tbd show proj-a7k2             # View bead details (several IDs in one call)
tbd create "Title" --type=bug  # Create bead (bug/feature/task/epic/chore)
tbd start proj-a7k2            # Claim under the resolved agent identity
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd close proj-a7k2 proj-b3m9 --reason="Sprint done"  # Bulk close (one call, no loops)
tbd dep add proj-b3m9 proj-a7k2  # b3m9 depends on a7k2
tbd label add proj-a7k2 urgent backend
tbd search "authentication"    # Search beads by text or partial ID
tbd sync                       # Sync with remote (auto-commits and pushes)
tbd web --open                 # Open the live, read-only browser viewer
tbd watch --ready --json       # Block until a bead newly becomes ready
tbd changes --since <commit>   # What changed since a sync-branch commit
```

`tbd start` writes the acting agent to `delegate` and preserves the accountable
`assignee`; `tbd whoami` shows the identity it records.
Pull and re-read shared state before claiming, then sync the accepted claim; the
collision check is local and advisory.

`tbd web` stays in the foreground, binds loopback only, has no write route, and serves
the same queries and hierarchy as the CLI. It is a viewer, not an editor: ask the agent
to change beads with ordinary commands, and the open page updates automatically; it
never fetches from the remote on its own, and `tbd web ../another-repo --open` serves
any initialized repository.
`tbd watch` polls the remote sync-branch tip, fetches only once it moves, reports one
matching change, and exits; a `--ready` watch is edge-triggered, so the
[watch-beads shortcut](packages/tbd/docs/shortcuts/standard/watch-beads.md) adds startup
and periodic `tbd ready` scans for an unattended worker loop.
The [CLI reference](packages/tbd/docs/tbd-docs.md) has ports, selectors, and the JSON
and dry-run options.

### External Trackers (Linear)

```bash
tbd integration status                 # Verify config, credential, and connectivity
tbd --dry-run integration sync         # Preview the full reconciliation, write nothing
tbd integration sync                   # Both directions: reconcile every linked pair
tbd integration sync --push            # Outbound only: project beads to the tracker
tbd integration link proj-a7k2 FIN-123 # Bind a bead to an existing issue
tbd integration unlink proj-a7k2       # Sever the link; nothing is deleted anywhere
```

Once an integration is enabled, plain `tbd sync` includes it, so most sessions never
need these directly.

### Documentation and Maintenance

```bash
tbd                          # Command help
tbd prime                    # Full orientation and workflow guidance
tbd readme                   # This file
tbd docs                     # Managed-docs overview (cached, forked, and local docs)
tbd docs show tbd-docs       # Full CLI reference (the manual; alias: tbd docs manual)
tbd design                   # Design doc
tbd status                   # Repository status and installed surfaces (works before init too)
tbd stats                    # Bead statistics
tbd doctor                   # Check for problems (--fix repairs them)
tbd policy show              # Agent policy grants (see Agent Policies and Delegation)
```

Online: the [CLI Reference](packages/tbd/docs/tbd-docs.md) and the
[Design Doc](packages/tbd/docs/tbd-design.md).

### Agent-Friendly Flags

These global flags are accepted by every command, but commands apply only the behavior
they implement:

| Flag | Purpose |
| --- | --- |
| `--json` | Structured output for data-oriented commands; raw document commands remain text |
| `--dry-run` | Preview supported mutations; read-only commands may ignore it |
| `--quiet` | Minimal output |

## Shortcuts, Guidelines, and Templates

`tbd` bundles three kinds of documentation your agent loads on demand:

```bash
tbd shortcut --list              # List all shortcuts
tbd shortcut new-plan-spec       # Get the plan spec workflow
tbd guidelines --list            # List all guidelines
tbd guidelines typescript-rules  # Get TypeScript rules (several names in one call)
tbd template --list              # List all templates
tbd template plan-spec           # Get a plan spec template
tbd guidelines --add=<url> --name=my-team-rules   # Add your own from any URL (shortcut and template take --add too)
```

These docs are cached in `.tbd/docs/` (gitignored) during setup and refreshed by every
`tbd setup --auto`. Fork any of them into `docs/tbd/` with `tbd docs fork <name>` (or
`--category=<name>` or `--all`) and they become visible on GitHub, reviewable in PRs,
and editable in place: tbd serves your copy instead, and `tbd docs update` merges
upstream improvements into it after an upgrade.
`.tbd/config.yml` configures which docs are available.

**Available shortcuts:**

| Category | Shortcut | Purpose |
| --- | --- | --- |
| **Planning** | `new-plan-spec` | Create a feature planning spec |
|  | `plan-implementation-with-beads` | Break a spec into implementation beads |
|  | `implement-beads` | Implement beads from a spec |
|  | `new-validation-plan` | Create a test/validation plan |
|  | `update-specs-status` | Reconcile specs, the work index, and beads into one status map |
| **Documentation** | `new-research-brief` | Create a research document |
|  | `new-architecture-doc` | Create an architecture document |
|  | `revise-architecture-doc` | Update an architecture doc to match current code |
|  | `revise-all-architecture-docs` | Revise all current architecture documents |
| **Review** | `pr-review-workflows` | Map of the PR review lifecycle and its shortcuts |
|  | `review-code` | Comprehensive code review (uncommitted, branch, or PR) |
|  | `review-github-pr` | Review a GitHub PR and publish the review |
|  | `address-pr-review` | Address a published PR review (each finding fixed, rebutted, declined, or deferred) |
|  | `review-code-typescript` | TypeScript-focused code review |
|  | `review-code-python` | Python-focused code review |
| **Git** | `precommit-process` | Pre-commit review and testing |
|  | `code-review-and-commit` | Commit with pre-commit checks |
|  | `create-or-update-pr-simple` | Basic PR creation |
|  | `create-or-update-pr-with-validation-plan` | PR with a validation plan |
|  | `merge-upstream` | Merge origin/main with conflict resolution |
|  | `stacked-prs` | When to split work into a stack of dependent PRs, and how stacks change the PR shortcuts |
| **Cleanup** | `code-cleanup-all` | Full code cleanup (duplicates, dead code, quality) |
|  | `code-cleanup-tests` | Remove trivial/low-value tests |
|  | `code-cleanup-docstrings` | Add docstrings to major functions |
| **Session** | `agent-handoff` | Generate handoff prompt for another agent |
|  | `welcome-user` | Welcome message after tbd installation |
|  | `setup-github-cli` | Ensure GitHub CLI is installed and working |
|  | `sync-failure-recovery` | Handle tbd sync failures |
|  | `checkout-third-party-repo` | Clone library source code for review |
| **Exploration** | `coding-spike` | Prototype to validate a spec through implementation |
| **Meta** | `new-guideline` | Create a new coding guideline for tbd |
|  | `new-shortcut` | Create a new shortcut for tbd |

**Available guidelines:**

Engineering process and cross-cutting rules:

| Guideline | What it covers |
| --- | --- |
| [general-eng-agent-principles](packages/tbd/docs/guidelines/general-eng-agent-principles.md) | Senior-engineer responsibility, verification, scope discipline, and when to act or clarify |
| [general-coding-rules](packages/tbd/docs/guidelines/general-coding-rules.md) | Named constants, magic-number avoidance, and when cryptographic hash checks add real assurance |
| [general-comment-rules](packages/tbd/docs/guidelines/general-comment-rules.md) | Comments that preserve non-obvious rationale without restating code |
| [backward-compatibility-rules](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | Compatibility across code, APIs, file formats, and database schemas |
| [error-handling-rules](packages/tbd/docs/guidelines/error-handling-rules.md) | Failure propagation, error context, cleanup, exit status, and partial success |
| [ci-and-gates-rules](packages/tbd/docs/guidelines/ci-and-gates-rules.md) | One local and CI entry point, negative probes, packaged-artifact evidence, and job-scoped workflow authority |
| [code-review-rules](packages/tbd/docs/guidelines/code-review-rules.md) | Severity vocabulary, review baseline, risk-ordered reading, and actionable findings |
| [filesystem-rules](packages/tbd/docs/guidelines/filesystem-rules.md) | Atomic output publication, crash durability, collision policy, deterministic traversal, and partial failure |
| [supply-chain-hardening](packages/tbd/docs/guidelines/supply-chain-hardening.md) | Dependency cool-offs, lockfiles, install scripts, provenance, and immutable CI inputs |
| [release-engineering-rules](packages/tbd/docs/guidelines/release-engineering-rules.md) | Rehearsable release state, immutable artifact identity, build-once promotion, channel evidence, and recovery |
| [release-notes-guidelines](packages/tbd/docs/guidelines/release-notes-guidelines.md) | User-visible release deltas without listing development-only fixes as shipped changes |
| [agent-run-operations-rules](packages/tbd/docs/guidelines/agent-run-operations-rules.md) | Pinned launch checkouts, one scheduler per host budget, host-first slowness diagnosis, validating metrics, and reading prompts before blaming a model |
| [agent-session-bootstrap](packages/tbd/docs/guidelines/agent-session-bootstrap.md) | Installing a repository’s pinned toolchain in agent environments |

Testing:

| Guideline | What it covers |
| --- | --- |
| [general-tdd-guidelines](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | Red-Green-Refactor, small slices, and test-first discipline |
| [general-testing-rules](packages/tbd/docs/guidelines/general-testing-rules.md) | Low test volume with high coverage, vacuous tests, loop speed, and portability |
| [golden-testing-guidelines](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | End-to-end golden sessions, stable fields, YAML captures, and mock modes |
| [typescript-code-coverage](packages/tbd/docs/guidelines/typescript-code-coverage.md) | Coverage with Vitest and the V8 provider |

TypeScript and JavaScript:

| Guideline | What it covers |
| --- | --- |
| [typescript-rules](packages/tbd/docs/guidelines/typescript-rules.md) | Strict type safety, type guards, null safety, async patterns, and atomic file replacement |
| [typescript-lint-format-rules](packages/tbd/docs/guidelines/typescript-lint-format-rules.md) | Lint and formatting floor across ESLint/Prettier and Biome toolchains |
| [typescript-sorting-patterns](packages/tbd/docs/guidelines/typescript-sorting-patterns.md) | Deterministic sorting and comparison chains for multi-field sorts |
| [typescript-cli-tool-rules](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | Commander.js patterns, streams, exit status, and terminal formatting |
| [typescript-yaml-handling-rules](packages/tbd/docs/guidelines/typescript-yaml-handling-rules.md) | YAML parsing and serialization, Zod validation, and stable formatting |
| [pnpm-monorepo-patterns](packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md) | pnpm workspaces, tsdown, Vitest, Changesets, publint, and dual ESM/CJS |
| [bun-monorepo-patterns](packages/tbd/docs/guidelines/bun-monorepo-patterns.md) | Bun workspaces, Bunup, Biome, `bun test`, and standalone executables |

Python:

| Guideline | What it covers |
| --- | --- |
| [python-rules](packages/tbd/docs/guidelines/python-rules.md) | Type annotations, imports, exceptions, resource management, and atomic file replacement |
| [python-modern-guidelines](packages/tbd/docs/guidelines/python-modern-guidelines.md) | uv-based projects, Strif atomic output, and concise human-readable formatting |
| [python-cli-patterns](packages/tbd/docs/guidelines/python-cli-patterns.md) | Python CLI architecture and the boundary between Python programs and Rust executables distributed in wheels |

Rust:

| Guideline | What it covers |
| --- | --- |
| [rust-rules](packages/tbd/docs/guidelines/rust-rules.md) | Ownership, domain types, errors, unsafe code, async, and performance |
| [rust-lint-format-rules](packages/tbd/docs/guidelines/rust-lint-format-rules.md) | The `[lints]` floor, `clippy.toml`, and measured adoption cost beyond the floor |
| [rust-project-setup](packages/tbd/docs/guidelines/rust-project-setup.md) | Shortest Rust CLI setup path, Cargo shape, features, current toolchain, MSRV, and the local quality gate |
| [rust-cli-rules](packages/tbd/docs/guidelines/rust-cli-rules.md) | clap patterns, stream composability, exit status, broken pipes, and destructive commands |
| [rust-testing-rules](packages/tbd/docs/guidelines/rust-testing-rules.md) | Test boundaries, fixtures, snapshots, properties, features, and platform matrices |
| [rust-filesystem-rules](packages/tbd/docs/guidelines/rust-filesystem-rules.md) | Path and `OsStr` types, atomic output publication, traversal crates, and error propagation |
| [rust-release-rules](packages/tbd/docs/guidelines/rust-release-rules.md) | Cargo and crates.io, native target contracts, Maturin binary wheels, uv commands, and registry bootstrap |
| [rust-code-review-rules](packages/tbd/docs/guidelines/rust-code-review-rules.md) | Unsafe and FFI review plus investigative Rust quick-scan questions |

Frameworks and application platforms:

| Guideline | What it covers |
| --- | --- |
| [cli-agent-skill-patterns](packages/tbd/docs/guidelines/cli-agent-skill-patterns.md) | Portable skills, local-first exact CLI acquisition, and safe bundle installation |
| [electron-app-development-patterns](packages/tbd/docs/guidelines/electron-app-development-patterns.md) | Electron process boundaries, backends, security, signing, and updates |
| [electrobun-app-development-patterns](packages/tbd/docs/guidelines/electrobun-app-development-patterns.md) | Electrobun runtime, typed RPC, packaging, delta updates, and maturity risks |
| [tauri-app-development-patterns](packages/tbd/docs/guidelines/tauri-app-development-patterns.md) | Tauri 2 capabilities, sidecars, non-Rust backends, signing, and updates |
| [convex-rules](packages/tbd/docs/guidelines/convex-rules.md) | Convex functions, schemas, queries, and mutations |
| [convex-limits-best-practices](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Convex limits, workarounds, and performance constraints |

Documentation and change history:

| Guideline | What it covers |
| --- | --- |
| [common-doc-guidelines](packages/tbd/docs/guidelines/common-doc-guidelines.md) | Concrete documentation structure, style, formatting, and required footer |
| [commit-conventions](packages/tbd/docs/guidelines/commit-conventions.md) | Conventional Commits format with agentic-workflow extensions |
| [tbd-sync-troubleshooting](packages/tbd/docs/guidelines/tbd-sync-troubleshooting.md) | Common issues and solutions for tbd sync and workspace operations |

**Available templates:**

| Template | Description |
| --- | --- |
| `plan-spec` | Feature planning specification |
| `research-brief` | Research document |
| `architecture` | Architecture document |

## Why tbd

Agents can be excellent or poor depending on what they are given: without structure and
knowledge they forget conventions between sessions, skip testing, and drift from a
team’s patterns, and neither pasting rules into prompts nor piling every rule into
`CLAUDE.md` or `AGENTS.md` scales.
Beads (git-native, CLI-based issue tracking) solve the task management part, raising an
agent’s capacity for structured work from a handful of ad-hoc to-do items to hundreds of
tracked beads with dependencies that persist in git.
Task tracking alone does not help with planning or quality, so tbd adds spec-driven
workflows to think through what to build before building it, and curated engineering
guidelines the agent loads when it needs them.
You can then hand an agent a well-defined spec with clear beads and expert knowledge and
get back careful, well-structured code, across sessions.

**Spec-driven development.** For non-trivial features:

1. **Plan**: write a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: convert the spec into implementation beads
   (`tbd shortcut plan-implementation-with-beads`)
3. **Implement**: work through the beads (`tbd shortcut implement-beads`)
4. **Validate**: write a validation plan and run the tests
   (`tbd shortcut new-validation-plan`)
5. **Ship**: commit and create the PR
   (`tbd shortcut create-or-update-pr-with-validation-plan`), then have it reviewed and
   merged (`tbd shortcut review-and-merge-prs`)

Iterating on the spec is the hard part; with a good spec, writing the code is often
almost automatic. These workflows come from
[heavy spec-driven agentic coding](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md),
and shortcuts make them repeatable, including by voice: “use the shortcut to create a
new plan spec that …”.

**Compared to Beads.** tbd was inspired by [Beads](https://github.com/steveyegge/beads)
by Steve Yegge and keeps the idea with a simpler architecture: plain Markdown files
instead of JSONL, no daemon modifying the working tree, no SQLite, no 4-way sync.
That avoids merge conflicts, sync confusion across branches and the database, and file
locking on network filesystems such as Claude Code Cloud; beads stay in git on the
`tbd-sync` branch, and `tbd watch`, `tbd web`, and `tbd integration sync` build on that
layer. The [design doc](packages/tbd/docs/tbd-design.md) has the detailed comparison.

> [!NOTE]
> *Beads* (capitalized) refers to Steve Yegge’s original
> [`bd` tool](https://github.com/steveyegge/beads).
> Lowercase “beads” refers to the issues stored in `tbd` or `bd`.

## FAQ

### How does `tbd` compare to Beads?

See [Why tbd](#why-tbd): the same idea with a simpler architecture.
If you already use Beads, `tbd setup --from-beads` migrates you, preserving every issue
ID (see [Migrating from Beads](#migrating-from-beads)).

### Can my team see beads without using the CLI?

Yes, two ways: `tbd web --open` serves a live, read-only board in a local browser, and
the Linear integration mirrors or synchronizes selected beads with your team’s tracker,
so people who never clone the repo still see, and can update, the work (see
[Optional Linear Setup](#optional-linear-setup)).

### Can agents merge my PRs?

Only when the project grants it.
Merging needs the `github-merge` policy: `not-granted` (the default while unanswered)
means the agent asks before any merge; `per-request` (recommended) lets it merge a PR
you named in the current request, such as “Make sure PR #N is reviewed and merged”; and
`unconditional` allows merging without per-case authorization, which tbd recommends
against. Before merging, `review-and-merge-prs` checks the merge gate: the review
requirements are met (under `standard`, a senior engineering review at a pinned head, a
pass addressing all its findings, and a dedicated review for each area the PR is
sensitive in), every finding has a disposition and every deferral an open bead, no newer
review content is unaddressed, any question about another round has been answered, CI is
green at the unchanged head, GitHub reports the PR mergeable, and every layer below a
stack layer has merged.
The merge uses the repository’s merge method at the gated head, never `--admin`, and a
branch-protection block is reported, not bypassed.

### Can I add my own guidelines?

Yes. Add your team’s docs from any URL with `tbd guidelines --add` (and
`tbd shortcut --add` or `tbd template --add`), fork the bundled ones into `docs/tbd/` to
edit them in place, and configure which docs are available in `.tbd/config.yml` (see
[Shortcuts, Guidelines, and Templates](#shortcuts-guidelines-and-templates)).

### Was `tbd` built with `tbd`?

Yes.
It was bootstrapped with the original `bd`, imported its own issues, and has tracked
its own specs and beads and loaded its own guidelines since; all of its code and specs
are agent-written.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
