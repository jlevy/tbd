# tbd

Git-native issue tracking for AI agents and humans.

**tbd** is a command-line issue tracker that stores issues as files in git.
No external services, no databases—just Markdown files you can read, search, and version
control.

Designed for AI coding agents: simple commands, JSON output, works in sandboxed cloud
environments.

**If you’re using [Beads](https://github.com/steveyegge/beads)**: tbd is a simpler
alternative with an easier mental model.
No daemon, no SQLite—just files and git.
See [Migration from Beads](#migration-from-beads) to switch.

## Why tbd?

- **Git-native**: Issues live in your repo as files.
  No external services or databases.
- **AI-agent friendly**: JSON output, non-interactive mode, simple commands that agents
  understand.
- **File-per-issue**: Parallel creation without merge conflicts.
  Each issue is one file.
- **No daemon**: Works everywhere—CI, cloud sandboxes, restricted environments.
- **Simple architecture**: Two locations (files + sync branch) instead of four.
  No SQLite, no file locking, no mystery state to debug.
- **Beads compatible**: Drop-in replacement for
  [Beads](https://github.com/steveyegge/beads), preserves issue IDs.

## Quick Start

```bash
# Install
npm install -g tbd-cli

# Initialize in your repo
cd my-project
tbd init

# Create issues
tbd create "API returns 500 on malformed input" --type=bug --priority=1
tbd create "Add rate limiting to /api/upload" --type=feature

# Find and claim work
tbd ready                                  # What's available?
tbd update bd-a7k2 --status=in_progress    # Claim it

# Complete and sync
tbd close bd-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

## Installation

Requires Node.js 20+.

```bash
# Global install (recommended)
npm install -g tbd-cli

# Or run without installing
npx tbd-cli <command>
```

## Commands

### Core Workflow

```bash
tbd ready                    # Issues ready to work on (open, unblocked, unassigned)
tbd list                     # List open issues
tbd list --all               # Include closed
tbd show bd-a7k2             # View issue details
tbd create "Title" --type=bug    # Create issue (bug/feature/task/epic/chore)
tbd update bd-a7k2 --status=in_progress
tbd close bd-a7k2            # Close issue
tbd sync                     # Sync with remote
```

### Dependencies

```bash
tbd depends add bd-b3m9 bd-a7k2  # b3m9 is blocked by a7k2
tbd blocked                      # Show blocked issues
```

### Labels

```bash
tbd label add bd-a7k2 urgent backend
tbd label remove bd-a7k2 urgent
tbd label list               # All labels in use
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
tbd ready --json                        # Find work
tbd update bd-xxxx --status=in_progress # Claim (advisory)
# ... do the work ...
tbd close bd-xxxx --reason="Done"       # Complete
tbd sync                                # Push
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
- [Design Doc](docs/project/architecture/current/tbd-design-v3.md) — Technical
  architecture

## Migration from Beads

```bash
# One-step migration (auto-initializes tbd)
tbd import --from-beads

# Verify
tbd stats
tbd list --all

# Optional: keep the same ID prefix
tbd config set display.id_prefix bd
```

Issue IDs are preserved: `tbd-100` becomes `bd-100`.

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
- No merge conflicts in feature branches
- Issues shared across all branches
- Clean code history

**Conflict handling:**
- Automatic field-level merge (last-write-wins for scalars, union for arrays)
- Lost values preserved in attic—no data loss ever

## Issue File Format

Each issue is a Markdown file with YAML frontmatter:

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

## Working Notes

Found the issue—missing input validation in userController.ts.
```

## Priority Scale

| Value | Meaning |
| --- | --- |
| 0 (P0) | Critical—drop everything |
| 1 (P1) | High—this sprint |
| 2 (P2) | Medium—soon (default) |
| 3 (P3) | Low—backlog |
| 4 (P4) | Lowest—maybe/someday |

## License

MIT

## Contributing

See [docs/development.md](docs/development.md) for build and test instructions.
