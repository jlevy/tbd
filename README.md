# tbd

**Git-native issue tracking for AI agents and humans.**

**tbd** (which stands for “To Be Done” or “TypeScript beads,” depending on your
preference) is a command-line issue tracker that stores issues as files in git.

Designed for AI coding agents and humans: simple commands, pretty console and JSON
output, installs via `npm` and works in almost any agent or sandboxed cloud environment.

tbd is inspired by by [Beads](https://github.com/steveyegge/beads) by Steve Yegge.
I love the power of and am grateful for it!
Unfortunately, after using it heavily for over a month, I found architectural issues and
glitches that were too much of a distraction to ignore.
Things like SQLite WAL errors in Claude Code Cloud, fighting with the daemon modifying
files in the active working tree, confusing sync algorithms, and merge conflicts.

tbd uses a simpler architecture with (I hope) fewer edge cases and bugs.
If you want to try it, you can import issues from Beads, preserving issue IDs.
Internally, everything is Markdown files so you can debug or migrate in the future if
you wish. See [the the design doc](docs/tbd-design.md) for a bit more.

## Why tbd?

- **Git-native:** Issues live in your repo, synced to a separate, dedicated `tbd-sync`
  branch. Your code history stays clean—no issue churn polluting your logs.
- **Agent friendly:** JSON output, non-interactive mode, simple commands that agents
  understand. Installs itself as a skill in Claude Code.
- **Markdown + YAML frontmatter:** One file per issue, human-readable and editable.
  This eliminates most merge conflicts.
- **Beads alternative:** `tbd` is largely compatible with `bd` at the CLI level.
  But has no JSONL merge conflicts in git.
  No daemon modifying your current working tree.
  No agents confused by error messages about which of several “modes” you’re running in.
  No SQLite file locking issues on network filesystems (like what is used by Claude Code
  Cloud).
- **Future extensions:** By keeping this CLI/API/file layer simple, I think we can more
  easily build more complex UI and coordination layers on top.
  (Hope to have more on this soon.)

> [!NOTE]
> I use *Beads* (capitalized) to refer to the original `bd` tool.
> In the docs and prompts I sometimes use lowercase “beads” as a generic way to refer to
> issues in `tbd` or `bd`.

## Quick Start

```bash
# Install
npm install -g tbd-cli

# Initialize in your repo
cd my-project
tbd init  # New project
tbd import --from-beads  # Migrate issues from an existing Beads setup

# Create issues
tbd create "API returns 500 on malformed input" --type=bug --priority=P1
tbd create "Add rate limiting to /api/upload" --type=feature
tbd list --pretty  # View issues

# Find and claim work
tbd ready                                    # What's available?
tbd update proj-a7k2 --status=in_progress    # Claim it

# Complete and sync
tbd closing  # Get a reminder of the closing protocol (this is also in the skill docs)
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

## Installation

**Requirements:**
- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
# Check your Git version
git --version  # Should be 2.42.0 or higher.
See "Troubleshooting" below if not.

# Global install (recommended)
npm install -g tbd-cli

# Or run without installing
npx tbd-cli <command>
```

## Commands

### Core Workflow

```bash
tbd ready                      # Issues ready to work on (open, unblocked, unassigned)
tbd list                       # List open issues
tbd list --all                 # Include closed
tbd show proj-a7k2             # View issue details
tbd create "Title" --type=bug  # Create issue (bug/feature/task/epic/chore)
tbd update proj-a7k2 --status=in_progress
tbd close proj-a7k2            # Close issue
tbd sync                       # Sync with remote (auto-commits and pushes issues)
```

### Dependencies

```bash
tbd dep add proj-b3m9 proj-a7k2  # b3m9 is blocked by a7k2
tbd blocked                      # Show blocked issues
```

### Labels

```bash
tbd label add proj-a7k2 urgent backend
tbd label remove proj-a7k2 urgent
tbd label list                   # All labels in use
```

### Search

```bash
tbd search "authentication"
tbd search "TODO" --status=open
```

### Maintenance

```bash
tbd status                   # Repository status (works before init too)
tbd stats                    # Issue statistics
tbd doctor                   # Check for problems
tbd doctor --fix             # Auto-fix issues
```

## For AI Agents

tbd is designed for AI coding agents.

### Agent Workflow Loop

```bash
tbd ready --json                          # Find work
tbd update proj-xxxx --status=in_progress # Claim (advisory)
# ... do the work ...
tbd close proj-xxxx --reason="Done"       # Complete
tbd sync                                  # Push
```

### Agent-Friendly Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--non-interactive` | Fail if input required |
| `--yes` | Auto-confirm prompts |
| `--dry-run` | Preview changes |
| `--quiet` | Minimal output |

### Claude Code Integration

```bash
tbd setup claude             # Install hooks (one-time)
```

This runs `tbd prime` at session start, injecting workflow context so the agent
remembers to use tbd.

### Actor Identity

```bash
TBD_ACTOR=claude-agent tbd create "Fix bug" --type=bug
```

Resolution order: `--actor` flag → `TBD_ACTOR` env → git user.email → system username.

## Documentation

```bash
tbd readme                   # This file
tbd docs                     # Full CLI reference
```

Or read online:
- [CLI Reference](docs/tbd-docs.md) — Complete command documentation
- [Design Doc](docs/project/architecture/current/tbd-design-spec.md) — Technical
  architecture

## Migration from Beads

```bash
# One-step migration (auto-initializes tbd, uses beads prefix)
tbd import --from-beads

# Verify
tbd stats
tbd list --all
```

Issue IDs are preserved: `proj-123` in beads becomes `proj-123` in tbd.
The prefix from your beads configuration is automatically used.

## How It Works

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code:

```
.tbd/
├── config.yml                    # Configuration (tracked on main)
└── data-sync-worktree/           # Hidden worktree (gitignored)
    └── .tbd/data-sync/
        ├── issues/               # One .md file per issue
        ├── mappings/ids.yml      # Short ID → ULID mapping
        └── attic/                # Conflict archive (no data loss)
```

**Why a separate branch?**
- No noisy issue commits in your code history
- No conflicts across main or feature branches
- Issues shared across all branches

**Automatic sync**: Unlike Beads (where you manually `git add`/`commit`/`push` the JSONL
file), `tbd sync` handles all git operations automatically.
One command commits and pushes issues to the sync branch.
Your normal `git push` is only for code changes.

**Conflict handling:**
- Separate issues never conflict since they are separate files.
- If two agents modify the same issue at the same time, does field-level merge
  (last-write-wins for scalars, union for arrays)
- In that case lost values preserved in attic—no data loss ever

Issues have a short display ID like `proj-a7k2` (where `proj` is your project’s prefix)
but these map to unique ULID-based internal IDs for reliable sorting and storage.

## Issue File Format

You usually don’t need to worry about where issues are stored, but it may be comforting
to know that internally it’s very simple and transparent.
Every issue is a Markdown file with YAML frontmatter, stored on the `tbd-sync` branch.

```markdown
---
id: is-01hx5zzkbkactav9wevgemmvrz
kind: bug
title: API returns 500 on malformed input
status: open
priority: 1
labels: [backend, urgent]
created_at: 2025-01-15T10:30:00Z
updated_at: 2025-01-15T10:30:00Z
---

The /api/users endpoint crashes when given invalid JSON.
```

## Troubleshooting

### Git version too old

tbd requires Git 2.42+ for orphan worktree support (`git worktree add --orphan`).

**Check your version:**
```bash
git --version
```

**Upgrade:** See [git-scm.com/downloads](https://git-scm.com/downloads) for
platform-specific instructions.

After upgrading, verify with `git --version` and try `tbd init` again.

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.

## License

MIT
