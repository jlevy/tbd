# tbd

[![Follow @ojoshe on X](https://img.shields.io/badge/follow_%40ojoshe-black?logo=x&logoColor=white)](https://x.com/ojoshe)
[![CI](https://github.com/jlevy/tbd/actions/workflows/ci.yml/badge.svg)](https://github.com/jlevy/tbd/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/get-tbd)](https://www.npmjs.com/package/get-tbd)

**A drop-in meta-skill that helps any coding agent ship higher-quality, slop-free
code.**

**tbd** (short for “To Be Done,” or “TypeScript beads” if you prefer) packages in-depth
guidelines for good engineering, spec-driven processes, and disciplined task tracking
into a simple CLI that any agent can run.

The problem isn’t just that agents forget the last session.
Left to themselves, they skip steps, drift from your conventions, and repeat the same
engineering mistakes, and those patterns compound over time until they degrade the
quality of an entire repository.
`tbd` keeps good engineering practice, reliable processes, and the state of the work
durable in your repo, so every session and every agent starts from the same disciplined
baseline.

You don’t run `tbd` commands yourself.
You talk to your agent in plain language, and it routes through `tbd`’s own docs and
commands to pull in the right guidelines, follow the right process, and track the work.

I use `tbd` most in Claude Code, where it installs as a skill, but it works in Cursor,
Codex, or any agent that can run the `tbd` CLI.

## What `tbd` Gives You

Three pillars, one for each lever on output quality:

- **Engineering knowledge:** [25+ in-depth guidelines](packages/tbd/docs/guidelines/)
  covering TypeScript, Python, TDD, golden testing, Convex, monorepo setup, error
  handling, supply-chain hardening, and more, all long-lived best practices that apply
  across every session and every agent.
  Adding your own is easy, and putting a guideline into `tbd` is what gets it applied:
  the agent pulls it in when it’s relevant instead of relying on you to paste rules into
  a prompt.
- **Spec-driven processes:** 30+ **shortcuts**, reusable instructions for recurring work
  like code review, commits, PR creation, and writing planning specs.
  Shortcuts combine with **templates** (scaffolds for specs, research briefs, and
  architecture docs) to become fuller processes.
  For example, the `new-plan-spec` shortcut drives the `plan-spec` template into a
  structured planning document.
- **Disciplined task tracking:** git-native issue tracking (**beads**) for bugs,
  features, epics, and dependencies that persist across sessions.
  Beads scale an agent from a handful of ad-hoc to-dos to hundreds of structured,
  tracked items. This builds on [Beads](https://github.com/steveyegge/beads) by Steve
  Yegge, which is *unreasonably effective* at exactly this.

Four artifacts deliver these: **guidelines**, **shortcuts**, **templates**, and
**beads**.

> [!NOTE]
> We use *Beads* (capitalized) to refer to Steve Yegge’s original
> [`bd` tool](https://github.com/steveyegge/beads).
> Lowercase “beads” refers generically to the issues stored in `tbd` or `bd`.

## Quick Start

> [!TIP]
> If running on your own machine, install the `tbd` CLI yourself:
> 
> **`npm install -g get-tbd@latest`**
> 
> Then tell your agent:
> 
> ***“run tbd for instructions to set up this project”***
> 
> If running on a fresh cloud instance (like Claude Code Cloud), tell the agent:
> 
> ***“install tbd (npm install -g get-tbd@latest) and run tbd prime for instructions to
> set up this project”***
> 
> If tbd is already set up in the repo and you want the latest version, tell the agent:
> 
> ***“upgrade tbd (npm install -g get-tbd@latest), run tbd setup --auto, and commit the
> changes”***

That’s it.
Running `tbd prime` gives agents full workflow context on how to use `tbd` and
how to help you. It will then bootstrap a SKILL.md into your project by running
`tbd setup --auto` (which will add a `.tbd` directory and add itself to your `.claude`
skills and hooks). And then it will use shortcuts to welcome you and get you started.

Running `tbd` with no arguments shows help with a prominent reminder for agents to run
`tbd prime`.

You can then always ask questions like: “what can I do with tbd?”

## How You Use `tbd`

You talk to your agent in natural language; the agent translates your requests into
`tbd` commands. Some commands *do* things, like create or update beads; others help the
agent get status, context, or knowledge and decide what to do next.
This works well with voice.
I now ship whole features with prompts like “use the shortcut to create a new plan spec
that …” and “now use the shortcut to file a PR with a validation plan.”

| What you say | What happens | What runs |
| --- | --- | --- |
| “Create a bead for the bug where …” | Agent creates and tracks a bead | `tbd create "..." --type=bug` |
| “Let’s work on current beads” | Agent finds ready beads and starts working | `tbd ready` |
| “Let’s plan a new feature that …” | Agent creates a spec from a template | [`tbd shortcut new-plan-spec`](packages/tbd/docs/shortcuts/standard/new-plan-spec.md) |
| “Break this spec into beads” | Agent creates implementation beads from the spec | [`tbd shortcut plan-implementation-with-beads`](packages/tbd/docs/shortcuts/standard/plan-implementation-with-beads.md) |
| “Implement these beads” | Agent works through beads systematically | [`tbd shortcut implement-beads`](packages/tbd/docs/shortcuts/standard/implement-beads.md) |
| “Review this code” | Agent performs comprehensive code review with all guidelines | [`tbd shortcut review-code`](packages/tbd/docs/shortcuts/standard/review-code.md) |
| “Review this PR” | Agent reviews a GitHub pull request and can comment/fix | [`tbd shortcut review-github-pr`](packages/tbd/docs/shortcuts/standard/review-github-pr.md) |
| “Use the shortcut to commit” | Agent runs full pre-commit checks, code review, and commits | [`tbd shortcut code-review-and-commit`](packages/tbd/docs/shortcuts/standard/code-review-and-commit.md) |
| “Create a PR” | Agent creates or updates the pull request | [`tbd shortcut create-or-update-pr-simple`](packages/tbd/docs/shortcuts/standard/create-or-update-pr-simple.md) |
| “How could we test this better?” | Agent loads TDD and testing guidelines | [`tbd guidelines general-tdd-guidelines`](packages/tbd/docs/guidelines/general-tdd-guidelines.md) |
| “Use TypeScript best practices here” | Agent loads TypeScript rules | [`tbd guidelines typescript-rules`](packages/tbd/docs/guidelines/typescript-rules.md) |
| “Let’s create a research brief on …” | Agent creates a research document from a template | [`tbd shortcut new-research-brief`](packages/tbd/docs/shortcuts/standard/new-research-brief.md) |

Under the hood, your agent runs these `tbd` commands automatically.
You just talk naturally.

## Why It Works

A few principles explain why this combination works, and why it keeps working as models
get stronger.

**The pieces compose.** Guidelines, processes, and tracking aren’t three separate tools
bolted together; they reinforce each other.
A code review runs a shortcut (the consistent steps), judged against the relevant
guidelines (real standards, not the model’s mood that day), with findings captured as
beads (so nothing reviewed-but-unfixed gets lost between sessions).
Planning works the same way: a guideline shapes the spec, a shortcut breaks it into
beads, the beads carry it forward.
Even within the document layer, a shortcut plus a template compose into a richer
process.

**Everything is available at scale, routed by attention.** `tbd` isn’t one skill or one
giant rules file. It’s effectively dozens of focused skills (25+ guidelines, 30+
shortcuts, and document templates), each surfaced only when it’s situationally relevant.
The agent doesn’t carry all of it in context at once; it pulls in the one piece that
applies, when it applies.
That’s what lets the knowledge be deep without drowning the context window.

**The guidance is high-level, not over-prescriptive.** The guidelines and shortcuts
encode principles and direction, not rigid step-by-step rules that micromanage the
model. That’s why they hold up across model capabilities: a more capable model applies a
guideline more judiciously and composes shortcuts more flexibly rather than outgrowing
them. In practice they make a clear difference even with the strongest current models:
they help Opus 4.8 and Fable write better-structured, more maintainable code, because
good principles amplify a good model rather than constrain it.

**Batteries included, fully yours to change.** Every guideline, shortcut, and template
ships built-in and works immediately.
Every one is also forkable into `docs/tbd/` (visible in git, reviewable in PRs, editable
in place), replaceable with your own, or extensible from any URL. `tbd docs update`
merges upstream improvements into your forks on upgrade, so customizing doesn’t strand
you on a stale copy.

**Git-native underneath.** Beads live on a dedicated `tbd-sync` branch, so bead churn
never pollutes your code history, and documents are managed in your repo.
Everything persists in git, which is what makes it durable across sessions and shareable
across a team.

**Scope.** `tbd` focuses on this durable layer today.
It does not try to solve real-time multi-agent coordination (sub-second messaging,
atomic claims), though that’s a direction it may grow into rather than a hard boundary.
For now, knowledge, process, and durable tracking are where the leverage is.

And yes, all the code *and* all the specs of `tbd` are agent-written; see
[the FAQ](#was-tbd-built-with-tbd).

## Built-in Engineering Knowledge

When you run `tbd setup`, your agent gets instant access to
[25+ guideline documents](packages/tbd/docs/guidelines/) covering real-world engineering
practices. These aren’t generic tips; they’re mostly my own detailed and sometimes
opinionated rules with concrete examples, built from months of heavy agentic coding.

> [!TIP]
> An example: I *strongly* believe there are much better ways to do testing than
> proliferating hundreds of unit and integration tests.
> So (with help from some Opus 4.5 and GPT-5 Pro) I wrote a multi-page brief about
> “[golden testing](packages/tbd/docs/guidelines/golden-testing-guidelines.md)”
> techniques, which allow the LLM to do end-to-end testing of CLI or web app flows in a
> clean, token-friendly way.
> Now simply telling your agent “check the guidelines on golden testing” can make a huge
> difference, encouraging far more maintainable, deeper tests.

| Guideline | What it covers |
| --- | --- |
| [general-eng-agent-principles](packages/tbd/docs/guidelines/general-eng-agent-principles.md) | Core principles for agents as senior engineers: understanding, verification, end-to-end ownership, scope discipline (load first) |
| [error-handling-rules](packages/tbd/docs/guidelines/error-handling-rules.md) | Handling errors, failures, and exceptional conditions (load first) |
| [general-tdd-guidelines](packages/tbd/docs/guidelines/general-tdd-guidelines.md) | Red-Green-Refactor methodology, small slices, test-first discipline |
| [golden-testing-guidelines](packages/tbd/docs/guidelines/golden-testing-guidelines.md) | Snapshot/golden testing for complex systems: session schemas, YAML captures, mock modes |
| [general-testing-rules](packages/tbd/docs/guidelines/general-testing-rules.md) | Minimal tests for maximum coverage, avoiding redundant test cases |
| [typescript-rules](packages/tbd/docs/guidelines/typescript-rules.md) | Strict type safety, no `any`, type guards, null safety, async patterns |
| [typescript-cli-tool-rules](packages/tbd/docs/guidelines/typescript-cli-tool-rules.md) | Commander.js patterns, picocolors, terminal formatting |
| [typescript-code-coverage](packages/tbd/docs/guidelines/typescript-code-coverage.md) | Code coverage best practices with Vitest and v8 provider |
| [typescript-sorting-patterns](packages/tbd/docs/guidelines/typescript-sorting-patterns.md) | Deterministic sorting, comparison chains for multi-field sorts |
| [typescript-yaml-handling-rules](packages/tbd/docs/guidelines/typescript-yaml-handling-rules.md) | YAML parsing/serialization with the `yaml` package, Zod validation |
| [pnpm-monorepo-patterns](packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md) | pnpm workspaces, tsdown, Vitest, Changesets, publint, dual ESM/CJS |
| [bun-monorepo-patterns](packages/tbd/docs/guidelines/bun-monorepo-patterns.md) | Bun workspaces, Bunup, Biome, bun test, standalone executables |
| [cli-agent-skill-patterns](packages/tbd/docs/guidelines/cli-agent-skill-patterns.md) | Building CLIs that function as agent skills in Claude Code |
| [electron-app-development-patterns](packages/tbd/docs/guidelines/electron-app-development-patterns.md) | Electron ecosystems (npm, pnpm, Bun), security baselines, Electrobun comparison |
| [python-rules](packages/tbd/docs/guidelines/python-rules.md) | Type hints, docstrings, exception handling, resource management |
| [python-modern-guidelines](packages/tbd/docs/guidelines/python-modern-guidelines.md) | Modern Python projects using uv, with opinionated practices |
| [python-cli-patterns](packages/tbd/docs/guidelines/python-cli-patterns.md) | Modern Python CLI stack: uv, Typer, Rich, Ruff, BasedPyright |
| [convex-rules](packages/tbd/docs/guidelines/convex-rules.md) | Convex function syntax, schema design, queries, mutations |
| [convex-limits-best-practices](packages/tbd/docs/guidelines/convex-limits-best-practices.md) | Convex platform limits, workarounds, performance tuning |
| [backward-compatibility-rules](packages/tbd/docs/guidelines/backward-compatibility-rules.md) | Compatibility across code, APIs, file formats, and database schemas |
| [supply-chain-hardening](packages/tbd/docs/guidelines/supply-chain-hardening.md) | Installing dependencies safely: 14-day cool-off, disabled install scripts, lockfile discipline |
| [release-notes-guidelines](packages/tbd/docs/guidelines/release-notes-guidelines.md) | Writing clear, accurate release notes and changelogs |

Plus guidelines on [coding rules](packages/tbd/docs/guidelines/general-coding-rules.md),
[comment quality](packages/tbd/docs/guidelines/general-comment-rules.md),
[commit conventions](packages/tbd/docs/guidelines/commit-conventions.md),
[documentation style](packages/tbd/docs/guidelines/common-doc-guidelines.md), and
[tbd sync troubleshooting](packages/tbd/docs/guidelines/tbd-sync-troubleshooting.md).

You can also add your own team’s guidelines from any URL:

```bash
tbd guidelines --add=<url> --name=my-team-rules
```

## Installation and Setup

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
npm install -g get-tbd@latest
```

### Setup

```bash
# Fresh project (--prefix is REQUIRED, a short alphabetic name used as an issue ID prefix, e.g. myapp gives issues like myapp-a1b2)
tbd setup --auto --prefix=myapp

# Joining an existing tbd project (no prefix needed, reads existing config)
tbd setup --auto

# Migrate from Beads (uses your existing beads prefix)
tbd setup --from-beads
```

> **Tip:** Run `tbd setup --auto` anytime to refresh skill files, hooks, and configs
> with the latest shortcuts, guidelines, and templates.

### Upgrading

Upgrading an existing installation is the same two commands, run by you or your agent:

```bash
npm install -g get-tbd@latest   # Upgrade the CLI
tbd setup --auto                # Refresh skills/hooks and apply any format migration
```

If the new version bumps the repository format (`tbd_format` in `.tbd/config.yml`),
setup migrates it automatically and prints a notice; **commit the resulting diff** to
publish the upgrade to your team.
Teammates still on an older tbd then see “This repository requires a newer version of
tbd” until they run the same two commands.
Issue data is never touched by an upgrade, and the migration is revertible: see
“Aborting a Format Upgrade” under Troubleshooting in the CLI manual (`tbd docs manual`).
If you have forked docs in `docs/tbd/`, `tbd sync` prints a notice when their upstream
versions moved; run `tbd docs update` to merge the changes in.

### Team Setup

`tbd` is designed for teams where one person sets up the project and others join later.

**First contributor:**
```bash
npm install -g get-tbd@latest
tbd setup --auto --prefix=proj   # Short alphabetic prefix for issue IDs
git add .tbd/ .claude/ && git commit -m "Initialize tbd"
git push
```

**Joining contributors:**
```bash
git clone <repo>
npm install -g get-tbd@latest
tbd setup --auto                    # No --prefix needed, reads existing config
```

### Claude Code Integration

`tbd setup --auto` configures SessionStart hooks that run at the beginning of each
Claude Code session:

- **`tbd prime`**: injects workflow context so the agent knows how to use `tbd`
- **`ensure-gh-cli.sh`**: installs the GitHub CLI (`gh`) if not already available

**GitHub authentication:** For `gh` to work, set these environment variables before
starting your agent session:

```
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GH_PROMPT_DISABLED=1
```

Create a [Personal Access Token](https://github.com/settings/tokens?type=beta)
(fine-grained recommended) with **Contents** and **Pull requests** read/write
permissions. For Claude Code Cloud, set these in your project’s environment variables.
For local CLI usage, add them to your shell profile (`~/.zshrc` or `~/.bashrc`). See the
[setup-github-cli shortcut](packages/tbd/docs/shortcuts/standard/setup-github-cli.md)
for details.

To disable automatic `gh` installation, pass `--no-gh-cli` during setup or set
`use_gh_cli: false` in `.tbd/config.yml` under `settings:`.

### Migrating from Beads

You can use `tbd` as a drop-in replacement for the original Beads (`bd`); it’s largely
compatible at the CLI level for core issue tracking.

```bash
tbd setup --from-beads       # Auto-detects and migrates
tbd stats                    # Verify
tbd list --all
tbd setup beads --disable    # Optionally disable beads after migration
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in `tbd`. See
[How does `tbd` compare to Beads?](#how-does-tbd-compare-to-beads) for why you might
switch.

## Commands

### Beads

```bash
tbd ready                      # Beads ready to work on (open, unblocked, unassigned)
tbd list                       # List open beads
tbd list --all                 # Include closed
tbd list --specs               # Group beads by spec
tbd show proj-a7k2             # View bead details
tbd create "Title" --type=bug  # Create bead (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close bead
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync                       # Sync with remote (auto-commits and pushes)
```

### Dependencies and Labels

```bash
tbd dep add proj-b3m9 proj-a7k2        # b3m9 depends on a7k2
tbd blocked                            # Show blocked beads
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                         # All labels in use
tbd search "authentication"            # Search beads
```

### Shortcuts, Guidelines, and Templates

`tbd` bundles three types of documentation your agent can invoke on demand:

```bash
# Shortcuts: workflow instructions
tbd shortcut --list              # List all shortcuts
tbd shortcut new-plan-spec       # Get the plan spec workflow

# Guidelines: coding rules and best practices
tbd guidelines --list            # List all guidelines
tbd guidelines typescript-rules  # Get TypeScript rules

# Templates: document scaffolds
tbd template --list              # List all templates
tbd template plan-spec           # Get a plan spec template

# Add your own from any URL
# (per-kind aliases for `tbd docs add <docref>`)
tbd guidelines --add=<url> --name=<name>
tbd shortcut --add=<url> --name=<name>
tbd template --add=<url> --name=<name>
```

### Managed Docs: Fork, Update, Extend

By default these docs are served from a hidden, gitignored cache.
You can make them yours without losing upstream improvements:

```bash
tbd docs                         # Overview of managed docs (cached, forked, local)
tbd docs list                    # Every doc with [forked]/[customized]/[local] markers
tbd docs fork --all              # Or fork by name: tbd docs fork <name> [<name>...]
tbd docs update                  # Three-way merge upstream changes into your forks
tbd docs add <url>               # Register external docs (GitHub blob URLs auto-convert)
```

Forking copies a doc into a visible, git-tracked `docs/tbd/` folder; `tbd` then serves
your copy everywhere it served the upstream one, so it’s reviewable in PRs and editable
in place. After an upgrade, `tbd docs update` merges upstream improvements into your
forked copies.

**Available shortcuts:**

| Category | Shortcut | Purpose |
| --- | --- | --- |
| **Planning** | `new-plan-spec` | Create a feature planning spec |
|  | `plan-implementation-with-beads` | Break a spec into implementation beads |
|  | `implement-beads` | Implement beads from a spec |
|  | `new-validation-plan` | Create a test/validation plan |
|  | `update-specs-status` | Review active specs and sync with tbd issues |
| **Documentation** | `new-research-brief` | Create a research document |
|  | `new-architecture-doc` | Create an architecture document |
|  | `revise-architecture-doc` | Update an architecture doc to match current code |
|  | `revise-all-architecture-docs` | Revise all current architecture documents |
| **Review** | `review-code` | Comprehensive code review (uncommitted, branch, or PR) |
|  | `review-github-pr` | Review a GitHub PR with commenting and CI checks |
|  | `review-code-typescript` | TypeScript-focused code review |
|  | `review-code-python` | Python-focused code review |
| **Git** | `precommit-process` | Pre-commit review and testing |
|  | `code-review-and-commit` | Commit with pre-commit checks |
|  | `create-or-update-pr-simple` | Basic PR creation |
|  | `create-or-update-pr-with-validation-plan` | PR with a validation plan |
|  | `merge-upstream` | Merge origin/main with conflict resolution |
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

Run `tbd shortcut --list` for the complete, current set (30+ shortcuts).

**Available guidelines:** See
[Built-in Engineering Knowledge](#built-in-engineering-knowledge) for the full list of
25+ guidelines covering TypeScript, Python, testing, TDD, and more.

**Available templates:**

| Template | Description |
| --- | --- |
| `plan-spec` | Feature planning specification |
| `research-brief` | Research document |
| `architecture-doc` | Architecture document |
| `qa-playbook` | QA and validation playbook |

### Spec-Driven Development

For non-trivial features, `tbd` supports a full spec-driven workflow:

1. **Plan**: Create a planning spec (`tbd shortcut new-plan-spec`)
2. **Break down**: Convert spec into implementation beads
   (`tbd shortcut plan-implementation-with-beads`)
3. **Implement**: Work through beads systematically (`tbd shortcut implement-beads`)
4. **Validate**: Create validation plan, run tests (`tbd shortcut new-validation-plan`)
5. **Ship**: Commit, create PR (`tbd shortcut create-or-update-pr-with-validation-plan`)

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Bead statistics
tbd doctor                   # Check for problems
tbd doctor --fix             # Auto-fix issues
```

### Agent-Friendly Flags

Every command supports these flags for automation:

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--dry-run` | Preview changes |
| `--quiet` | Minimal output |

## Documentation

```bash
tbd                          # Full orientation and workflow guidance
tbd readme                   # This file
tbd docs                     # Managed-docs overview (cached, forked, and local docs)
tbd docs show tbd-docs       # Full CLI reference (the manual; alias: tbd docs manual)
```

Or read online:
- [CLI Reference](packages/tbd/docs/tbd-docs.md): Complete command documentation
- [Design Doc](packages/tbd/docs/tbd-design.md): Technical architecture

## How It Works

`tbd` keeps two things separate from your code:

- **Beads** live on a dedicated `tbd-sync` branch.
  One Markdown file per bead means parallel creation never conflicts.
  `tbd sync` pushes changes, with no manual git operations needed.
- **Documents** (shortcuts, guidelines, templates) are cached locally in `.tbd/docs/`
  during `tbd setup --auto`. Your agent reads them on demand via `tbd shortcut`,
  `tbd guidelines`, and `tbd template`, and you can fork them into `docs/tbd/` to edit
  in place (see [Managed Docs](#managed-docs-fork-update-extend)).
- **Everything is self-documented via the CLI.** Running `tbd` shows help with quick
  command reference; `tbd prime` gives full workflow orientation.
  `tbd setup --auto` (idempotent, safe anytime) writes a skill file (SKILL.md/AGENTS.md)
  that teaches the agent all available commands, shortcuts, and guidelines.
  This means agents can inject context (specs, engineering guidelines, workflow
  instructions) at any point in a session, not just at startup.

See the [design doc](packages/tbd/docs/tbd-design.md) for details.

## FAQ

### How does `tbd` compare to Beads?

`tbd` was inspired by [Beads](https://github.com/steveyegge/beads) by Steve Yegge, and
I’m grateful for the idea; it genuinely changed how I work with agents.
If you’re not familiar with Beads, the core insight is that git-native issue tracking
raises an agent’s capacity for structured work from ~5-10 to-do items to hundreds of
beads.

`tbd` builds on that foundation with a simpler architecture: plain Markdown files
instead of JSONL, no daemon, no SQLite, no 4-way sync.
This avoids the edge cases I ran into with network filesystems (Claude Code Cloud),
merge conflicts, and multi-agent workflows.
After using `bd` for over a month, these were my biggest pain points.

If you already use Beads, `tbd setup --from-beads` migrates you to `tbd`. This imports
and sets up your `.tbd` directory and preserves the IDs of all issues.
`tbd` focuses on the durable layer of issues, specs, and knowledge (see
[Why It Works](#why-it-works) for scope); the
[design doc](packages/tbd/docs/tbd-design.md) has a detailed comparison.

### Why spec-driven development?

After months of heavy agentic coding, I’ve found that the single biggest lever for
quality is planning before you code.
A
[carefully written spec](https://github.com/jlevy/speculate/blob/main/about/lessons_in_spec_coding.md)
lets you think through what you’re building, catch design problems early, and break the
work into well-defined beads.
I now think of iterating on a spec as the hard part; writing the code is often almost
automatic once the spec is good enough.

This matters because with a good spec broken into beads, you can leave an agent running
overnight and come back to code that’s well-structured and coherent, not a pile of
disconnected changes.
`tbd` bakes in shortcuts for the full cycle: writing specs, breaking them into beads,
implementing, validating, and shipping.

### Was `tbd` built with `tbd`?

Of course! I bootstrapped with the original `bd`. It imported from `bd` and began
self-hosting its own tasks, then took over its own specs and reminds itself of its own
coding guidelines. Basically 100% of the code I now write is agent-written, planned and
tracked through specs and beads and streamlined with shortcuts.

`tbd` has dozens of active and completed plan specs, such as:
- `plan-2026-01-15-tbd-v1-implementation.md`: The original v1 design
- `plan-2026-01-20-streamlined-init-setup-design.md`: Redesigning the setup flow
- `plan-2026-01-26-configurable-doc-cache-sync.md`: Making the doc system configurable
- `plan-2026-01-28-cli-add-docs-by-url.md`: Adding `--add` for external docs

Features are broken into beads and worked through systematically, with dozens of open
beads at any time (`tbd list` shows the current set).

### Can I add my own guidelines?

Yes. `tbd` comes with 25+ bundled guidelines, but you can add your own team’s docs from
any URL and fork or replace any bundled doc; see
[Batteries included, fully yours to change](#why-it-works) and
[Managed Docs](#managed-docs-fork-update-extend).

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
