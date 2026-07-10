# tbd CLI Documentation

Git-native issue tracking for AI agents and humans.

> [!NOTE]
> This is the tbd reference (`tbd docs`). See the tbd readme (`tbd readme`) for a quick
> intro or the design doc (`tbd design`) for more technical details.

## Key Design Features

### Issues stored in one place

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code:

```
.tbd/
└── config.yml                    # Configuration (tracked on main)

$GIT_COMMON_DIR/tbd/
└── data-sync-worktree/           # Hidden worktree shared by linked checkouts
    └── .tbd/data-sync/
        ├── issues/               # One .md file per issue
        ├── mappings/ids.yml      # Short ID → ULID mapping
        └── attic/                # Conflict archive (no data loss)
```

Why a separate branch?

- No noisy issue commits in your code history
- No conflicts across main or feature branches
- Issues shared across all branches

## File Format

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

### Automatic git push

Unlike Beads (where you manually `git add`/`commit`/`push` the JSONL file), `tbd sync`
handles all git operations automatically.
One command commits and pushes issues to the sync branch.
Your normal `git push` is only for code changes.

### Conflict handling

- Separate issues never conflict since they are separate files.
- If two agents modify the same issue at the same time, does field-level merge
  (last-write-wins for scalars, union for arrays)
- In that case lost values preserved in attic—no data loss ever

### Unique internal ids

Issues have a short display ID like `proj-a7k2` (where `proj` is your project’s prefix)
but these map to unique ULID-based internal IDs for reliable sorting and storage.

## Requirements and Installation

**Requirements:**

- Node.js 20+
- Git 2.42+ (for orphan worktree support)

```bash
# Check your Git version
git --version  # Should be 2.42.0 or higher

# Global install (recommended)
npm install -g get-tbd@latest

# Or run without installing
npx get-tbd@latest <command>
```

