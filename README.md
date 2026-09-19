# tbd

[![Follow @ojoshe on X](https://img.shields.io/badge/follow_%40ojoshe-black?logo=x&logoColor=white)](https://x.com/ojoshe)
[![CI](https://github.com/jlevy/tbd/actions/workflows/ci.yml/badge.svg)](https://github.com/jlevy/tbd/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/get-tbd)](https://www.npmjs.com/package/get-tbd)

**tbd is a skill and CLI that upgrades coding quality, task tracking, and workflows for
any coding agent.**

It gives agents three things:

- **Task tracking** for longer unattended operation (beads)
- **Engineering knowledge** (reusable guidelines the agent loads on demand)
- **Workflows** (code reviews, PR workflows, and other shortcuts)

Adoption is **gradual** (use only what you want), **customizable** (override or replace
skills and guidelines), and **batteries included** (the defaults encode hard-learned
practices). You can stop at install plus beads.
Everything above that is an optional layer you can adopt, skip, or replace.

tbd started in January 2026 as a better [Beads](https://github.com/steveyegge/beads)
(`bd`) and has since added workflows of many kinds.
Beads are Markdown files with YAML frontmatter on a dedicated `tbd-sync` branch: no
daemon, no database, and a drop-in CLI-compatible replacement.
It installs as a skill for Claude Code and Codex and works through the CLI in any other
agent environment.

The same four optional capabilities appear in the installed skill:

1. **Beads**: Git-native issue tracking (tasks, bugs, features).
   Persists across sessions.
   Drop-in replacement for `bd`.
2. **Spec-Driven Workflows**: Plan features → break into beads → implement
   systematically.
3. **Knowledge Injection**: Engineering guidelines (TypeScript, Python, Rust, TDD,
   testing, Convex, monorepos) available on demand.
4. **Shortcuts**: Reusable instruction templates for common workflows (code review,
   commits, PRs, cleanup, handoffs).

## Quick Start

```bash
npm install -g get-tbd@latest
```

Then tell your agent:

***“Run tbd prime, then set up tbd in this project.”***

The agent asks you for a short issue-ID prefix and runs
`tbd setup --auto --prefix=<name>`. That is a complete use: beads work, and `tbd sync`
keeps them current.
[`setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) also
*offers* policy questions (GitHub editing and merging, stacked PRs, sub-agents, PR
review requirements, Linear).
**“Not now”** and unanswered are valid: unanswered stays ask-first.
Record a grant later when a workflow needs it.

After setup, talk to your agent in natural language.
Ask “what can I do with tbd?”
for the welcome shortcut.
For cloud instances, upgrades, and Beads import, see
[Installation and Setup](#installation-and-setup).

## Adopt Only What You Want

Each rung is enough to stop:

1. **Beads.** `tbd setup --auto --prefix=<name>` (or `--from-beads`). Track work; run
   `tbd sync`. This is a complete use.
2. **Surfaces.** Default setup writes portable, `AGENTS.md`, Claude, and Codex files,
   plus tier-agent definitions.
   `--surfaces=` keeps only the generated agent files you want.
   Initialization, format migration, and the docs cache still run.
3. **Guidelines and shortcuts.** The bundled set is a default library, not a contract.
   Load none until a task needs one.
   Keep the standard set, keep a language/stack subset, fork into `docs/tbd/` and edit,
   add your own from a URL, or point `docs_cache.files` / `docs_cache.local_dirs` at
   replacements. `tbd shortcut --list` and `tbd guidelines --list` are the live indexes.
4. **Policies.** Grants in `AGENTS.md` are settable preferences for the whole project.
   Unanswered is ask-first (`confirm-every` for `github-merge`, `standard` for
   `pr-review-requirements`). Record a standing grant only if you want that flow without
   being asked each time.

The PR review lifecycle, stacked PRs, Linear, `tbd web`, and `tbd watch` sit on rungs
3–4. They are capabilities you turn on by asking, not a process you opt out of.

## Talking to Your Agent

The agent translates your requests into `tbd` commands.
These are exemplars, not a checklist.
Every shortcut default yields to your wording (“post the review as a PR comment”, “don’t
merge anything today”).

| What you say | What runs |
| --- | --- |
| “There’s a bug where …” | `tbd create "..." --type=bug` |
| “Show my beads in a browser” | `tbd web --open` |
| “Plan a new feature” / “Create a spec” | [`tbd shortcut new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) |
| “Review PR #N” | [`tbd shortcut review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) |
| “Create a PR” | [`tbd shortcut create-or-update-pr-simple`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md) |
| “Set up tbd” | [`tbd shortcut setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) |
| “Use TypeScript best practices” | [`tbd guidelines typescript-rules`](packages/tbd/docs/guidelines/typescript-rules.md) |
| “Set up Linear” | [`tbd shortcut setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md) |

For the rest, ask “what can I do with tbd?”
or have the agent run `tbd shortcut --list` and `tbd guidelines --list`. PR review
stages, addressing, and merge live in
[`pr-review-workflows`](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md) and
[`review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md).

## Optional Capabilities

One-line map. Each item is optional; the link is the procedure.

- **Beads:** one Markdown file per issue on `tbd-sync`; no daemon, no SQLite
  ([Commands](#commands), [design](packages/tbd/docs/tbd-design.md)).
- **Spec, PR, and stack workflows:** plan → beads → implement, then review or stack if
  you want ([`new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md),
  [`pr-review-workflows`](packages/tbd/docs/shortcuts/standard/pr-review-workflows.md),
  [`stacked-prs`](packages/tbd/docs/shortcuts/standard/stacked-prs.md)).
- **Policy grants:** settable preferences in `AGENTS.md`. `github-merge` is `never` /
  `confirm-every` / `confirm-session` (recommended) / `autonomous`.
  `pr-review-requirements` is independent and still applies under `autonomous`
  ([`agent-policy-grants`](packages/tbd/docs/guidelines/agent-policy-grants.md),
  `tbd policy show`).
- **Live board and watching:** `tbd web --open` (loopback, read-only); `tbd watch` wakes
  on remote bead changes ([CLI reference](packages/tbd/docs/tbd-docs.md)).
- **Linear:** mirror or sync selected beads
  ([Optional Linear Setup](#optional-linear-setup)).
- **Replaceable docs:** subset, fork, `--add`, or config
  ([Bundled Library](#bundled-library-optional)).

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

On a fresh cloud instance where the CLI is not installed, tell the agent: ***“install
tbd (npm install -g get-tbd@latest), run tbd prime, and set up tbd in this project.”***

### Setup and Upgrading

```bash
tbd setup --auto --prefix=myapp   # Fresh project (--prefix is REQUIRED: a short alphabetic name used in issue IDs, e.g. myapp → myapp-a1b2)
tbd setup --auto                  # Existing tbd project; also the upgrade step after npm install -g
tbd setup --from-beads            # Migrate from Beads (see Migrating from Beads)
```

`tbd setup --auto` is idempotent: it initializes `.tbd/`, refreshes the cached docs and
every agent surface, applies any repository format migration, and writes the policy
block in `AGENTS.md` back unchanged.
Commit the diff it reports.
Bare `tbd setup` displays help.

[`setup-tbd`](packages/tbd/docs/shortcuts/standard/setup-tbd.md) wraps those commands:
it installs or upgrades the CLI, runs setup, asks about unanswered policy grants, and
sets up `gh`, stack tooling, and Linear as the grants require.
Say “Set up tbd” for a new project and after every upgrade.
Unanswered grants stay ask-first; “not now” is an answer.

If a version bump changes `tbd_format` in `.tbd/config.yml`, setup migrates it and
prints a notice; commit the diff.
Issue data is never touched, and the migration is revertible (see “Aborting a Format
Upgrade” in `tbd docs manual`).

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
| `agents-md` | A managed block in `AGENTS.md` | Orientation, plus the policy block |
| `claude` | `.claude/skills/tbd/SKILL.md`, hooks, scripts | The Claude Code skill mirror and hooks |
| `claude-agents` | `.claude/agents/tbd-*.md` | Tier agent definitions for sub-agents |
| `codex` | `.codex/hooks.json` and scripts | The Codex hooks |
| `codex-agents` | `.codex/agents/tbd-*.toml` | Tier agent definitions for sub-agents |

`tbd prime` gives any agent the full workflow.
To leave tier agents out: `--surfaces=portable,agents-md,claude,codex`.
`tbd uninstall --confirm` removes `.tbd/` and the generated tier definitions; skills,
hooks, and the `AGENTS.md` block stay.

### GitHub Authentication

The PR shortcuts use `gh`. Authenticate with `gh auth login`, or set `GH_TOKEN` and
`GH_PROMPT_DISABLED=1` before the session.
See [`setup-github-cli`](packages/tbd/docs/shortcuts/standard/setup-github-cli.md).
Stack tooling is installed only when `github-stacked-prs` is granted.
A working `gh` login is not a grant, and a grant never bypasses a tool permission.

### Optional Linear Setup

tbd works without an external tracker.
Say **“Set up Linear.”** The agent runs
[`tbd shortcut setup-linear`](packages/tbd/docs/shortcuts/standard/setup-linear.md).
`.tbd/config.yml` holds the shared Linear team, project, and policy; each contributor
supplies a personal `LINEAR_API_KEY` through the environment or a gitignored `.env`,
never in chat or in a commit.
When the `linear` policy is granted, the default selection is `epics`: open epic beads,
both directions. Plain `tbd sync` then covers Linear.
Details:
[External Tracker Integrations](packages/tbd/docs/tbd-docs.md#external-tracker-integrations).

### Migrating from Beads

```bash
tbd --dry-run setup --from-beads  # Preview; writes nothing
tbd setup --from-beads            # Initialize, import, install surfaces, archive .beads/
tbd stats                         # Verify
tbd list --all
```

Run this before initializing tbd, while `.beads/` still exists.
Setup imports `.beads/issues.jsonl` when present and renames the directory to
`.beads-disabled/`. Verify the totals.
Issue IDs are preserved.

## Commands

```bash
tbd ready                      # Open work with no delegate, hold, deferral, or blocker
tbd list                       # List open beads (--all includes closed; --specs groups by spec)
tbd show proj-a7k2             # View bead details (several IDs in one call)
tbd create "Title" --type=bug  # Create bead (bug/feature/task/epic/chore)
tbd start proj-a7k2            # Claim under the resolved agent identity
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync                       # Sync with remote (auto-commits and pushes)
tbd web --open                 # Open the live, read-only browser viewer
tbd watch --ready --json       # Block until a bead newly becomes ready
tbd policy show                # Agent policy grants
tbd                          # Command help
tbd prime                    # Full orientation
tbd readme                   # This file
tbd docs show tbd-docs       # CLI reference (alias: tbd docs manual)
tbd design                   # Design doc
tbd doctor                   # Check for problems (--fix repairs them)
```

`tbd web` binds loopback only and has no write route.
Ask the agent to change beads with ordinary commands; the open page updates.
It never fetches the remote on its own.
The [CLI reference](packages/tbd/docs/tbd-docs.md) has flags, watch selectors, and
integration verbs.

`--json`, `--dry-run`, and `--quiet` are accepted globally; each command applies only
the behavior it implements.
Raw document commands stay text.

## Bundled Library (optional)

The tables below are a live index of the default library, regenerated by
`pnpm --filter get-tbd generate:readme`. They are not a required set.
Prefer `tbd shortcut --list`, `tbd guidelines --list`, and `tbd template --list` in a
session. `tbd template plan-spec` is the planning-spec scaffold.

These docs are cached in `.tbd/docs/` during setup.
Fork any of them into `docs/tbd/` with `tbd docs fork <name>` (or `--category=<name>` or
`--all`); tbd serves your copy, and `tbd docs update` merges upstream after an upgrade.
Add from a URL with `tbd docs add` or the per-kind `--add` flags.
`.tbd/config.yml` configures which docs are available.

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

## Why tbd

Agents forget conventions between sessions, skip testing, and drift from a team’s
patterns. Pasting rules into prompts, or piling every rule into `CLAUDE.md` or
`AGENTS.md`, does not scale.

Beads (git-native, CLI-based issue tracking) raise an agent’s capacity for structured
work from a handful of ad-hoc to-dos to hundreds of tracked beads with dependencies that
persist in git. That is the core.
Task tracking alone does not help with planning or quality, so tbd also ships optional
guidelines and shortcuts you choose, load, fork, or replace.

**Compared to Beads.** tbd keeps the Beads idea with a simpler architecture: plain
Markdown instead of JSONL, no daemon modifying the working tree, no SQLite, no 4-way
sync. That avoids merge conflicts, sync confusion across branches and the database, and
file locking on network filesystems such as Claude Code Cloud.
The [design doc](packages/tbd/docs/tbd-design.md) has the detailed comparison.

> [!NOTE]
> *Beads* (capitalized) refers to Steve Yegge’s original
> [`bd` tool](https://github.com/steveyegge/beads).
> Lowercase “beads” refers to the issues stored in `tbd` or `bd`.

**Spec-driven development** is one optional flow, not the default plot.
If you want it: write a planning spec (`tbd shortcut new-plan-spec`), break it into
beads (`tbd shortcut plan-implementation-with-beads`), implement
(`tbd shortcut implement-beads`), validate (`tbd shortcut new-validation-plan`), and
ship. These workflows come from
[heavy spec-driven agentic coding](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md).

## FAQ

### How does `tbd` compare to Beads?

See [Why tbd](#why-tbd): the same idea with a simpler architecture.
If you already use Beads, `tbd setup --from-beads` migrates you and preserves every
issue ID (see [Migrating from Beads](#migrating-from-beads)).

### Can my team see beads without using the CLI?

Yes. `tbd web --open` serves a live, read-only board in a local browser.
The Linear integration mirrors or synchronizes selected beads with your team’s tracker,
so people who never clone the repo can still see, and update, the work (see
[Optional Linear Setup](#optional-linear-setup)).

### Can agents merge my PRs?

Only as far as the project allows.
`github-merge` has four values, not yes or no:

- `never` — an agent does not merge
- `confirm-every` — each merge needs its own authorization; this is what an unanswered
  policy means
- `confirm-session` (recommended) — a session confirmation covers the task it was given
  for, including every layer of a stack those merges include; a PR outside that task
  needs its own confirmation
- `autonomous` — merge without asking

`pr-review-requirements` is a separate policy.
No merge value lowers that bar, including `autonomous`. The merge procedure lives in
[`review-and-merge-prs`](packages/tbd/docs/shortcuts/standard/review-and-merge-prs.md);
the value definitions live in
[`agent-policy-grants`](packages/tbd/docs/guidelines/agent-policy-grants.md).

### Can I replace the bundled guidelines and shortcuts?

Yes. Add your own from any URL (`tbd guidelines --add`, `tbd shortcut --add`,
`tbd template --add`), fork the bundled ones into `docs/tbd/` and edit them, keep a
subset, or configure which docs are available in `.tbd/config.yml` (see
[Bundled Library](#bundled-library-optional)).

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
