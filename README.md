# tbd

[![Follow @ojoshe on X](https://img.shields.io/badge/follow_%40ojoshe-black?logo=x&logoColor=white)](https://x.com/ojoshe)
[![CI](https://github.com/jlevy/tbd/actions/workflows/ci.yml/badge.svg)](https://github.com/jlevy/tbd/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/get-tbd)](https://www.npmjs.com/package/get-tbd)

**tbd is a skill and CLI that upgrades coding quality, task tracking, and workflows for
any coding agent.**

Give your agent durable task memory, engineering guidelines it can load when needed, and
repeatable workflows for planning, reviewing, and shipping changes.
Start with the parts you need.
The defaults are ready to use, and you can customize or replace them with your team’s
practices.

1. **Beads**: Git-native issue tracking for tasks, bugs, and features, shared across
   sessions and machines.
2. **Spec-Driven Workflows**: Plan features, break them into beads, and implement them
   systematically.
3. **Knowledge Injection**: Engineering guidelines for languages, testing, architecture,
   and other topics, loaded on demand.
4. **Shortcuts**: Reusable instructions for code review, commits, PRs, cleanup, and
   handoffs.

These capabilities work together, but you can use beads alone or choose individual
guidelines and workflows.
`tbd` stores beads as Markdown files on a dedicated Git branch, with no required daemon
or database. It installs project skills and hooks for Claude Code and Codex and works
through the CLI in other agent environments.

[Quick Start](#quick-start) · [Adoption Choices](#adopt-only-what-you-want) ·
[Setup](#installation-and-setup) · [CLI Reference](packages/tbd/docs/tbd-docs.md) ·
[Bundled Library](#bundled-library)

## Quick Start

Requires Node.js 22.12.0 or newer and Git 2.42 or newer.
In your project, install the CLI:

```bash
npm install -g get-tbd@latest
```

Then tell your agent:

**“Run tbd prime, then set up tbd in this project.”**

The agent follows
[`tbd shortcut setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md), asks for
a short issue-ID prefix, and initializes the project.
Default setup writes the project’s tbd configuration, agent skills, hooks, and sub-agent
definitions. Review and commit those files so teammates share the setup.
See [Agent Surfaces](#agent-surfaces) to select which integrations are installed.

Setup also offers project-wide policy choices for GitHub actions, delegation, reviews,
and Linear. You can say **“not now”** and decide when a task needs them; setting up tbd
does not require granting merge authority or connecting an external tracker.

Start with a request such as **“Track the bug where login fails after a password
reset.”** Your agent creates a bead that the next session can find.
Ask **“What can I do with tbd?”** for an introduction tailored to your project.

## Adopt Only What You Want

Choose the parts that help your work; these are not required stages.

- **Beads without agent integrations.** In a Git repository, `tbd init --prefix=myapp`
  initializes task tracking without installing agent skills or hooks.
  Choose your own short prefix; `myapp` is an example.
  Commit the generated `.tbd/` configuration and use the CLI directly or through your
  agent. `tbd sync` exchanges bead state through your Git remote.
  You can add agent integrations later with `tbd setup --auto`.
- **Selected agent integrations.** Use `--surfaces` to choose which files a setup run
  installs or refreshes.
  For example, `tbd setup --auto --surfaces=portable,agents-md` installs the portable
  skill and `AGENTS.md` guidance.
  This does not uninstall existing surfaces or save a preference: repeat the selection
  on later runs; unrestricted setup installs all surfaces.
- **Your team’s knowledge.** Load the bundled guidelines you need, fork them into your
  repository to edit, or add your own docs.
  See [Guidelines, Shortcuts, and Templates](#shortcuts-guidelines-and-templates).
- **Workflows when they help.** Use a planning, review, or release shortcut for the task
  at hand. You can adjust its instructions and record standing project permissions later.
  A workflow shortcut supplies instructions to the agent; it is not an autonomous
  scheduler or an enforcement boundary.

The web viewer and bead watcher work with beads alone.
Linear, formal PR stacks, and sub-agent delegation are additional choices, not
prerequisites.

## Talking to Your Agent

Your agent operates tbd on your behalf.
These examples show both small tasks and fuller workflows; the installed skill and
[request vocabulary](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md#request-vocabulary)
provide the complete routing.

| What you say | What happens | What runs |
| --- | --- | --- |
| “There’s a bug where …” | Creates a durable task | `tbd create "..." --type=bug` |
| “Show my beads in a browser” | Starts the live, read-only viewer and keeps it running | `tbd web --open` |
| “Plan a new feature” | Writes a spec before implementation | [`tbd shortcut new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) |
| “Review PR #N” | Publishes a review | [`tbd shortcut review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) |
| “Address the reviews on PR #N” | Fixes or dispositions the findings and verifies the result | [`tbd shortcut address-pr-review`](packages/tbd/docs/shortcuts/standard/address-pr-review.md) |
| “Review and fix PR #N” | Reviews and addresses findings | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (fix mode) |
| “Get PR #N merge-ready” | Completes review and validation without merging | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (merge-ready mode) |
| “Make sure PR #N is reviewed and merged” | Reviews, addresses findings, and merges when the requirements are met | [`tbd shortcut review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) (merge mode) |
| “Set up tbd” | Checks project setup and unanswered policy choices | [`tbd shortcut setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) |
| “You can use sub-agents” | Delegates with scoped briefs and verifies the results | [`tbd shortcut delegate-to-subagents`](packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md) |

Your specific instructions take precedence over shortcut defaults: for example, “also do
a security review,” “post it as a PR comment,” or “don’t merge anything today.”

## Optional Capabilities

### Live viewing and watching

Ask your agent to **“Show my beads in a browser.”** It starts `tbd web --open`, gives
you the loopback URL, and keeps the process running.
The page updates as local beads change.
It is read-only: ask the agent to edit beads through ordinary commands.
Opening it never fetches or synchronizes remote data.

`tbd watch` observes changes on the remote sync branch; `tbd changes` reports changes
since a sync-branch commit.
For an unattended worker, the
[`watch-beads` shortcut](packages/tbd/docs/shortcuts/standard/watch-beads.md) combines
watching with checks for work already ready.
The [CLI reference](packages/tbd/docs/tbd-docs.md) has selectors, timing, and JSON
output.

### Agent policies and delegation

Project policy grants record standing consent in `AGENTS.md`; effective grants come from
the repository’s default branch.
`tbd policy show` explains the current settings.
Without a grant, the agent asks when an action needs authorization.
Unanswered merge policy means `confirm-every`; unanswered review requirements mean
`standard`.

Merge authorization and review requirements are separate: permission to merge does not
waive review or validation.
Your instructions can narrow or authorize actions for the current task, and no policy
bypasses a tool permission or sandbox.
The [policy guidelines](packages/tbd/docs/guidelines/agent-policy-grants.md) define the
values; the
[review workflow](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md) defines
review and merge requirements.

For delegated work, the
[delegation shortcut](packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md)
covers task boundaries, model tiers, evidence, and follow-up.
Default setup provides project-local tier definitions; the current model suggestions
live in [Agent Model Tiers](packages/tbd/docs/guidelines/agent-model-tiers.md).

### Optional Linear Setup

Say **“Set up Linear.”** The agent follows
[`tbd shortcut setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md),
whether it is configuring a repository for the first time or helping a teammate join.
The team, project, and sync policy are shared in `.tbd/config.yml`; each contributor’s
`LINEAR_API_KEY` stays in their environment or a gitignored `.env`, never in a commit or
chat message.

Once enabled, plain `tbd sync` includes Linear according to the integration
configuration. Teammates can view and update selected work in Linear without using the
CLI. See
[External Tracker Integrations](packages/tbd/docs/tbd-docs.md#external-tracker-integrations)
for selection, linking, and synchronization behavior.

## Installation and Setup

### Existing projects and upgrades

Install or upgrade with `npm install -g get-tbd@latest`, then ask your agent to **“Set
up tbd.”** The setup shortcut checks the installed CLI, refreshes the project, and asks
about unanswered policies.
It installs a missing or incompatible CLI and asks before an optional upgrade of a
working installation.

The underlying commands are:

```bash
tbd setup --auto --prefix=myapp   # New project with default agent integrations
tbd setup --auto                 # Existing project; refresh after upgrading the CLI
tbd setup --from-beads           # Import an uninitialized Beads project (see below)
```

A prefix is required for a new project; choose a short alphabetic name for issue IDs
such as `myapp-a1b2`. Bare `tbd setup` displays help.
Setup refreshes cached docs and selected managed agent files, preserves recorded policy
grants, and applies any repository format migration.
Review and commit the diff it reports.
If a format upgrade requires teammates to upgrade too, setup tells you; the
[manual](packages/tbd/docs/tbd-docs.md) documents compatibility and rollback.

For a fresh cloud environment, ask the agent to install `get-tbd`, run `tbd prime`, and
set up the project. The same project configuration can be committed and shared across
local and cloud sessions.

### Team setup

The first contributor chooses the prefix and commits `.tbd/config.yml` and the generated
agent files. Joining contributors install the CLI and run `tbd setup --auto` in the
cloned repository; they use the existing prefix and recorded project policies.

`tbd sync` exchanges beads on the dedicated sync branch.
Code and setup files still use your ordinary Git commits and pushes.
People who only need task tracking can use the CLI without installing every agent
integration.

### Agent Surfaces

Default setup installs all six project-local surfaces.
Select them with `--surfaces=<comma-list>`; selection does not skip initialization,
migrations, or docs refresh, and does not remove files installed earlier.

| Surface | Project files | Purpose |
| --- | --- | --- |
| `portable` | `.agents/skills/tbd/SKILL.md` | Portable skill |
| `agents-md` | Managed block in `AGENTS.md` | Orientation and project policies |
| `claude` | `.claude/skills/tbd/SKILL.md`, settings, and scripts | Claude Code skill and hooks |
| `claude-agents` | `.claude/agents/tbd-*.md` | Claude Code tier definitions |
| `codex` | `.codex/hooks.json` and scripts | Codex hooks |
| `codex-agents` | `.codex/agents/tbd-*.toml` | Codex tier definitions |

Hooks restore context and session identity and remind agents to complete their work.
Other agents can use the portable skill, `AGENTS.md`, or `tbd prime` through the CLI.
See [setup-tbd](packages/tbd/docs/shortcuts/standard/setup-tbd.md) for installation
checks.

### GitHub tooling

GitHub CLI (`gh`) is optional for core beads.
The generated session hook can install it when missing or below the required version.
To leave it alone, pass `--no-gh-cli` to setup or set `settings.use_gh_cli: false` in
`.tbd/config.yml`.

For GitHub workflows, the
[setup-github-cli shortcut](packages/tbd/docs/shortcuts/standard/setup-github-cli.md)
covers authentication, token permissions, and stack tooling.
A GitHub login is separate from permission to act.
Formal stacks can be authorized for a task or through the project’s standing policy;
existing stacks retain their stack handling.

### Migrating from Beads

Import before initializing tbd, while the source `.beads/` directory still exists:

```bash
tbd --dry-run setup --from-beads  # Preview without writing
tbd setup --from-beads           # Import and install agent integrations
tbd stats                       # Check imported totals
tbd list --all
```

Setup reads `.beads/issues.jsonl` when present, preserves issue IDs, and renames
`.beads/` to `.beads-disabled/`. Keep that directory as a recovery source and verify the
import: setup can continue after a missing JSONL file or an import warning.
It does not remove unrelated hooks, Cursor rules, Claude settings, or Beads
instructions. See the
[migration guide](packages/tbd/docs/tbd-docs.md#migration-from-beads) for details.

## Shortcuts, Guidelines, and Templates

The bundled library gives your agent instructions and references on demand.
A shortcut is a workflow to follow, a guideline is knowledge to apply, and a template is
a starting point for a document.
You can use them independently of bead tracking.

```bash
tbd shortcut --list
tbd guidelines --list
tbd template --list
tbd guidelines typescript-rules
tbd shortcut new-plan-spec
tbd template plan-spec
```

To customize the library, ask your agent to:

- **Load only what the task needs.** Select relevant topics instead of putting the whole
  library into every prompt.
- **Fork a bundled doc.** `tbd docs fork typescript-rules` creates a tracked, editable
  copy in `docs/tbd/`. tbd serves that copy; `tbd docs update` merges upstream changes
  after upgrades.
- **Add team docs.** `tbd guidelines --add=<url> --name=my-team-rules` registers a URL;
  shortcuts and templates support the same flags.
  Repository-local docs and overrides can also be configured in `.tbd/config.yml`.

The `.tbd/docs/` cache is disposable; edit a fork or your own source file instead.
The [managed-docs guide](packages/tbd/docs/tbd-docs.md#managing-docs-two-modes) explains
precedence and update conflicts.
The [Bundled Library](#bundled-library) below is generated from the shipped docs, so its
names, links, and counts stay checked in CI.

## Commands

Most users ask their agent to operate tbd.
For direct CLI use:

```bash
tbd ready                     # Find unclaimed, unblocked work
tbd create "Fix login" --type=bug
tbd show myapp-a1b2
tbd start myapp-a1b2           # Claim work under the current agent identity
tbd close myapp-a1b2 --reason="Fixed and verified"
tbd sync                      # Exchange bead state with the remote
tbd web --open                # Live local viewer
tbd status                    # Repository and installation status
tbd doctor                    # Diagnose configuration or storage problems
tbd docs                      # Managed-docs overview
tbd docs show tbd-docs         # Full CLI manual
tbd --help
```

Before claiming shared work, pull and re-read state, then sync your claim.
Claims are advisory, not atomic assignments across machines.
Data-oriented commands support `--json`; supported mutations accept `--dry-run`. The
[CLI reference](packages/tbd/docs/tbd-docs.md) has the full commands and flags.

## Why tbd

Task state and engineering context solve different problems.
Beads preserve tasks, dependencies, and decisions across sessions; guidelines make
conventions available when an agent needs them; shortcuts make practices such as
planning and review repeatable.
You can adopt each without requiring the others.
They help an agent work systematically, while tests, review, and human judgment still
determine whether a change is good.

For a larger feature, one useful path is spec → implementation beads → implementation →
validation → PR review.
For a small fix, a bead and a focused review may be enough.
Choose the process to fit the work.

`tbd` (“To Be Done,” or “TypeScript beads”) began in January 2026 as an alternative to
Steve Yegge’s [Beads](https://github.com/steveyegge/beads).
It keeps core `bd` commands and workflows familiar, with Markdown/YAML issue files and
Git-based synchronization.
Compatibility is broad, not an implementation of every `bd` feature; see the
[design comparison](packages/tbd/docs/tbd-design.md#12-when-to-use-tbd-vs-beads).
Capitalized *Beads* names the original tool; lowercase “beads” means the issues.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions, and
[docs/docs-overview.md](docs/docs-overview.md) for the documentation map.

## License

MIT

## Bundled Library

These catalogs are optional reference material.
Ask your agent to load a named document, or browse with `tbd shortcut --list`,
`tbd guidelines --list`, and `tbd template --list`.

<details> <summary>Browse all bundled shortcuts, guidelines, and templates</summary>

<!-- BEGIN GENERATED shortcuts (regenerate: pnpm --filter get-tbd generate:readme) -->

**Available shortcuts (43):**

| Category | Shortcut | Purpose |
| --- | --- | --- |
| **Planning** | [`coding-spike`](packages/tbd/docs/shortcuts/standard/coding-spike.md) | Prototype to validate a spec through hands-on implementation |
|  | [`implement-beads`](packages/tbd/docs/shortcuts/standard/implement-beads.md) | Implement beads from a spec, following TDD and project rules |
|  | [`new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) | Create a new feature planning specification document |
|  | [`new-validation-plan`](packages/tbd/docs/shortcuts/standard/new-validation-plan.md) | Create a validation/test plan showing what’s tested and what remains |
|  | [`plan-implementation-with-beads`](packages/tbd/docs/shortcuts/standard/plan-implementation-with-beads.md) | Create implementation beads from a feature planning spec |
|  | [`update-specs-status`](packages/tbd/docs/shortcuts/standard/update-specs-status.md) | Reconcile active specs, the top-level work index (e.g. TODO.md), and tbd beads into one current status map |
| **Documentation** | [`new-architecture-doc`](packages/tbd/docs/shortcuts/standard/new-architecture-doc.md) | Create an architecture document for a system or component design |
|  | [`new-research-brief`](packages/tbd/docs/shortcuts/standard/new-research-brief.md) | Create a research document for investigating a topic or technology |
|  | [`revise-all-architecture-docs`](packages/tbd/docs/shortcuts/standard/revise-all-architecture-docs.md) | Comprehensive revision of all current architecture documents |
|  | [`revise-architecture-doc`](packages/tbd/docs/shortcuts/standard/revise-architecture-doc.md) | Update an architecture document to reflect current codebase state |
| **Testing** | [`new-qa-playbook`](packages/tbd/docs/shortcuts/standard/new-qa-playbook.md) | Create a QA test playbook for manual validation workflows |
| **Review** | [`address-pr-review`](packages/tbd/docs/shortcuts/standard/address-pr-review.md) | Address existing PR reviews from any channel. Track every finding as a bead, give each one of four dispositions (fixed, rebutted, declined, deferred) with its evidence, post a marked disposition reply per review, and get CI green |
|  | [`pr-review-workflows`](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md) | The PR review lifecycle and the review-state contract every review shortcut uses (pinned review headers and markers, lettered finding IDs, four dispositions, disposition replies), plus request routes, review coverage and rounds, roles, and a summary of the merge gate |
|  | [`review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md) | Orchestrate the PR review lifecycle for one request, per PR |
|  | [`review-code`](packages/tbd/docs/shortcuts/standard/review-code.md) | Comprehensive code review for uncommitted changes, branch work, or GitHub PRs |
|  | [`review-code-correctness`](packages/tbd/docs/shortcuts/standard/review-code-correctness.md) | Dedicated correctness review pass (kind=correctness) for intricate logic where a subtle error is costly and hard to detect, such as concurrency and locking, data integrity and persisted formats, migrations, sync and merge algorithms, and numerical calculations |
|  | [`review-code-performance`](packages/tbd/docs/shortcuts/standard/review-code-performance.md) | Dedicated performance review pass (kind=performance) for a change on a hot path, over large data volumes, on a latency-sensitive path, or in memory and resource use; measures rather than estimates, and runs on top of review-code |
|  | [`review-code-python`](packages/tbd/docs/shortcuts/standard/review-code-python.md) | Python-focused code review (language-specific rules only) |
|  | [`review-code-rust`](packages/tbd/docs/shortcuts/standard/review-code-rust.md) | Rust-focused code review (language-specific rules only) |
|  | [`review-code-security`](packages/tbd/docs/shortcuts/standard/review-code-security.md) | Dedicated security review pass (kind=security) for a change that touches authentication or authorization, secrets, untrusted input, network exposure, sandboxing and permissions, file-system mutation, or dependency and build-time execution |
|  | [`review-code-typescript`](packages/tbd/docs/shortcuts/standard/review-code-typescript.md) | TypeScript-focused code review (language-specific rules only) |
|  | [`review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) | Review a GitHub pull request at a pinned head and publish the review with its header and marker, as a formal GitHub review by default or on the channel the user chose |
| **Git** | [`code-review-and-commit`](packages/tbd/docs/shortcuts/standard/code-review-and-commit.md) | Run pre-commit checks, review changes, and commit code |
|  | [`create-or-update-pr-simple`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md) | Create or update a pull request with a concise summary |
|  | [`create-or-update-pr-with-validation-plan`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-with-validation-plan.md) | Create or update a pull request with a detailed test/validation plan |
|  | [`merge-upstream`](packages/tbd/docs/shortcuts/standard/merge-upstream.md) | Merge origin/main into the current branch with conflict resolution, then verify, push, and watch CI |
|  | [`precommit-process`](packages/tbd/docs/shortcuts/standard/precommit-process.md) | Full pre-commit checklist including spec sync, code review, and testing |
|  | [`stacked-prs`](packages/tbd/docs/shortcuts/standard/stacked-prs.md) | When to use formal GitHub PR stacks, how they align with beads, and how to link and verify them with gh stack; chained branch bases alone do not count |
| **Cleanup** | [`code-cleanup-all`](packages/tbd/docs/shortcuts/standard/code-cleanup-all.md) | Full cleanup cycle including duplicate removal, dead code, and code quality improvements |
|  | [`code-cleanup-docstrings`](packages/tbd/docs/shortcuts/standard/code-cleanup-docstrings.md) | Review and add concise docstrings to major functions and types |
|  | [`code-cleanup-tests`](packages/tbd/docs/shortcuts/standard/code-cleanup-tests.md) | Review and remove tests that do not add meaningful coverage |
| **Session** | [`agent-handoff`](packages/tbd/docs/shortcuts/standard/agent-handoff.md) | Generate a concise handoff prompt for another coding agent to continue work |
|  | [`delegate-to-subagents`](packages/tbd/docs/shortcuts/standard/delegate-to-subagents.md) | Delegate parts of any task to sub-agents on any platform. When to delegate and when not to, sizing, counts, and cost |
|  | [`setup-github-cli`](packages/tbd/docs/shortcuts/standard/setup-github-cli.md) | Ensure GitHub CLI (gh) is installed and working |
|  | [`setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md) | Set up the Linear integration end to end—the linear policy grant, first-time configuration for a repository with the epics selection as the default, or adding your own API key to a repository your team already configured |
|  | [`setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) | Set up tbd in a new project, and review the setup after every tbd upgrade |
|  | [`sync-failure-recovery`](packages/tbd/docs/shortcuts/standard/sync-failure-recovery.md) | Handle tbd sync failures by saving to workspace and recovering later |
|  | [`welcome-user`](packages/tbd/docs/shortcuts/standard/welcome-user.md) | Welcome message for users after tbd installation or setup |
| **Workflow** | [`watch-beads`](packages/tbd/docs/shortcuts/standard/watch-beads.md) | Wake an agent when selected remote bead state changes |
| **Research** | [`checkout-third-party-repo`](packages/tbd/docs/shortcuts/standard/checkout-third-party-repo.md) | Get source code for libraries and third-party repos using git. Essential for reliable source code review |
| **Meta** | [`new-guideline`](packages/tbd/docs/shortcuts/standard/new-guideline.md) | Create a new coding guideline document for tbd |
|  | [`new-shortcut`](packages/tbd/docs/shortcuts/standard/new-shortcut.md) | Create a new shortcut (reusable instruction template) for tbd |
|  | [`suggest-upstream-improvements`](packages/tbd/docs/shortcuts/standard/suggest-upstream-improvements.md) | Review local doc-fork customizations and contribute the generally useful changes back upstream |

<!-- END GENERATED shortcuts -->

<!-- BEGIN GENERATED guidelines (regenerate: pnpm --filter get-tbd generate:readme) -->

**Available guidelines (46):**

| Group | Guideline | What it covers |
| --- | --- | --- |
| **General engineering** | [`general-eng-agent-principles`](packages/tbd/docs/guidelines/general-eng-agent-principles.md) | Core principles for AI agents acting as senior engineers |
| **Cross-cutting engineering topics** | [`agent-model-tiers`](packages/tbd/docs/guidelines/agent-model-tiers.md) | Provider-neutral model tiers for delegated agent work |
|  | [`agent-policy-grants`](packages/tbd/docs/guidelines/agent-policy-grants.md) | The single definition of the seven agent policies a project can grant (github-workflows, github-editing, github-merge, github-stacked-prs, subagents, pr-review-requirements, linear)—each policy’s values, recommendation, and coverage |
|  | [`agent-run-operations-rules`](packages/tbd/docs/guidelines/agent-run-operations-rules.md) | Launching, monitoring, and diagnosing long agent and batch runs |
|  | [`backward-compatibility-rules`](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | Guidelines for maintaining backward compatibility only for real consumers and data from released versions |
|  | [`ci-and-gates-rules`](packages/tbd/docs/guidelines/ci-and-gates-rules.md) | How to wire a quality gate that actually holds |
|  | [`code-review-rules`](packages/tbd/docs/guidelines/code-review-rules.md) | The language-neutral substance of a code review |
|  | [`commit-conventions`](packages/tbd/docs/guidelines/commit-conventions.md) | Conventional Commits format with extensions for agentic workflows |
|  | [`error-handling-rules`](packages/tbd/docs/guidelines/error-handling-rules.md) | Rules for handling errors, failures, and exceptional conditions |
|  | [`filesystem-rules`](packages/tbd/docs/guidelines/filesystem-rules.md) | Language-neutral rules for code that reads directory trees or mutates files |
|  | [`general-coding-rules`](packages/tbd/docs/guidelines/general-coding-rules.md) | Rules for constants, magic numbers, cryptographic hash checks, and general coding practices |
|  | [`general-comment-rules`](packages/tbd/docs/guidelines/general-comment-rules.md) | Language-agnostic rules for writing clean, maintainable comments |
|  | [`general-tdd-guidelines`](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | Test-Driven Development methodology and best practices |
|  | [`general-testing-rules`](packages/tbd/docs/guidelines/general-testing-rules.md) | Rules for keeping test volume low while preserving broad evidence |
|  | [`golden-testing-guidelines`](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | Guidelines for implementing golden/snapshot testing for complex systems |
|  | [`release-engineering-rules`](packages/tbd/docs/guidelines/release-engineering-rules.md) | Language-neutral release orchestration: immutable identity, rehearsable state transitions, build-once artifact promotion, least-privilege publishing, independent channel recovery, and separate artifact and publication evidence |
|  | [`release-notes-guidelines`](packages/tbd/docs/guidelines/release-notes-guidelines.md) | Rules for release notes that describe the published delta and exclude defects introduced and corrected before release from separate Fixes entries |
|  | [`supply-chain-hardening`](packages/tbd/docs/guidelines/supply-chain-hardening.md) | Strongly recommended for EVERY repo—apply it if a repo has not been hardened yet. Cross-ecosystem policy for installing dependencies safely (the 14-day cool-off, disabled install scripts, lockfile discipline, untrusted-repo handling) |
| **TypeScript & JS ecosystem** | [`bun-monorepo-patterns`](packages/tbd/docs/guidelines/bun-monorepo-patterns.md) | Modern patterns for Bun-based TypeScript monorepo architecture |
|  | [`pnpm-monorepo-patterns`](packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md) | Modern patterns for pnpm-based TypeScript monorepo architecture |
|  | [`typescript-cli-tool-rules`](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | Rules for building CLI tools with Commander.js, picocolors, and TypeScript |
|  | [`typescript-code-coverage`](packages/tbd/docs/guidelines/typescript-code-coverage.md) | Best practices for code coverage in TypeScript with Vitest and v8 provider |
|  | [`typescript-lint-format-rules`](packages/tbd/docs/guidelines/typescript-lint-format-rules.md) | The shared lint and auto-formatting floor for all TypeScript and JavaScript projects, across pnpm and Bun and across ESLint/Prettier and Biome toolchains |
|  | [`typescript-rules`](packages/tbd/docs/guidelines/typescript-rules.md) | TypeScript coding rules and best practices |
|  | [`typescript-sorting-patterns`](packages/tbd/docs/guidelines/typescript-sorting-patterns.md) | Deterministic sorting patterns and comparison chains for TypeScript |
|  | [`typescript-yaml-handling-rules`](packages/tbd/docs/guidelines/typescript-yaml-handling-rules.md) | Best practices for parsing and serializing YAML in TypeScript |
| **Python** | [`python-cli-patterns`](packages/tbd/docs/guidelines/python-cli-patterns.md) | Modern Python CLI architecture, with a clear boundary between Python programs and Rust executables distributed through Python wheels |
|  | [`python-modern-guidelines`](packages/tbd/docs/guidelines/python-modern-guidelines.md) | Guidelines for modern Python projects using uv, with a few more opinionated practices |
|  | [`python-rules`](packages/tbd/docs/guidelines/python-rules.md) | General Python coding rules and best practices |
| **Rust** | [`rust-cli-rules`](packages/tbd/docs/guidelines/rust-cli-rules.md) | Rules for composable, testable, and cross-platform Rust command-line applications |
|  | [`rust-code-review-rules`](packages/tbd/docs/guidelines/rust-code-review-rules.md) | The Rust-specific half of review—which guideline owns each changed surface, the unsafe and FFI checklist, and a Rust quick-scan table of investigative questions and possible consequences |
|  | [`rust-filesystem-rules`](packages/tbd/docs/guidelines/rust-filesystem-rules.md) | The Rust-specific half of filesystem work—path and string types, intent-specific write boundaries, the tempfile atomic-replacement sequence, traversal crate choice and error propagation, and platform metadata |
|  | [`rust-lint-format-rules`](packages/tbd/docs/guidelines/rust-lint-format-rules.md) | The lint and auto-formatting floor for every Rust project—the `[lints]` block, the clippy.toml, rustfmt and toolchain pinning, hooks and CI gates, and how to prove the floor is live |
|  | [`rust-project-setup`](packages/tbd/docs/guidelines/rust-project-setup.md) | A practical setup path for Rust packages and CLIs: Cargo shape, features, pinned toolchains and MSRV, one local quality entry point, and the CI baseline |
|  | [`rust-release-rules`](packages/tbd/docs/guidelines/rust-release-rules.md) | Rust-specific release mechanics for Cargo and crates.io, native binary targets, optional Maturin bin wheels for uv users, compatibility floors, trusted-publisher bootstrap, and packaged-artifact tests |
|  | [`rust-rules`](packages/tbd/docs/guidelines/rust-rules.md) | General Rust coding rules for modern libraries, applications, services, and command-line tools |
|  | [`rust-testing-rules`](packages/tbd/docs/guidelines/rust-testing-rules.md) | Rules for effective unit, integration, property, snapshot, and cross-platform testing in Rust |
| **Convex** | [`convex-limits-best-practices`](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Comprehensive reference for Convex platform limits, workarounds, and performance best practices |
|  | [`convex-rules`](packages/tbd/docs/guidelines/convex-rules.md) | Guidelines and best practices for building Convex projects, including database schema design, queries, mutations, and real-world examples |
| **Desktop app frameworks** | [`electrobun-app-development-patterns`](packages/tbd/docs/guidelines/electrobun-app-development-patterns.md) | Building desktop apps with Electrobun—runtime and process model, typed RPC, project layout, packaging and the delta updater, plus an evidence-based maturity and security assessment |
|  | [`electron-app-development-patterns`](packages/tbd/docs/guidelines/electron-app-development-patterns.md) | Building a clean, minimal, standalone Electron app—process model, modern Vite-based build system, attaching a Node/Bun/Python backend, security baseline, packaging, code signing, and auto-update |
|  | [`tauri-app-development-patterns`](packages/tbd/docs/guidelines/tauri-app-development-patterns.md) | Building desktop apps with Tauri 2—the Rust core and system webview model, capabilities and permissions, typed commands and IPC, attaching Rust or non-Rust backends, packaging, signing, and the signed updater |
| **Docs, process & tooling** | [`agent-session-bootstrap`](packages/tbd/docs/guidelines/agent-session-bootstrap.md) | When and how to make a repository install its own pinned toolchain at agent session start, for repos whose agents run in containers they do not control |
|  | [`cli-agent-skill-patterns`](packages/tbd/docs/guidelines/cli-agent-skill-patterns.md) | A concise decision guide for portable skills, local-first and exact-version CLI acquisition, safe bundle installation, and agent integration |
|  | [`common-doc-guidelines`](packages/tbd/docs/guidelines/common-doc-guidelines.md) | Common cross-project standards for writing and organizing docs, code comments, and text files—how to organize, structure, write, and format documents, plus the guideline footer convention. Downstream of github.com/jlevy/practical-prose |
|  | [`tbd-sync-troubleshooting`](packages/tbd/docs/guidelines/tbd-sync-troubleshooting.md) | Common issues and solutions for tbd sync and workspace operations |

<!-- END GENERATED guidelines -->

<!-- BEGIN GENERATED templates (regenerate: pnpm --filter get-tbd generate:readme) -->

**Available templates (4):**

| Template | Description |
| --- | --- |
| [`architecture-doc`](packages/tbd/docs/templates/architecture-doc.md) | Template for architecture documents |
| [`plan-spec`](packages/tbd/docs/templates/plan-spec.md) | Template for feature planning specification documents |
| [`qa-playbook`](packages/tbd/docs/templates/qa-playbook.md) | Template for manual testing playbooks and validation workflows |
| [`research-brief`](packages/tbd/docs/templates/research-brief.md) | Template for research documents |

<!-- END GENERATED templates -->

</details>

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