tbd requires Git 2.42+ for orphan worktree support (`git worktree add --orphan`). See
[git-scm.com/downloads](https://git-scm.com/downloads) for platform-specific
instructions.

## Quick Reference

### Find and claim work

```bash
tbd ready                                  # What's available to work on?
tbd show proj-1847                           # Review the issue details
tbd update proj-1847 --status=in_progress    # Claim it
```

### Complete work

```bash
tbd close proj-1847 --reason="Fixed in auth.ts, added retry logic"
tbd close proj-1847 proj-1848 --reason="Both fixed"   # Several at once — never loop
tbd sync                                   # Push to remote
```

### Create issues

```bash
tbd create "API returns 500 on malformed input" --type=bug --priority=P1
tbd create "Add rate limiting to /api/upload" --type=feature
tbd create "Refactor database connection pooling" --type=task --priority=P3

# With description and labels
tbd create "Users can't reset password" --type=bug --priority=P0 \
  --description="Reset emails not sending. Affects all users since deploy." \
  --label=urgent --label=auth
```

### Track dependencies

```bash
tbd create "Write integration tests" --type=task
tbd dep add proj-1850 proj-1847           # 1850 depends on 1847 (can't test until 1847 done)
tbd blocked                                # See what's waiting
```

### Daily workflow

```bash
tbd sync                    # Start of session
tbd ready                   # Find work
# ... do the work ...
tbd close proj-xxxx           # Mark complete
tbd sync                    # End of session
```

### Issue lifecycle

```
open → in_progress → closed
  ↓
blocked/deferred
```

## Commands

### setup

The recommended way to initialize tbd and configure agent integrations.

```bash
tbd setup --auto                  # Full setup with auto-detection (recommended)
tbd setup --from-beads            # Migrate from existing Beads setup
```

Options:
- `--auto` - Automatic mode: auto-detect prefix, migrate beads if present
- `--from-beads` - Migrate issues from existing Beads setup
- `--prefix <name>` - Override auto-detected prefix

Subcommands for specific integrations:
```bash
tbd setup claude                  # Install Claude Code hooks
tbd setup codex                   # Install Codex AGENTS.md (also used by Cursor)
tbd setup beads --disable         # Disable coexisting Beads
```

### init

Surgical initialization: creates `.tbd/` directory only (no integrations).

```bash
tbd init --prefix=proj             # Initialize with prefix (required)
tbd init --prefix=myapp --sync-branch=my-sync  # Custom sync branch name
tbd init --prefix=tk --remote=upstream         # Use different remote
```

Options:
- `--prefix <name>` - **Required.** Project prefix for display IDs (e.g., “proj”,
  “myapp”)
- `--sync-branch <name>` - Sync branch name (default: tbd-sync)
- `--remote <name>` - Remote name (default: origin)

Note: For most users, `tbd setup --auto` is recommended instead.
It auto-detects the prefix and configures agent integrations.

### create

Create a new issue.

```bash
tbd create "Implement user auth"                                   # Basic task
tbd create "Fix crash on login" --type=bug --priority=P0            # Critical bug
tbd create "Dark mode support" --type=feature                      # Feature request
tbd create "Refactor database layer" --type=chore                  # Technical debt
tbd create "Q1 Goals" --type=epic                                  # Epic for grouping

# Link to a spec document
tbd create "Add schema fields" --spec docs/project/specs/active/plan-2026-01-26-feature.md

# With description
tbd create "Add rate limiting" --description="Prevent API abuse with 100 req/min limit"

# With labels
tbd create "Fix mobile layout" --label=frontend --label=urgent

# With assignee and due date
tbd create "Security audit" --assignee=alice --due=2025-02-01

# From YAML file
tbd create --from-file=issue.yml
```

Options:
- `--type <type>` - Issue type: bug, feature, task, epic, chore (default: task)
- `--priority <0-4>` - Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog
  (default: 2)
- `--description <text>` - Issue description
- `--file <path>` - Read description from file
- `--assignee <name>` - Assign to someone
- `--due <date>` - Due date (ISO8601 format)
- `--defer <date>` - Defer until date
- `--parent <id>` - Parent issue ID (for sub-issues).
  If the parent has a `spec_path` and `--spec` is not provided, the child inherits the
  parent’s `spec_path`.
- `--spec <path>` - Link to spec document (validated, normalized to project root)
- `--label <label>` - Add label (can repeat)
- `--from-file <path>` - Create from YAML+Markdown file

### list

List issues with filtering and sorting.

```bash
tbd list                                    # Open issues, sorted by priority
tbd list --all                              # Include closed issues
tbd list --status=in_progress               # Currently being worked on
tbd list --status=blocked                   # Blocked issues
tbd list --type=bug                         # Only bugs
tbd list --priority=P0                       # Critical priority only
tbd list --assignee=alice                   # Assigned to alice
tbd list --label=urgent                     # With 'urgent' label
tbd list --label=backend --label=api        # Multiple labels (AND)
tbd list --parent=proj-x1y2                   # Children of an epic
tbd list --spec=plan-2026-01-26-feature.md  # Linked to spec (gradual matching)
tbd list --sort=created                     # Sort by creation date
tbd list --sort=updated                     # Sort by last update
tbd list --limit=10                         # Limit results
tbd list --count                            # Just show count
tbd list --long                             # Show descriptions
tbd list --pretty                           # Tree view with parent-child hierarchy
tbd list --pretty --long                    # Tree view with descriptions

# JSON output for scripting
tbd list --json | jq '.[].title'
```

Options:
- `--status <status>` - Filter: open, in_progress, blocked, deferred, closed
- `--all` - Include closed issues
- `--type <type>` - Filter: bug, feature, task, epic, chore
- `--priority <0-4>` - Filter by priority
- `--assignee <name>` - Filter by assignee
- `--label <label>` - Filter by label (repeatable, AND logic)
- `--parent <id>` - List children of parent issue
- `--spec <path>` - Filter by spec path (supports gradual matching: filename, partial
  path, or full path)
- `--deferred` - Show only deferred issues
- `--defer-before <date>` - Deferred before date
- `--sort <field>` - Sort by: priority, created, updated (default: priority).
  Tiebreaker: internal ULID (chronological creation order)
- `--limit <n>` - Limit number of results
- `--count` - Output only the count of matching issues
- `--long` - Show issue descriptions on a second line
- `--pretty` - Show tree view with parent-child relationships

### show

Display detailed information about an issue.

```bash
tbd show proj-a7k2                            # YAML output
tbd show proj-a7k2 --json                     # JSON output
tbd show proj-a7k2 --no-parent                # Suppress parent context
```

Output includes all fields: title, description, status, priority, labels, dependencies,
timestamps, and working notes.
The raw `dependencies` field is a storage-format edge list: an entry with `type: blocks`
means the shown issue blocks the target.
When dependency directions exist, text output adds YAML comments above `dependencies`
with human-facing `Blocks:` and `Blocked by:` sections using display IDs.
For dependency-direction checks, prefer `tbd dep list <id>`. For child issues, the
parent’s details (ID, title, status, priority, description) are automatically displayed
below the child for context.

### update

Modify an existing issue.

```bash
tbd update proj-a7k2 --status=in_progress    # Start working
tbd update proj-a7k2 --status=blocked        # Mark as blocked
tbd update proj-a7k2 --priority=P0            # Escalate priority
tbd update proj-a7k2 --assignee=bob          # Reassign
tbd update proj-a7k2 --description="New description"
tbd update proj-a7k2 --notes="Found root cause in auth.ts"
tbd update proj-a7k2 --notes-file=notes.md   # Notes from file
tbd update proj-a7k2 --due=2025-03-01        # Set due date
tbd update proj-a7k2 --defer=2025-02-15      # Defer until later
tbd update proj-a7k2 --add-label=blocked     # Add label
tbd update proj-a7k2 --remove-label=urgent   # Remove label
tbd update proj-a7k2 --parent=proj-x1y2        # Set parent epic
tbd update proj-a7k2 --spec=docs/spec.md     # Link to spec
tbd update proj-a7k2 --spec=""               # Clear spec link

# Update from YAML file
tbd update proj-a7k2 --from-file=updated.yml
```

Options:
- `--from-file <path>` - Update all fields from YAML+Markdown file
- `--status <status>` - Set status
- `--type <type>` - Set type
- `--priority <0-4>` - Set priority
- `--assignee <name>` - Set assignee
- `--description <text>` - Set description
- `--notes <text>` - Set working notes
- `--notes-file <path>` - Set notes from file
- `--due <date>` - Set due date
- `--defer <date>` - Set deferred until date
- `--add-label <label>` - Add label
- `--remove-label <label>` - Remove label
- `--parent <id>` - Set parent issue.
  If the new parent has a `spec_path` and `--spec` is not also provided, the child
  inherits the parent’s `spec_path` (only if the child currently has no `spec_path`).
- `--spec <path>` - Set or clear spec path (empty string clears; validated and
  normalized). When updating a parent issue’s spec, the new value propagates to children
  whose `spec_path` was null or matched the old value.
- `--ignore-missing` - Skip unknown IDs instead of failing the batch

**Multiple IDs:** `tbd update A B C --priority 1 --add-label done` applies the same
field updates to every issue under one lock.
Per-ID-only flags (`--title`, `--description`, `--notes`/`--notes-file`) are rejected
with two or more IDs, and `--status` is rejected in bulk — use `tbd close`/`tbd reopen`
for lifecycle changes.
`--description` and `--notes` also accept `-` to read stdin.

### close

Close one or more completed issues.
A single ID keeps the classic one-line output; two or more run as a bulk operation — see
**Bulk operations and the output contract** below.

```bash
tbd close proj-a7k2                           # Close issue
tbd close proj-a7k2 --reason="Fixed in PR #42"
```

Options:
- `--reason <text>` - Reason for closing (`-` reads stdin)
- `--reason-file <path>` - Read the close reason from a file (`-` reads stdin)
- `--ignore-missing` - Skip unknown IDs instead of failing the batch

### reopen

Reopen one or more closed issues — see **Bulk operations and the output contract**
below.

```bash
tbd reopen proj-a7k2                          # Reopen issue
tbd reopen proj-a7k2 --reason="Bug reappeared"
```

Options:
- `--reason <text>` - Reason for reopening (`-` reads stdin)
- `--reason-file <path>` - Read the reopen reason from a file (`-` reads stdin)
- `--ignore-missing` - Skip unknown IDs instead of failing the batch

### Bulk operations and the output contract

`close`, `reopen`, and `update` accept multiple IDs and process them together under a
single lock. The output is designed so agents never need `2>&1 | tail -1`:

- **One summary line** on success, e.g. `✓ Closed 3, skipped 1 (already closed): …`,
  followed by a visible `• Unsynced changes — run tbd sync to publish.` hint.

- **Fail-closed validation**: if any ID is unknown (or its issue file cannot be read)
  the whole batch aborts before writing anything and lists the bad IDs.
  Add `--ignore-missing` to downgrade unknown IDs to skips instead.
  Duplicate IDs in one call are processed once.

- **Single-ID behavior is unchanged**: one ID behaves exactly as before (idempotent
  close; reopening an already-open issue still errors).
  The “already-done is a skip” rule applies only to multi-ID batches.

- **`--quiet`** is silent on success and also suppresses incidental notices (worktree
  auto-heal, config migration), so output stays clean.

- **`--json`** replaces the summary line with a machine contract:

  ```json
  {
    "results": [{ "id": "proj-a7k2", "action": "closed", "ok": true }],
    "summary": { "changed": 1, "skipped": 0, "missing": 0, "failed": 0, "total": 1 },
    "sync": { "pending": true, "hint": "Run `tbd sync` to publish." }
  }
  ```

  A write that fails mid-batch is reported as `{ "action": "failed", "ok": false }` with
  the error in `skippedReason`; the command still emits the full summary (so you can see
  exactly what was and was not written) and then exits non-zero.

**Free-text bodies without quoting hazards.** Reasons, descriptions, and notes accept
the text inline, from a file (`--reason-file`, `-f`/`--file`, `--notes-file`), or from
stdin with the `-` convention (`--reason=-`, `-d -`, `--notes=-`), so shell-sensitive
text (`$`, backticks, quotes) round-trips verbatim instead of being mangled by the
shell.

**Sync is stage-then-publish.** Every write lands in the local `tbd-sync` worktree
immediately; nothing reaches the remote until you run `tbd sync`. There is no
per-command auto-sync, and the legacy no-op `--no-sync` flag has been removed.

### ready

List issues ready to work on (open, unblocked, unassigned).

```bash
tbd ready                                   # All ready issues
tbd ready --type=bug                        # Ready bugs
tbd ready --limit=5                         # Top 5 ready issues
tbd ready --long                            # Show descriptions
```

Options:
- `--type <type>` - Filter by type
- `--limit <n>` - Limit results
- `--long` - Show issue descriptions

### blocked

List issues that are blocked by dependencies.

```bash
tbd blocked                                 # All blocked issues
tbd blocked --limit=10                      # Limit results
tbd blocked --long                          # Show descriptions
```

Options:
- `--limit <n>` - Limit results
- `--long` - Show issue descriptions

### stale

List issues not updated recently.

```bash
tbd stale                                   # Not updated in 7 days
tbd stale --days=30                         # Not updated in 30 days
tbd stale --status=open                     # Only open stale issues
tbd stale --limit=20                        # Limit results
```

Options:
- `--days <n>` - Days since last update (default: 7)
- `--status <status>` - Filter by status (default: open, in_progress)
- `--limit <n>` - Limit results

### label

Manage issue labels.

```bash
tbd label add proj-a7k2 urgent               # Add single label
tbd label add proj-a7k2 backend api          # Add multiple labels
tbd label remove proj-a7k2 urgent            # Remove label
tbd label list                             # List all labels in use
```

Subcommands:
- `add <id> <labels...>` - Add labels to an issue
- `remove <id> <labels...>` - Remove labels from an issue
- `list` - List all labels currently in use

### dep

Manage issue dependencies.

**Semantics:** `tbd dep add A B` means “A depends on B” (B must complete before A can
start).

```bash
# proj-b3m9 depends on proj-a7k2 (a7k2 must be done first)
tbd dep add proj-b3m9 proj-a7k2
# Output: ✓ proj-b3m9 now depends on proj-a7k2

# Remove dependency
tbd dep remove proj-b3m9 proj-a7k2

# List what blocks/is blocked by an issue
tbd dep list proj-a7k2
# Output shows "Blocks:" and "Blocked by:" sections
```

Subcommands:
- `add <issue> <depends-on>` - Issue depends on depends-on (depends-on blocks issue)
- `remove <issue> <depends-on>` - Remove dependency
- `list <id>` - List dependencies for an issue (what it blocks and what blocks it)

Use `tbd dep list <id>` when checking dependency direction.
The raw `dependencies` frontmatter in `tbd show` stores graph edges where `type: blocks`
means the shown issue blocks the target.

### sync

Synchronize issues with remote repository.

```bash
tbd sync                                    # Full sync (pull + push)
tbd sync --status                           # Check sync status
tbd sync --pull                             # Pull only
tbd sync --push                             # Push only
tbd sync --force                            # Force sync (overwrite conflicts)
```

Options:
- `--push` - Push local changes only
- `--pull` - Pull remote changes only
- `--status` - Show sync status without syncing
- `--force` - Force sync, overwriting conflicts

### search

Search issues by text content.

```bash
tbd search "login"                          # Search all fields
tbd search "auth" --field=title             # Search only titles
tbd search "TODO" --field=notes             # Search working notes
tbd search "api" --status=open              # Filter by status
tbd search "bug" --limit=10                 # Limit results
tbd search "Error" --case-sensitive         # Case-sensitive search
```

Options:
- `--status <status>` - Filter by status
- `--field <field>` - Search specific field: title, description, notes, labels
- `--limit <n>` - Limit results
- `--no-refresh` - Skip worktree refresh
- `--case-sensitive` - Case-sensitive search

### stats

Show repository statistics.

```bash
tbd stats                                   # Show statistics
tbd stats --json                            # JSON output
```

Displays: issue counts by status, type, priority, and label.

### doctor

Diagnose and repair repository issues.

```bash
tbd doctor                                  # Check for problems
tbd doctor --fix                            # Attempt to fix issues
```

Options:
- `--fix` - Attempt to automatically fix detected issues

### config

Manage tbd configuration.

```bash
tbd config show                             # Show all config
tbd config get display.id_prefix            # Get specific value
tbd config set display.id_prefix "tk"       # Set value
```

Subcommands:
- `show` - Show all configuration
- `get <key>` - Get a configuration value
- `set <key> <value>` - Set a configuration value

Common config keys:
- `display.id_prefix` - ID prefix (required, set during init or import)
- `sync.branch` - Sync branch name
- `sync.remote` - Remote name

### attic

Manage conflict archive.
When sync conflicts occur, the losing values are preserved in the attic for recovery.

```bash
tbd attic list                              # List all attic entries
tbd attic list proj-a7k2                      # Entries for specific issue
tbd attic show proj-a7k2 2025-01-15T10:30:00Z # Show specific entry
tbd attic restore proj-a7k2 2025-01-15T10:30:00Z # Restore from attic
```

Subcommands:
- `list [id]` - List attic entries (optionally for specific issue)
- `show <id> <timestamp>` - Show attic entry details
- `restore <id> <timestamp>` - Restore a value from the attic

### import

Import issues from JSONL file.

```bash
tbd import issues.jsonl                     # Import from JSONL file
tbd import issues.jsonl --merge             # Merge with existing
tbd import --validate                       # Validate existing import
tbd import issues.jsonl --verbose           # Show detailed progress
```

Options:
- `--merge` - Merge with existing issues instead of skipping duplicates
- `--verbose` - Show detailed import progress

> **Note:** `tbd import --from-beads` is deprecated.
> Use `tbd setup --auto` or `tbd setup --from-beads` instead for migrating from Beads.

- `--validate` - Validate existing import against Beads source

### beads

Beads migration utilities.

```bash
tbd setup beads                             # Show usage
tbd setup beads --disable                   # Preview what will be moved
tbd setup beads --disable --confirm         # Actually disable Beads
```

The `--disable` option safely moves all Beads files to `.beads-disabled/`:
- `.beads/` → `.beads-disabled/beads/`
- `.beads-hooks/` → `.beads-disabled/beads-hooks/`
- `.cursor/rules/beads.mdc` → `.beads-disabled/cursor-rules-beads.mdc`
- Removes `bd` hooks from `.claude/settings.local.json` (with backup)
- Removes Beads section from `AGENTS.md` (with backup)

This preserves all data for potential rollback.
To restore Beads, move files back from `.beads-disabled/`.

### status

Show repository status.
Works even when tbd is not initialized.

```bash
tbd status                                  # Show repo status
tbd status --json                           # JSON output
```

Displays: initialization state, sync status, issue counts, detected integrations.

When not initialized, detects Beads and suggests migration:
```
Not a tbd repository.

Detected:
  ✓ Git repository (main branch)
  ✓ Beads repository (.beads/ with 142 issues)

To get started:
  tbd setup --auto          # Full setup with auto-detection
  tbd init --prefix=X       # Surgical init only
```

### prime

Output workflow context for AI agents.
Called automatically by Claude Code hooks.

```bash
tbd prime                                   # Output workflow context
tbd prime --export                          # Output default (ignores PRIME.md)
```

Behavior:
- Silent exit (code 0) if not in a tbd project
- Custom output: create `.tbd/PRIME.md` to override default content

### setup (subcommands)

Configure specific editor and agent integrations.

```bash
tbd setup claude                            # Install Claude Code hooks
tbd setup claude --check                    # Verify installation status
tbd setup claude --remove                   # Remove tbd hooks

tbd setup codex                             # Create/update AGENTS.md
tbd setup codex --check                     # Verify AGENTS.md
tbd setup codex --remove                    # Remove tbd section from AGENTS.md

tbd setup auto                              # Auto-detect and configure all integrations
tbd setup beads --disable                   # Disable Beads (for migration)
```

#### setup auto

The `tbd setup --auto` command (or `tbd setup auto`) detects which coding agents are
available and configures integrations automatically:

- **Claude Code**: Checks for `~/.claude/` directory, installs SessionStart hooks
- **Codex/AGENTS.md**: Checks for `AGENTS.md`, adds tbd integration section (also used
  by Cursor v1.6+)

This is the recommended way to set up tbd:

```bash
tbd setup --auto                            # Full setup: init + integrations
```

For already-configured integrations, `setup --auto` reports them as “Already configured”
and skips reinstallation.

### Documentation Commands

Managed docs (the `tbd docs` group):

```bash
tbd docs                                    # Status overview of managed docs
tbd docs list                               # All docs across kinds, with state markers
tbd docs show <name>                        # Read any doc by name (kind-agnostic)
tbd docs show tbd-docs                      # The CLI manual (alias: tbd docs manual)
tbd docs show tbd-docs --sections           # List the manual's sections
tbd docs show tbd-docs --section <name>     # Read one manual section
tbd docs sync                               # Refresh the gitignored docs cache
tbd docs fork / unfork / update / diff / status   # Forked docs (see below)
```

Other built-in viewers:

```bash
tbd readme                                  # Display README (same as GitHub landing page)
tbd design                                  # Display design documentation
tbd design --list                           # List design doc sections
tbd closing                                 # Display session closing protocol reminder
```

Shortcuts, guidelines, and templates:

```bash
tbd shortcut --list                         # List all shortcuts
tbd shortcut <name>                         # Display a shortcut
tbd guidelines --list                       # List all guidelines
tbd guidelines <name>                       # Display a guideline
tbd template --list                         # List all templates
tbd template <name>                         # Display a template
```

Add external docs by URL:

```bash
tbd guidelines --add=<url> --name=<name>    # Add a guideline from URL
tbd shortcut --add=<url> --name=<name>      # Add a shortcut from URL
tbd template --add=<url> --name=<name>      # Add a template from URL
```

Options:
- `--add <url>` - URL to fetch the document from (GitHub blob URLs auto-converted to
  raw)
- `--name <name>` - Name for the added document (required with `--add`)

GitHub blob URLs are automatically converted to raw.githubusercontent.com URLs.
On HTTP 403, fetching falls back to `gh api` for authenticated access.
User-added shortcuts go to `shortcuts/custom/` (separate from bundled
`shortcuts/standard/`).

### Managing Docs: Two Modes

Every managed doc is served through one search path; where the file lives is a per-doc
choice between two modes that serve identical content:

- **Hidden cache (the default).** Docs live in the gitignored `.tbd/docs/` cache: always
  active, zero repo footprint, refreshed by `tbd docs sync` (and by setup).
- **Forked.** `tbd docs fork <name>` (or `--all`) copies a doc into `docs/tbd/`, tracked
  in git: visible on GitHub, reviewable in PRs, and editable; your copy shadows the
  cache everywhere the upstream one was served.
  `tbd docs unfork` returns to the cache; `tbd docs update` three-way merges upstream
  changes into your copy after an upgrade.

Forking changes nothing about how docs work.
It only makes them explicit and editable.
Four update surfaces stay deliberately separate:

| Command | Scope | Touches | Modifies tracked files? |
| --- | --- | --- | --- |
| `tbd sync` | project data (issues/beads) | sync worktree + `tbd-sync` branch; also refreshes the doc cache and *reports* fork drift | never |
| `tbd setup --auto` | installation + integrations | skills, hooks, settings, `AGENTS.md`; invokes a docs-cache sync | only generated integration files |
| `tbd docs sync` | doc cache | gitignored `.tbd/docs/` only | never |
| `tbd docs update` | your forked docs | fork dir + bases + manifest (offline, against the cache) | **yes, the only doc command that does** |

Disambiguation worth stating once: `tbd update <id>` is an issue operation,
`tbd docs update` a doc operation; the noun scope always disambiguates.

### Forked Docs in Your Repo (docs/tbd/)

`tbd docs fork` copies managed docs into `docs/tbd/`, laid out **by kind, flat within
each kind**, with a generated `README.md` index (regenerated on every
fork/unfork/update):

```
docs/tbd/
├── README.md        # generated index — what this folder is, one line per doc
├── guidelines/<name>.md
├── shortcuts/<name>.md
└── templates/<name>.md
```

Two rules make everything below predictable: **names are identity** (a doc is
`<kind>/<name>.md`; nested subfolders are not scanned), and **tracking is derived, not
stored** (the canonical model (copies, invariants, flows) is `tbd-design.md` §2.9; this
table is its user-facing summary); every doc’s state is recomputed from content hashes
(your file vs its recorded base vs current upstream), so no git operation can
desynchronize tbd from the folder.
Whatever you or your agent do to these files, `tbd docs status` gives a defined answer:

| You (or your agent)… | State | What happens / what to do |
| --- | --- | --- |
| Edit a forked file | `customized` | Served as-is; `tbd docs update` three-way merges upstream changes in |
| Delete a forked file | `missing` | Serving falls back to upstream; restore with `tbd docs fork <name> --force` or finalize with `tbd docs unfork <name>` |
| Rename a forked file | `missing` + `local` | A rename is delete + add: finalize the old name (`unfork`), keep the new file as `local` |
| Add a new `.md` file | `local` | Served with top precedence; nothing to update or unfork (no upstream) |
| Move a file into a subfolder | invisible | Subfolders are not scanned; keep files at `<kind>/<name>.md` |
| Delete `.tbd/doc-forks/` (the manifest) | all `local` | Files keep being served; re-fork with `--force` to re-establish update tracking (overwrites with upstream; re-apply edits after) |
| Commit / pull / merge / revert any of it | recomputed | States derive from content, so collaborators see the same answers from the same files |

Awareness without surprise mutations: `tbd sync` prints a one-line notice when forked
docs are stale, conflicted, or missing, and `tbd docs status` shows the full picture,
but only the explicit `tbd docs update` ever modifies tracked files.

### uninstall

Remove tbd from a repository.

```bash
tbd uninstall --confirm                     # Remove tbd (requires --confirm)
tbd uninstall --confirm --keep-branch       # Keep local sync branch
tbd uninstall --confirm --remove-remote     # Also remove remote sync branch
```

Options:
- `--confirm` - Required to proceed with removal
- `--keep-branch` - Keep the local sync branch
- `--remove-remote` - Also remove the remote sync branch

## Global Options

These options work with any command:

```bash
tbd list --json                             # JSON output
tbd list --quiet                            # Suppress non-essential output
tbd list --verbose                          # Enable verbose output
tbd create "Test" --dry-run                 # Show what would happen
tbd list --debug                            # Show internal IDs
tbd list --color=never                      # Disable colors
```

Options:
- `--version` - Show version number
- `--dry-run` - Show what would be done without making changes
- `--verbose` - Enable verbose output
- `--quiet` - Suppress non-essential output
- `--json` - Output as JSON
- `--color <when>` - Colorize output: auto, always, never
- `--debug` - Show internal IDs alongside display IDs

## For AI Agents

tbd is designed for AI coding agents.
This section covers agent-specific patterns.

### Agent Workflow Loop

```bash
tbd ready --json                            # Find available work
tbd update proj-xxxx --status=in_progress     # Claim it (advisory)
# ... do the work ...
tbd close proj-xxxx --reason="Fixed in commit abc123"
# Finished several beads? Close them in ONE call — never a shell loop:
tbd close proj-a1 proj-b2 proj-c3 --reason="Sprint work"
tbd sync                                    # Push changes
```

### Agent-Friendly Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Machine-parseable output |
| `--dry-run` | Preview changes before applying |
| `--quiet` | Suppress informational output |

### Actor Resolution

The actor name (for `created_by` field) is resolved in order:

1. `--actor <name>` flag
2. `TBD_ACTOR` environment variable
3. Git `user.email` from config
4. System username

```bash
TBD_ACTOR=claude-agent tbd create "Fix bug" --type=bug
```

### Claude Code Integration

Install hooks for automatic context injection:

```bash
tbd setup claude                            # One-time global setup
```

This runs `tbd prime` at session start and before context compaction, ensuring the agent
remembers the tbd workflow.

### Bulk Close, Update, and Reopen

`close`, `reopen`, and `update` all take multiple IDs — one call, one lock, one summary
line:

```bash
tbd close proj-a1 proj-b2 proj-c3 --reason="Sprint complete"
tbd update proj-a1 proj-b2 proj-c3 --priority 1 --add-label done
tbd reopen proj-a1 proj-b2 --reason="Regression found"
tbd close proj-a1 proj-b2 proj-gone --ignore-missing   # Unknown IDs become skips
```

Do NOT loop over single-ID calls (`for id in …; do tbd close $id; done`): the bulk form
is faster, validates all IDs before writing anything, and produces one clean summary (or
a structured `--json` result) instead of N interleaved outputs.
See [Bulk operations and the output contract](#bulk-operations-and-the-output-contract).

## Common Workflows

### Starting a New Project

```bash
cd my-project
git init
tbd init
tbd create "Initial setup" --type=chore
```

### Daily Workflow

```bash
# Start of day - sync and find work
tbd sync
tbd ready

# Pick up an issue
tbd update proj-a7k2 --status=in_progress --assignee=myname

# Work on it...

# Add notes as you work
tbd update proj-a7k2 --notes="Found the bug in auth.ts line 42"

# Complete and sync
tbd close proj-a7k2 --reason="Fixed in commit abc123"
tbd sync
```

### Managing an Epic

```bash
# Create epic linked to a spec
tbd create "User Authentication System" --type=epic --priority=P1 --spec=docs/specs/auth.md

# Create child tasks (they inherit spec_path from the epic automatically)
# No need to duplicate the epic's description — `tbd show` on any child
# automatically displays the parent's context.
tbd create "Design auth API" --parent=proj-epic
tbd create "Implement login endpoint" --parent=proj-epic
tbd create "Add password reset" --parent=proj-epic

# View epic and children
tbd show proj-epic
tbd list --parent=proj-epic
```

### Handling Dependencies

```bash
# Create issues
tbd create "Set up database" --type=task
tbd create "Implement API" --type=task

# API depends on database (database blocks API)
tbd dep add proj-api proj-database

# Check what's blocked
tbd blocked

# Once database is done
tbd close proj-database
tbd ready  # API now appears as ready
```

### Bug Triage

```bash
# List all open bugs by priority
tbd list --type=bug --sort=priority

# Escalate a critical bug
tbd update proj-bug1 --priority=P0 --label=critical

# Assign bugs
tbd update proj-bug1 --assignee=alice
tbd update proj-bug2 --assignee=bob
```

### Code Review Workflow

tbd includes comprehensive code review shortcuts that load all relevant guidelines and
perform thorough reviews:

```bash
# Review uncommitted changes (for pre-commit)
tbd shortcut review-code
# Then select "Uncommitted changes" scope

# Review all changes on this branch vs main
tbd shortcut review-code
# Then select "Branch work" scope

# Review a specific GitHub PR and publish the review
tbd shortcut review-github-pr
# Reviews and publishes only; to fix a published review:
tbd shortcut address-pr-review

# Language-specific reviews (when you want just the language rules)
tbd shortcut review-code-typescript
tbd shortcut review-code-python
```

The `review-code` shortcut automatically loads:
- General coding rules
- Comment quality guidelines
- Error handling rules
- Language-specific rules (TypeScript/Python) based on files changed
- Testing guidelines when test files are modified

```bash
# Find stale issues (awaiting review?)
tbd stale --days=3

# Search for review-related issues
tbd search "review" --status=open
```

### Migration from Beads

```bash
# Recommended: one-step migration
tbd setup --auto                        # Auto-detects beads, imports, sets up integrations

# Or explicit migration
tbd setup --from-beads                  # Migrate from beads with prompts

# Manual step-by-step migration
bd sync                                 # Final Beads sync
tbd init --prefix=myproj                # Initialize tbd
tbd import issues.jsonl                 # Import from exported JSONL
tbd setup beads --disable --confirm     # Disable Beads

# Verify migration
tbd stats
tbd list --all
```

The `tbd setup beads --disable` command safely moves all Beads files to
`.beads-disabled/` for potential rollback, including:

- `.beads/` directory (data and config)
- `.beads-hooks/` directory (git hooks)
- `.cursor/rules/beads.mdc` (Cursor rules)
- `bd` hooks from `.claude/settings.local.json`
- Beads section from `AGENTS.md`

## File Structure

tbd stores data in the following locations:

```
my-project/
├── .tbd/
│   │
│   │ Committed to the repo:
│   ├── config.yml                    # Project configuration
│   ├── .gitignore                    # Controls what's gitignored below
│   ├── workspaces/                   # Persistent state (outbox, named workspaces)
│   │
│   │ Gitignored (local only):
│   └── state.yml                     # Local state
│
└── $GIT_COMMON_DIR/tbd/
    └── data-sync-worktree/           # Hidden worktree shared by linked checkouts
        └── .tbd/data-sync/
            ├── issues/               # Issue files (*.md)
            ├── mappings/             # ID mappings
            │   └── ids.yml           # Short ID → ULID mapping
            ├── attic/                # Conflict archive
            └── meta.yml              # Schema version
```

### Issue File Format

Each issue is stored as a Markdown file with YAML frontmatter:

```markdown
---
created_at: 2025-01-15T10:30:00Z
dependencies: []
id: is-01hx5zzkbkactav9wevgemmvrz
kind: task
labels: [backend, urgent]
priority: 2
status: open
title: Fix login bug
type: is
updated_at: 2025-01-15T10:30:00Z
version: 1
---

User reports intermittent login failures.

## Notes

Found the issue in auth.ts - race condition in token refresh.
```

## Configuration Reference

Configuration is stored in `.tbd/config.yml`:

```yaml
tbd_version: "0.1.0"

display:
  id_prefix: proj            # Prefix for display IDs (required, set during init)

sync:
  branch: tbd-sync           # Sync branch name
  remote: origin             # Remote name
  auto_sync: false           # Reserved; issue writes stage locally — run `tbd sync` to publish

docs_cache:
  files:                     # Docs synced into the cache: destination -> docref
    guidelines/python-rules.md: internal:guidelines/python-rules.md
    guidelines/my-team-rules.md: github:my-org/docs@main//rules.md
  lookup_path:               # Search paths for doc lookup (earlier wins)
    - .tbd/docs/shortcuts/system
    - .tbd/docs/shortcuts/standard
```

`docs_cache.files` values, like the fork manifest’s `source` values in
`.tbd/doc-forks/forks.yml`, are **docrefs**: one URI-like address grammar (`internal:…`,
anchored local paths, URLs, `github:owner/repo@ref//path`). For the full grammar see
`tbd docs show docref-format`; for the docmap structure that doc listings and their
`--json` output follow, see `tbd docs show docmap-format`.

Two further `docs_cache` keys:

- `docs_cache.local_dirs`: an ordered list of `./`-prefixed local docrefs naming extra
  in-repo doc directories, served between the fork dir and the cache.
  Docs found there are first-class for reading (`list`, `show`, the per-kind readers,
  with a `(serving local doc: …)` note) and report state `local`; they are not forkable
  or updatable; they already live in the repo.
- `docs_cache.fork_dir`: reserved in the f05 format era but **planned, not yet read**:
  the fork-dir location is currently fixed at `docs/tbd/`.

## Priority Scale

| Value | Alias | Meaning |
| --- | --- | --- |
| 0 | P0 | Critical—drop everything |
| 1 | P1 | High—this sprint |
| 2 | P2 | Medium—soon (default) |
| 3 | P3 | Low—backlog |
| 4 | P4 | Lowest—maybe/someday |

Both formats work: `--priority=P1` or `--priority=1` (P-prefix is the canonical display
format)

## Date Formats

Commands like `--due` and `--defer` accept flexible date input:

| Format | Example | Result |
| --- | --- | --- |
| Full datetime | `2025-02-15T10:00:00Z` | Exact time (UTC) |
| Date only | `2025-02-15` | Midnight UTC |
| Relative | `+7d` | 7 days from now |
| Relative | `+2w` | 2 weeks from now |

## How Sync Works

tbd stores issues on a dedicated `tbd-sync` branch, separate from your code branches.

**Fully automatic**: Unlike Beads (where you manually `git add`/`commit`/`push` the
JSONL file), `tbd sync` handles all git operations on the sync branch automatically.
You never need to manually push issue data—just run `tbd sync` and it’s done.

**Why this matters:**
- No merge conflicts in feature branches
- Issues shared across all branches
- Clean code history (no issue churn)
- No manual git operations for issues

**Conflict handling:**
- Detection via content hash comparison
- Automatic field-level merge (last-write-wins for scalars, union for arrays)
- Lost values preserved in the attic—no data loss

**Daily usage:**
```bash
tbd sync                    # Pull + push (run at session start/end)
tbd sync --status           # Check what's pending
```

Note: Your normal `git push` is only for code changes.
Issue sync is separate and automatic.

## Troubleshooting

### Sync Issues

```bash
# Check sync status
tbd sync --status

# Force sync if conflicts
tbd sync --force

# Run diagnostics
tbd doctor
tbd doctor --fix
```

### ID Not Found

If you get “Unknown issue ID” errors:

```bash
# Verify the issue exists
tbd list --all | grep <partial-id>

# Use --debug to see internal IDs
tbd list --debug
# proj-a7k2 (is-01hx5zzkbkactav9wevgemmvrz)  Fix login bug
```

### Debugging with Internal IDs

tbd uses short display IDs (`proj-a7k2`) that map to internal ULIDs
(`is-01hx5zzkbk...`). You normally don’t need internal IDs, but they’re useful for:

```bash
# Find the actual issue file
ls "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues"/is-01hx5*.md

# Internal IDs sort chronologically (creation order)
ls "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/" | sort
```

### Aborting a Format Upgrade

Upgrading tbd can bump the repository format (`tbd_format` in `.tbd/config.yml`, e.g.
f04 → f05). The bump happens automatically on the first command after upgrading, and
older tbd versions then refuse the repository until they are upgraded.
If an upgrade hits unexpected bugs, you can cleanly abort and return to the previous
version. This is everything a format upgrade can touch:

| State | Location | In git? | Written by | Revert |
| --- | --- | --- | --- | --- |
| Project config | `.tbd/config.yml` | tracked | the migration (format stamp) | `git checkout -- .tbd/config.yml`, or `git revert` the bump commit |
| Agent surfaces | `AGENTS.md`, `.claude/`, `.agents/`, `.codex/` | tracked | only `tbd setup --auto` (marker refresh) | `git checkout --` those paths |
| Shared layout stamp | `$GIT_COMMON_DIR/tbd/layout.yml` | machine-local, not in git | the migration (re-stamp) | delete it; it regenerates from whatever the config says |
| Forked docs (f05) | `docs/tbd/`, `.tbd/doc-forks/` | tracked once committed | only `tbd docs fork` | `git checkout --`/`git revert` if committed; delete if never committed |
| Docs cache | `.tbd/docs/` | gitignored | doc sync (unchanged by migration) | none needed; always safe to delete and re-sync |
| Issue data | `tbd-sync` branch + `$GIT_COMMON_DIR/tbd/data-sync-worktree/` | git branch | **never touched by migration** | none needed; the worktree re-materializes from the branch |

**Abort recipe** (works from any state, including a crash mid-upgrade):

```bash
# 1. Restore the tracked files (or `git revert` the format-bump commit):
git checkout -- .tbd/config.yml
git checkout -- AGENTS.md .claude .agents .codex   # only if `tbd setup --auto` ran

# 2. Delete the machine-local format stamp (regenerates from the config):
rm "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/layout.yml"

# 3. Only if docs were forked and never committed:
rm -rf docs/tbd .tbd/doc-forks
```

After this, the previous tbd version works again, and re-running the upgrade later is
safe; the migration is idempotent from any of these states.

Reverting `.tbd/config.yml` is enough to drop the format gate even if forks were already
committed: compatibility is decided only by `tbd_format` in the config, not by the
presence of `docs/tbd/` or `.tbd/doc-forks/`. Committed fork files simply become inert
`local` docs under the older version; harmless to leave in place, so step 3 is only for
cleanup, never required to abort.

Notes:

- **The migration never writes issue data**, so the recipe above cannot lose issues; it
  touches only the two stamps and tracked files.
  A bigger hammer also exists: deleting the entire `$GIT_COMMON_DIR/tbd/` directory is
  recoverable (layout and the data-sync worktree re-materialize from the config and the
  `tbd-sync` branch on the next command, or via `tbd doctor --fix`); **but only for
  synced data**. Issue changes since the last `tbd sync` live as uncommitted files
  inside that worktree and would be lost, so run `tbd sync` first if you must delete it.
  This is why the recipe deletes only `layout.yml`, never the whole directory.
- **Interrupted upgrades self-heal.** If the process dies between the two stamp writes
  (layout updated but not config, or config but not layout), the next command with the
  new version completes the migration; the abort recipe above also works from either
  partial state.
- **Quiesce other tbd processes first.** The same self-healing re-stamp that completes
  an interrupted upgrade can also undo an abort.
  Any concurrent `tbd` write (another worktree, a background agent, an editor hook)
  re-stamps `layout.yml` from whatever `.tbd/config.yml` currently says.
  If you delete `layout.yml` while the config is still on the new format, or before the
  config revert in step 1 has landed, the next write recreates the stamp and reopens the
  migration. Stop other agents and worktrees, do step 1 (revert the config) before step 2
  (delete the stamp), and the abort sticks.
- Teammates each migrate their own machine-local stamp automatically; only the
  `.tbd/config.yml` change is shared (via your branch), so reverting that commit is the
  team-wide rollback.

### Performance

For large repositories with many issues:

```bash
# Limit results
tbd list --limit=50

# Use specific filters
tbd list --status=open --type=bug
```

## Tips

1. **Use labels for workflow states**: `needs-review`, `blocked-external`, `wontfix`

2. **Set priorities consistently**: 0=drop everything, 1=this sprint, 2=soon, 3=backlog,
   4=maybe

3. **Use epics for grouping**: Create an epic and link child tasks with `--parent`

4. **Add working notes**: Use `--notes` to track investigation progress

5. **Sync regularly**: Run `tbd sync` at start and end of work sessions

6. **Use JSON for scripting**: `tbd list --json | jq '.[] | select(.priority == 0)'`

7. **Alias for convenience**: `alias bd=tbd` for muscle memory from Beads

## Getting Help

```bash
tbd --help                    # General help
tbd <command> --help          # Command-specific help
tbd help <command>            # Alternative help syntax
```

**Project Repo**: https://github.com/jlevy/tbd

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
