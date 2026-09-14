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
to know that internally it’s simple and transparent.
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

- Node.js 22.12.0 or newer
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
tbd start proj-1847                          # Claim under the resolved agent identity
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
tbd setup --auto --prefix=proj    # Fresh repository; prefix is required
tbd setup --auto                  # Existing tbd repository; refresh and migrate
tbd setup --from-beads            # Migrate an uninitialized repository from Beads
tbd setup --auto --surfaces=portable,agents-md  # Install selected agent surfaces
```

Options:
- `--auto` - Non-interactive setup mode.
  Fresh repositories require `--prefix`; an existing `.tbd/config.yml` supplies it.
  If an uninitialized repository contains `.beads/`, setup reads the Beads prefix and
  migrates it.
- `--from-beads` - Require `.beads/` and run the Beads migration; implies `--auto`
- `--prefix <name>` - Project prefix.
  Required for a fresh repository unless Beads supplies it
- `--force` - Permit a valid but non-recommended prefix outside the 2-8-letter form
- `--no-gh-cli` - Disable the generated GitHub CLI installation hook
- `--surfaces <list>` - Comma-separated agent surfaces: `portable`, `agents-md`,
  `claude`, `codex`, or `all`. Omitting the flag installs all four

`--surfaces` controls only generated agent integration files.
Setup still initializes or migrates configuration, refreshes the docs cache, and cleans
recognized legacy tbd hooks.
Bare `tbd setup` displays help; the old positional `setup claude`, `setup codex`,
`setup auto`, and `setup beads` forms are not commands.

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
On a fresh repository it requires an explicit prefix; on an existing tbd repository it
reads the configured prefix.
It installs all four agent surfaces unless `--surfaces` narrows the set.

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

# With separate accountable and acting identities
tbd create "Review OAuth" --assignee=alice --delegate=review-agent

# From YAML file
tbd create --from-file=issue.yml
```

Options:
- `--type <type>` - Issue type: bug, feature, task, epic, chore (default: task)
- `--priority <0-4>` - Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog
  (default: 2)
- `--description <text>` - Issue description
- `--file <path>` - Read description from file
- `--assignee <name>` - Set who is accountable
- `--delegate <name>` - Set who is acting; this administrative write bypasses the
  guarded claim behavior of `tbd start`
- `--due <date>` - Due date (ISO8601 format)
- `--defer <date>` - Defer until date
- `--parent <id>` - Parent issue ID (for sub-issues).
  If the parent has a `spec_path` and `--spec` is not provided, the child inherits the
  parent’s `spec_path`.
- `--spec <path>` - Link to spec document (validated, normalized to project root).
  A unique filename or path suffix also resolves (same matching as `list --spec`), so
  `--spec plan-2026-01-01-feature.md` works from anywhere; ambiguity errors list every
  candidate.
- `--depends-on <id>` - Blocker this issue depends on (can repeat), so a bead is created
  fully wired instead of needing follow-up `dep add` calls
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
- `--defer-before <date>` - Deferred strictly before this date.
  Beads with no `deferred_until` are excluded, since they are not deferred before
  anything
- `--sort <field>` - Sort by: priority, created, updated (default: priority).
  Tiebreaker: internal ULID (chronological creation order)
- `--limit <n>` - Limit number of results
- `--count` - Output only the count of matching issues
- `--long` - Show issue descriptions on a second line
- `--pretty` - Show tree view with parent-child relationships

### show

Display detailed information about one or more issues.

```bash
tbd show proj-a7k2                            # YAML output
tbd show proj-a7k2 --json                     # JSON output
tbd show proj-a7k2 --no-parent                # Suppress parent context
tbd show proj-a7k2 proj-b3m9 proj-c1x8        # Several in one call (never a loop)
tbd show proj-a7k2 proj-b3m9 --max-lines 40   # Cap output per issue
```

With several IDs, each issue renders under a dim `── <id> ──` delimiter in argument
order (duplicates render once), parent context is suppressed, `--max-lines` applies per
issue, and `--json` emits an array.
Unknown IDs abort the whole read listing every bad ID; `--ignore-missing` renders the
found subset and reports skips on stderr (exit 0), the same contract the bulk mutators
use. In `--json` mode stdout stays parseable even when everything is skipped: the bulk
form emits `[]` and the single-ID form emits `null`.

Output includes all fields: title, description, status, priority, labels, dependencies,
timestamps, and working notes.
The raw `dependencies` field is a storage-format edge list: an entry with `type: blocks`
means the shown issue blocks the target.
When dependency directions exist, text output adds YAML comments above `dependencies`
with human-facing `Blocks:` and `Blocked by:` sections using display IDs.
For dependency-direction checks, prefer `tbd dep list <id>`. For child issues, the
parent’s details (ID, title, status, priority, description) are automatically displayed
below the child for context.

### start

Claim one or more beads under the acting-agent identity:

```bash
tbd start proj-a7k2
tbd start proj-a7k2 proj-b3m9 --as review-agent
tbd whoami                                  # Preview the resolved identity
```

An accepted claim sets `status: in_progress`, preserves `assignee`, records the resolved
friendly name in `delegate`, initializes `started_at` once, and clears
`hold`/`hold_until`. A closed bead is skipped.
A bead already in progress under a different nonempty delegate is reported and left
alone; repeating the same visible claim is a no-op.

This is an advisory local guard.
It does not check blockers or a future deferral, and it cannot compare-and-set against a
stale remote clone. Pull and re-read before claiming, then run `tbd sync` to publish the
result. Direct `update --status=in_progress`, `update --delegate`, and
`create --delegate` are administrative writes that bypass the claim guard.

### update

Modify an existing issue.

```bash
tbd update proj-a7k2 --status=in_progress    # Direct status edit; not a guarded claim
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
- `--assignee <name>` - Set who is accountable
- `--delegate <name>` - Set who is acting; this administrative write bypasses the
  `start` collision check
- `--hold <state>` - Set `blocked`, `paused`, or `none`
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
Per-ID-only flags (`--title`, `--description`, `--notes`/`--notes-file`, `--from-file`,
`--parent`, `--spec`, `--child-order`) are rejected with two or more IDs, and `--status`
is rejected in bulk — use `tbd close`/`tbd reopen` for lifecycle changes.
`--description` and `--notes` also accept `-` to read stdin.

**Notes replace, they do not append.** `--notes` sets the entire notes body, so read the
current value first if you mean to add to it.
Notes are single-writer replaceable state: concurrent writers resolve last-write-wins
with the loser preserved in the attic, which is recovery, not a conversation log.
For a durable multi-writer history, create a child bead per event or keep the transcript
in an external system.

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
- `--as <resolution>` - `completed`, `canceled`, or `duplicate`; ordinary close omits
  the stored value and reads as completed
- `--duplicate-of <id>` - Required with `--as duplicate`
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

Reopen clears `closed_at`, `close_reason`, `resolution`, and `duplicate_of` while
retaining the historical `started_at`.

### pause and resume

Set work down without erasing that it started, or lift that hold:

```bash
tbd pause proj-a7k2 --until=2026-09-12 --reason="Waiting for access"
tbd resume proj-a7k2 --reason="Access restored"
```

`pause` records `hold: paused`, optional `hold_until`, and an optional note while
leaving `status` and `started_at` intact.
`resume` clears the hold and its deadline.
Both commands accept multiple IDs and `--ignore-missing`; closed beads are reported and
skipped. Passing `hold_until` does not automatically clear a pause, so resume remains
explicit.

### Bulk operations and the output contract

`close`, `reopen`, and `update` accept multiple IDs and process them together under a
single lock. The output is designed so agents never need `2>&1 | tail -1`:

- **One summary line** on success, e.g. `✓ Closed 3, skipped 1 (already closed): …`,
  followed by a visible `• Unsynced changes — run tbd sync to publish.` hint.

- **Fail-closed validation**: if any ID is unknown the whole batch aborts before writing
  anything and lists the bad IDs; `--ignore-missing` downgrades genuinely absent issues
  to reported skips. An unreadable or corrupt issue file always aborts the batch — even
  with `--ignore-missing` — preserving the original error.
  Duplicate IDs in one call are processed once, and results are reported in the order
  the IDs were given. `--dry-run` previews after resolution, reads, and state checks, so
  it shows exactly what a real run would write.

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

  The `sync` field is always present: `{ "pending": true, "hint": … }` when changes are
  staged, `{ "pending": false }` when nothing changed.
  A write that fails mid-batch is reported as `{ "action": "failed", "ok": false }` with
  the error in `skippedReason`; the command still emits the full summary, names every
  failed ID with its error on stderr (visible under `--quiet` too), and exits non-zero.

**Free-text bodies without quoting hazards.** Reasons, descriptions, and notes accept
the text inline, from a file (`--reason-file`, `-f`/`--file`, `--notes-file`), or from
stdin with the `-` convention (`--reason=-`, `-d -`, `--notes=-`), so shell-sensitive
text (`$`, backticks, quotes) round-trips verbatim instead of being mangled by the
shell.

**Sync is stage-then-publish.** Every write lands in the local `tbd-sync` worktree
immediately; nothing reaches the remote until you run `tbd sync`. There is no
per-command auto-sync, and the legacy no-op `--no-sync` flag has been removed.

### ready

List issues ready to work on: `status` is open, no `delegate` or `hold` is set, any
`deferred_until` has elapsed, and no non-closed blocker targets the bead.
`assignee` records accountability and does not affect readiness.

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
- `add <issue> <depends-on...>` - Issue depends on each depends-on (one call wires
  several blockers; all IDs validate before anything is written)
- `remove <issue> <depends-on...>` - Remove one or more dependencies
- `list <id>` - List dependencies for an issue (what it blocks and what blocks it)

Use `tbd dep list <id>` when checking dependency direction.
The raw `dependencies` frontmatter in `tbd show` stores graph edges where `type: blocks`
means the shown issue blocks the target.

### sync

Synchronize the docs, issue Git, and enabled external-tracker surfaces.

```bash
tbd sync                                    # Full sync (pull + push)
tbd sync --status                           # Check docs and issue Git status
tbd sync --pull                             # Pull the issue sync branch only
tbd sync --push                             # Push the issue sync branch only
tbd sync --integrations --pull              # Pull issues plus enabled trackers
tbd sync --integrations --push              # Push issues plus enabled trackers
tbd sync --force                            # Accepted compatibility flag; currently inert
```

Options:
- `--issues` - Sync only the issue Git surface
- `--docs` - Sync only the local docs cache
- `--integrations` - Sync only enabled external trackers, unless combined with a
  direction flag (which also selects issues)
- `--push` - Push local issue changes only unless `--integrations` is also explicit
- `--pull` - Pull remote issue changes only unless `--integrations` is also explicit
- `--status` - Show docs and issue sync status without syncing.
  It never runs or checks external trackers; use `tbd integration status` for those
- `--force` - Accepted for compatibility but currently has no effect; it does not
  overwrite conflicts (`tbd-s18s` tracks implementing or removing it)
- `--fix` - Attempt to repair an unhealthy issue worktree before syncing
- `--no-auto-save` - Do not copy issue state to the outbox after a permanent push
  failure
- `--no-outbox` - Do not import a pending outbox after a successful issue push

With no surface or direction flag, `tbd sync` runs docs, issues, and enabled trackers.
Any `--push` or `--pull` selects issues and excludes trackers unless `--integrations` is
also present. Direction flags cannot be combined with `--docs`.
`tbd sync --integrations --status` currently selects no status surface, so use the
standalone integration status command instead.
The global `--dry-run` also suppresses the folded tracker run; preview tracker work with
`tbd --dry-run integration sync`.

### changes

Report what changed between a baseline commit and the local sync branch.
The command reads committed Git objects only: it never fetches, never reads the hidden
data-sync worktree, and never takes the sync lock.

```bash
tbd changes --since <commit>                 # All changed beads (the default)
tbd changes --since <commit> --bead proj-a7k2 proj-b3m9
tbd changes --since <commit> --label needs-agent --json
tbd changes --since <commit> --ready --json  # Beads newly entering ready
```

Options:
- `--since <commit>` - Required baseline commit (see “Baseline commits” below)
- `--bead <ids...>` - One or more beads
- `--label <label>` - Beads with this label (repeatable; labels are ANDed)
- `--spec <path>` - Beads tracking this spec (filename or suffix is enough)
- `--status <status>` - `open`, `in_progress`, `blocked`, `deferred`, or `closed`
- `--ready` - Beads that newly entered the ready set
- `--all` - Every bead (the default)

Exit 0 means matching changes were reported, exit 3 means none matched.

For every selector except `--ready`, the resolved endpoint commits determine report
membership. `--ready` also evaluates `deferred_until` at the current invocation time,
which is not stored in the report; identical endpoints can therefore report a different
ready edge after a deferral elapses (`tbd-obw9`). The tip is the local sync branch,
which advances at `tbd sync`, so local bead edits made since the last sync are not
visible here.

#### Baseline commits

`--since` takes an ordinary Git commit-ish resolved in your repository, so a full or
short SHA, `tbd-sync~3`, or a tag all work.
It is not an issue ID, a date, or a tbd-internal counter.

The commit must be on the sync branch’s history.
A commit from a working branch such as `main` is not, and the command rejects it rather
than guessing.

Normally the baseline comes from an earlier report: every report carries the full
`since` and `tip` it used, and passing that `tip` back as the next `--since` leaves no
gap between invocations.
To start cold, use any sync-branch commit, for example `git rev-parse tbd-sync`. To see
the available history, `git log tbd-sync`.

If sync recovery rewrites the sync branch, a saved baseline stops being an ancestor of
the new tip; the command fails and you start from a fresh baseline.

### watch

Block until selected bead state changes on the remote sync branch, report the change,
and exit. Use it to wake an agent or a shell worker instead of polling in a loop.
A selector is required, since an unqualified watch is rarely the intent.

```bash
tbd watch --bead proj-a7k2 --json
tbd watch --label needs-agent --json
tbd watch --spec plan-feature.md --json
tbd watch --status blocked --json
tbd watch --ready --json
tbd watch --all --timeout 540 --json
```

Options:
- Same selectors as `changes`, but one of them is required
- `--since <commit>` - Resume from this commit instead of from the current remote tip
- `--interval <seconds>` - Remote poll interval (default 30, minimum 10)
- `--timeout <seconds>` - Exit 3 if nothing matches in this time (default: wait forever)

Exit 0 means a change was reported, exit 3 means `--timeout` elapsed, exit 1 means an
operational error.

Watch polls the remote tip with `git ls-remote` and only transfers objects once that tip
moves. It is read-only with respect to shared state: fetches land in a temporary private
ref, so the working tree, the hidden data-sync worktree, its lock, `FETCH_HEAD`, and
both the local and remote-tracking sync refs are untouched.
Several watchers and an ordinary `tbd sync` can run in one checkout.

Operational behavior worth relying on:

- **Resume.** Pass a previous report’s `tip` as `--since` to cover the gap between runs.
  Changes that landed while you were working are then reported immediately at startup.
- **Timeouts.** At the `--timeout` boundary watch makes one final remote observation, so
  a change landing exactly on the deadline is not dropped.
- **Stalls.** Each observation and its fetch share one wall-time budget (the poll
  interval, capped at 30 seconds), so a hung Git transport exits 1 instead of hanging.
- **Outages.** An established watch rides out a bounded run of failed polls before
  exiting 1, so a brief network blip does not end an unattended watch.
- **Ready workers.** `--ready` reports only a remote Git transition into readiness.
  It does not return beads already ready at the baseline, and a `deferred_until`
  deadline passing creates no Git event.
  A general worker also runs `tbd sync --pull` and `tbd ready` at startup and restart,
  then repeats that scan periodically.

Raw watch does not persist a cursor and does not by itself promise at-least-once
delivery. Without `--since`, a restart takes the current remote tip as its new baseline
and can skip a lost report.
A caller that needs at-least-once processing persists the prior baseline and pending
report, advances its checkpoint only after successful handling, and makes actions
idempotent; the worker shortcut implements that pattern.
A watch report is a wake signal, not a license to act on stale state.
Pull and re-read current state before writing.

See `tbd shortcut watch-beads` for the durable watch-then-spawn worker recipe and for
in-session Claude Code and Codex patterns.

### web

Serve a live, read-only view of the bead graph in a local browser.
The page uses the same local bead state, filter semantics, readiness rules, hierarchy,
and statistics as the CLI, and displays the equivalent `tbd list` or `tbd ready` command
for the current view.
The Ready checkbox is the exact `tbd ready` predicate—open, without a delegate or hold,
with no non-closed blocker, and not deferred into the future.
`assignee` records accountability and does not affect readiness.
A quiet unboxed row marker exposes that derived state while scanning; it is
intentionally distinct from user labels.
Pretty is on by default and never changes when a column sort changes.
In Pretty mode, the two-key sort moves only outermost visible parent groups.
Updated is rolled up to the latest timestamp in each complete visible subtree for every
parent kind; children keep their official `child_order_hints` order.
Every non-root browser row uses one `└──` elbow at its hierarchy indentation.
Deeper levels use spaces instead of ancestor bars, and siblings never switch to a tee.
Flat mode applies the stack to individual rows.
Filters remain exact in both modes: a filtered-out parent is not reinserted, and a
matching child simply becomes a root.
Browser-only column composition is identified as inexact beside that command.
In an agent session, ask naturally: “Show my beads in a browser.”
The agent should run `tbd web --open`, wait for the startup URL, give you that URL, and
keep the foreground process alive.
The page is a viewer, not an editor.
Its controls change only the query and presentation; ask the agent to make bead changes
with ordinary `tbd` commands, and their local results appear automatically.
It never contacts a remote.
Run the ordinary `tbd sync` command when you want to fetch, merge, or publish bead
state; the page observes the resulting local changes automatically.

Expanded updated beads show compact field deltas.
Each scalar before/after side uses an 80-character middle-ellipsis preview so both the
start and appended tail remain useful; the copy control retains the bounded full values.
Historical before text is muted and the after text is normal.
Newly created beads omit the redundant null-to-current-value delta because their
expanded body already shows the current data.
Status-panel field names use normal-size sans text, and literal values use normal-size
monospace, keeping their baseline readable and consistent with board rows.

```bash
tbd web                         # Serve on the first free port in 7777-7786
tbd web --open                  # Open the page after it is HTTP-ready
tbd web ../another-repo --open  # View a repository from another directory
tbd web --port 9000             # Bind exactly 127.0.0.1:9000
tbd --json web                  # Print the machine-readable startup descriptor
tbd --dry-run web               # Resolve the repo and port without binding
```

Options:

- `[path]` - Resolve this repository or subdirectory instead of the current directory.
  Relative paths are resolved from the caller’s current directory; the startup
  descriptor reports the canonical repository root.

- `--port <n>` - Bind exactly this loopback port.
  Without it, tbd searches the bounded range 7777-7786 and reports the port it selected.

- `--open` - Open the default browser after the page passes an HTTP readiness check.
  The default is not to launch a browser, which is safe for agents and CI.

The command stays in the foreground; press Ctrl+C to stop it.
An initialized repository with zero beads is valid and renders the ordinary empty board.
A missing or non-directory path is a usage error; an existing directory outside an
initialized tbd repository reports the standard “Not a tbd repository” error used by
other commands. SIGINT exits 130 and a normal or SIGTERM shutdown exits 0. It binds only
`127.0.0.1`, exposes no write route, and serves one self-contained page with same-origin
and security-header checks.
It is a local development and observation surface, not a remotely reachable service.

The browser opens its live event stream before loading the board and refreshes whenever
the local hidden data-sync worktree changes.
Node’s native filesystem watcher normally delivers the update immediately.
A constant-size metadata-and-writer-epoch check once per second recovers a dropped event
without re-reading the graph when nothing changed.
If native recursive watching is unavailable, that check becomes the transparent
fallback. It also observes local configuration and workspace metadata changes.

The page keeps serving its last complete snapshot while another `tbd` command writes.
Standard writers publish an active/quiescent local epoch under the existing shared
writer lock; the viewer stages a replacement snapshot and adopts it only when the same
quiescent epoch brackets the entire read.
File-event bursts are coalesced, and a missed or rejected update is retried without
blocking the writer.
This prevents a create, update, doctor repair, or sync burst from appearing as a
transient deletion or a mixture of old and new files.

This separation is intentional: `tbd web` is a view, not a second synchronization
client. A remote change is invisible until an explicit `tbd sync` integrates it locally,
at which point the running page updates without a browser refresh.
Local mutating commands such as `tbd create`, `tbd update`, and `tbd close` are
reflected the same way.
Descriptions and notes load only when a row is expanded, so the board remains bounded on
large repositories. A response can carry up to 10,000 rows; the browser paints them in
5,000-row pages with sticky and end-of-page navigation.
Above 10,000 rows, the page reports the complete count and asks for a narrower query.
Status, Type, Priority, and the label chooser show conditional tallies after every other
active filter. The menu shows up to 32 labels at once; its search field queries the
complete label vocabulary and retains selected labels.
Typing is stable across live updates; Home and End move the search caret while that
field has focus and navigate the choices otherwise.
Unselected zero-count choices are hidden; a selected zero-count value remains visible so
it can be removed. Label candidates additionally show the next repeated-label
intersection and preserve the CLI’s AND semantics.
Collapsed titles use at most four lines and expand in full.
The Updated column shows a compact sans relative age and exposes the exact monospace ISO
timestamp in the shared fast tooltip.
Every data-column header is sortable.
Pretty is enabled by default with Updated descending, then Priority ascending.
A click makes that column primary and retains only the previous primary as its
tie-breaker; clicking the current primary reverses it without changing Pretty.
Pretty moves whole outermost visible groups, rolling Updated up from every visible
descendant while retaining official child order.
Flat mode applies the stack to rows.
Reset sort restores the default two-key stack without changing Pretty.
The equivalent-command tooltip names browser-only ordering that the displayed CLI
command does not reproduce.
Changing a query control, display mode, or page closes expanded details.
A live graph update retains and remaps an expansion only while that bead remains in the
current bounded response, so an off-board or obsolete display ID cannot consume the
detail cap or trigger a stale body request.
Bulk expansion is available when the visible page has 100 rows or fewer; larger pages
remain individually expandable without an accidental request fan-out.
At most 100 detail rows remain open, and the client retains only the 200 most recently
loaded bodies. The latest changed-row set remains complete; field-level before/after
detail is a separate diagnostic capped at 100 changed beads and 256 KiB, with oversized
values summarized. A browser orders graph and metadata updates with an observer-local
state version, rejects stale equal-graph-version responses, and immediately adopts a new
observer after the server restarts rather than waiting for old counters.

### Change reports

`changes` and `watch` emit the same document.
With `--json` it prints verbatim; without it the same data is rendered for humans.

```json
{
  "since": "3f2a…",
  "tip": "9c81…",
  "changes": [
    {
      "id": "proj-a7k2",
      "internal_id": "is-01hx5zzkbkactav9wevgemmvrz",
      "title": "API returns 500 on malformed input",
      "change": "updated",
      "fields": [{ "field": "status", "before": "open", "after": "in_progress" }]
    }
  ]
}
```

- `since` and `tip` are the full resolved commit IDs.
  `tip` is the resume point.
- `change` is `created`, `updated`, or `deleted`.
- `fields` lists every substantive field that differs, in a fixed order.
  Bookkeeping fields (`id`, `type`, `version`, `updated_at`) are omitted.
- `description` and `notes` changes also carry `hunks`, a line diff with three lines of
  context. A rewrite too large to diff cheaply sets `hunks_omitted: "complexity_limit"`
  instead; `before` and `after` are still complete.

The report follows the same stability rule as tbd’s other `--json` output: fields are
added, never removed or repurposed, so ignore fields you do not recognize.

Selection semantics differ slightly by selector kind.
An unknown `--bead` ID is an error rather than a silent wait.
Label, spec, and status selections report a bead that matched *before or after*, so both
entering and leaving the set count.
`--ready` is edge-triggered: it reports only beads that were not ready before and are
now, using the same definition as `tbd ready` (open, without a delegate or hold, no
non-closed blockers, and not deferred into the future).
`assignee` does not affect readiness.
A deferral that merely elapses does not wake the watcher: readiness is evaluated at one
instant per comparison, so a bead becomes ready here only when an edit changes it.

### search

Search issue text and display IDs.
The default search includes open and closed issues; use `--status` to narrow it.

```bash
tbd search "login"                          # Search all fields
tbd search "auth" --field=title             # Search only titles
tbd search "TODO" --field=notes             # Search working notes
tbd search a7k2                             # Partial or full issue IDs match too
tbd search "api" --status=open              # Filter by status
tbd search "bug" --limit=10                 # Limit results
tbd search "Error" --case-sensitive         # Case-sensitive search
```

Options:
- `--status <status>` - Filter by status
- `--field <field>` - Search specific field: title, description, notes, labels, id
- `--limit <n>` - Limit results
- `--no-refresh` - Skip worktree refresh
- `--case-sensitive` - Case-sensitive search

Each issue appears at most once.
With no `--field`, fields are checked in this order: title, description, notes, labels,
then display ID. A bare ID query matches the random short-ID portion; a query containing
a dash anchors at the start of the full display ID. ID matching is case-insensitive even
with `--case-sensitive`. `--json` returns an array with the matching field and excerpt;
no matches return `[]` with exit 0.

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
- `--validate` - Validate existing import against Beads source
- `--beads-dir <path>` - Beads source directory used by `--validate`
- `--workspace <name>` - Import a named directory under `.tbd/workspaces/`
- `--dir <path>` - Import an arbitrary workspace-shaped directory
- `--outbox` - Import the `outbox` workspace and clear it after success
- `--clear-on-success` - Delete the selected workspace after a successful import

There is no `tbd import --from-beads` flag.
Use `tbd setup --from-beads` for the repository migration flow.

### Beads migration

Run the migration before initializing tbd in the repository:

```bash
tbd --dry-run setup --from-beads            # Preview; writes nothing
tbd setup --from-beads                      # Initialize, import, and install surfaces
tbd stats                                   # Verify imported totals
tbd list --all                              # Inspect imported beads
```

The command reads the prefix from Beads unless `--prefix` overrides it, imports
`.beads/issues.jsonl` when present, and renames the complete `.beads/` directory to
`.beads-disabled/`. The retained directory is the rollback source and is also accepted
by `tbd import --validate --beads-dir .beads-disabled`.

Migration does not remove `.beads-hooks/`, Cursor rules, Claude settings, or Beads text
from `AGENTS.md`; review those separately after validating the import.
It also continues after reporting a missing JSONL file or a partial import warning, so
read the import output and verify `stats` and `list --all` before treating migration as
complete. The removed positional `tbd setup beads` command is not available.

### status

Show repository status.
Works even when tbd is not initialized.

```bash
tbd status                                  # Show repo status
tbd status --json                           # JSON output
```

For an initialized repository, text output shows repository and Git information, the
configured sync branch and remote, installed agent surfaces, hidden-worktree health,
named workspaces, and forked-doc drift when applicable.
It does not show issue counts; use `tbd stats` for those.
Before initialization, it also detects `.beads/` and counts its JSONL records when
readable. `--json` returns the same orientation fields as one object.

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
- If the repository is not initialized, prints setup instructions and exits 0
- Custom output: create `.tbd/PRIME.md` to override default content
- `--brief` emits an abbreviated orientation

### setup surfaces

Setup installs project-local agent surfaces.
It installs every surface by default; it does not probe for an agent before writing that
agent’s surface.

```bash
tbd setup --auto                            # All four surfaces
tbd setup --auto --surfaces=portable        # .agents/skills/tbd/SKILL.md
tbd setup --auto --surfaces=agents-md       # Managed block in AGENTS.md
tbd setup --auto --surfaces=claude          # Claude skill mirror, hooks, and scripts
tbd setup --auto --surfaces=codex           # Codex hooks and scripts
tbd setup --auto --surfaces=portable,claude # A comma-separated subset
```

Use `all` for the full set.
The selector governs only these generated files: setup still refreshes cached docs and
applies any config/layout migration.
Existing managed content is refreshed, surrounding `AGENTS.md` content and unrelated
hook entries are preserved, and a surface stamped by a newer integration format is not
overwritten.
A portable or Claude skill file without tbd’s ownership marker is treated as
user-owned and setup stops rather than replacing it.

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
| `tbd sync` | project data (issues/beads) | sync worktree and `tbd-sync` branch; also refreshes the doc cache and *reports* fork drift | never |
| `tbd setup --auto` | installation and integrations | skills, hooks, settings, `AGENTS.md`; invokes a docs-cache sync | only generated integration files |
| `tbd docs sync` | doc cache | gitignored `.tbd/docs/` only | never |
| `tbd docs update` | your forked docs | fork dir, bases, and manifest (offline, against the cache) | **yes, the only doc command that does** |

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
stored** (the full model (copies, invariants, flows) is `tbd-design.md` §2.9; this table
is its user-facing summary); every doc’s state is recomputed from content hashes (your
file vs its recorded base vs current upstream), so no git operation can desynchronize
tbd from the folder.
Whatever you or your agent do to these files, `tbd docs status` gives a defined answer:

| You (or your agent)… | State | What happens / what to do |
| --- | --- | --- |
| Edit a forked file | `customized` | Served as-is; `tbd docs update` three-way merges upstream changes in |
| Delete a forked file | `missing` | Serving falls back to upstream; restore with `tbd docs fork <name> --force` or finalize with `tbd docs unfork <name>` |
| Rename a forked file | `missing` and `local` | A rename is a delete and an add: finalize the old name (`unfork`), keep the new file as `local` |
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

The parser accepts these global options with every command, but each option has an
effect only where that command implements the corresponding output or mutation path:

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
- `--dry-run` - Preview supported mutations; read-only and raw-document commands may
  ignore it
- `--verbose` - Enable verbose output
- `--quiet` - Suppress non-essential output
- `--json` - Request structured output from data-oriented commands.
  Raw document commands such as `readme`, `prime`, `skill`, and `closing` still emit
  text
- `--color <when>` - Colorize output: auto, always, never
- `--debug` - Show internal IDs alongside display IDs

### Exit codes

Exit codes are the same across commands, so scripts and agent recipes can branch on them
directly:

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Operational error, such as a failed Git operation or health check |
| 2 | A domain validation error, such as an invalid selector value |
| 3 | Nothing matched: `tbd changes` found no changes, or `tbd watch --timeout` elapsed |
| 130 | Interrupted with Ctrl-C (SIGINT) |

Commander-level parse failures, including an unknown flag or missing required positional
argument, currently exit 1. Code 3 is reserved for no matching Git change or a watch
timeout; an empty `search` result still exits 0.

## For AI Agents

tbd is designed for AI coding agents.
This section covers agent-specific patterns.

### Agent Workflow Loop

```bash
tbd ready --json                            # Find available work
tbd start proj-xxxx                          # Guarded local advisory claim
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

### Acting-agent identity

`tbd start` resolves the friendly name stored in `delegate` in this order:

1. Its `--as <name>` option
2. A nonempty `TBD_AGENT` environment variable
3. The machine-local session name in `.tbd/state.yml`
4. A derived `<harness>@<host>` name

```bash
tbd whoami                                  # Inspect the resolved identity
tbd whoami --ensure-id                      # Mint and persist a machine-local ID once
TBD_AGENT=claude-agent tbd start proj-a7k2
tbd start proj-b3m9 --as review-agent       # Per-command override
```

`whoami --ensure-id` stores an ID and, when needed, the resolved friendly name in the
local state file. Setup’s session-start hooks call this idempotently.
The ID and session name are local to the checkout; `start` writes only the friendly
`delegate` name on the bead and leaves `assignee` unchanged.

### Claude Code Integration

Install the Claude surface, or let the default setup install all four surfaces:

```bash
tbd setup --auto --surfaces=claude          # Claude files only
tbd setup --auto                            # Existing project; all agent surfaces
```

The Claude surface installs project-local hooks that run `tbd prime` at session start
and before context compaction, initialize the machine-local agent identity, and emit the
closing reminder after tool use.
It can also install the GitHub CLI helper unless `--no-gh-cli` is given.

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
A bulk call shares one reason (and one set of field changes for `update`), so group the
issues that share the same mutation and make one call per group.
The read side is bulk too: `tbd show A B C` renders several issues in one call, and
`guidelines`/`shortcut`/`template`/`docs show` load several docs in one call.
If you are about to shell-loop or pipe around tbd, the bulk or filter form exists.
See [Bulk operations and the output contract](#bulk-operations-and-the-output-contract).

## Common Workflows

### Starting a New Project

```bash
cd my-project
git init
tbd setup --auto --prefix=myproj
tbd create "Initial setup" --type=chore
```

### Daily Workflow

```bash
# Start of day - sync and find work
tbd sync
tbd ready

# Pick up an issue; assignee remains the accountable person
tbd start proj-a7k2

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
tbd --dry-run setup --from-beads        # Preview the one-step migration
tbd setup --from-beads                  # Read prefix, initialize, import, install surfaces
tbd stats
tbd list --all
```

Run this while the repository is uninitialized and `.beads/` still exists.
The command reads the Beads prefix unless `--prefix` overrides it, imports
`.beads/issues.jsonl` if present, and renames the whole `.beads/` directory to
`.beads-disabled/` for rollback.
It is non-interactive and can continue after a missing JSONL file or import warning, so
verify the totals and records before treating it as complete.
It does not remove `.beads-hooks/`, Cursor rules, Claude settings, or Beads text in
`AGENTS.md`; review those separately.
The old positional `tbd setup beads` command does not exist.

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

## External Tracker Integrations

`tbd integration` mirrors selected beads outward to an external tracker so people who do
not clone the repo can see the work.
Linear is the first provider; GitHub is planned.

That refers to GitHub as a *tracker tbd writes to*, and it is not the only way GitHub
reaches a bead.
A repository whose Linear workspace has Linear’s own GitHub app installed
already gets pull request linking and state automation on mirrored issues, so a merged
pull request can move its Linear issue and the next `tbd sync` carries that onto the
bead. That path needs nothing from tbd beyond the Linear integration described here.
See Step 6 of `tbd shortcut setup-linear`.

The **mirror** is one-way: beads are the source of truth and nothing is imported back,
which is what makes it safe to run from any agent at any time.
Full **bidirectional synchronization** (`tbd integration sync`) is also available and is
governed by a per-integration linking policy, described below.

Everything here is **strictly additive**: a repository without an `integrations` block
behaves exactly as before, every other tbd command is unchanged, and enabling an
integration for one project has no effect on any other repository or on collaborators
who never run `tbd integration` commands.
Links live in each bead’s `extensions` namespace, which older tbd versions preserve
untouched.

### Setup

```yaml
# .tbd/config.yml
integrations:
  on_tbd_sync: guarded # default; refuses an oversized folded run
  linear:
    enabled: true
    target:
      team_key: FIN
      project: tbd # optional: scope creates and automatic inbound discovery
    identity:
      user_map: # optional: explicit alias override for assignee identity
        jlevy: josh@example.com # UUIDs are accepted too
      state_map: # optional: choose among ambiguous Linear workflow states by type
        started: In Progress
      agent_map: # optional: delegates allowed to appear as installed Linear agents
        cyrus: 00000000-0000-4000-8000-000000000000
    policy: default # or an inline policy; see below
```

The `linear.target.team_key` and `linear.target.project` values are plain config: an
agent asked to point a repository at a different Linear team or project edits
`.tbd/config.yml` and runs `tbd integration status` to verify.
When `linear.target.project` is set, new outbound issues are filed there and automatic
inbound scans are limited to that project.
Explicit `sync --pull --external` remains an intentional override and can import a named
team issue from outside it.
`linear.identity.user_map` is an explicit alias override: a bead stores the stable alias
(`jlevy` above), and the adapter resolves its configured email or UUID at runtime.
For outbound work without an override, the adapter can reuse a stable bridge binding or
match the local handle exactly against one active Linear member by email, login, or
display name. A unique match persists only the handle, provider user ID, display name,
and binding time; raw member responses and emails do not enter bridge state.
An ambiguous or missing outbound match is reported and skipped.
Inbound identity remains closed: only a provider user represented in
`linear.identity.user_map` becomes a bead alias.
Otherwise sync leaves the bead assignee unchanged, emits a safe warning, and retains the
prior canonical bridge base so local edits stay pending.
(`select:`, the older spelling of the policy’s outbound clause, still parses and is
folded in.)

`linear.identity.agent_map` maps a tbd delegate name to an installed Linear app-user
UUID. Only a mapped delegate is published to Linear or read back as a bead delegate;
ordinary session delegates remain local and are reported as skipped.
The field write can create a Linear Agent Session, but tbd does not register an agent.

`linear.identity.state_map` maps a Linear workflow-state type (`backlog`, `unstarted`,
`started`, `completed`, `canceled`, or `duplicate`) to the state name this repository
uses.
Without an entry, tbd chooses the conventional state name or the sole state of that
type; it refuses to guess among ambiguous candidates.
Interactive `tbd integration setup` asks about ambiguities and persists the choices,
while a non-interactive or dry-run setup leaves them unresolved.
`tbd doctor` only reports the offline resolution plan; it neither calls Linear nor
persists a choice. During an applied integration setup, entries in this map are also
explicit consent to create a missing team-wide state and reorder only mapped states into
the correct type bands; without entries, setup never changes the board’s workflow
states.

**Mixing tbd versions.** Configuring an integration requires tbd 0.6.0 or later on every
machine that runs tbd in the repository.
A tbd released before 0.6.0 parses config in strip mode and silently drops the
`integrations` block the first time it rewrites `config.yml`, so the repository format
is stamped `f07` (see [Aborting a Format Upgrade](#aborting-a-format-upgrade)) and those
versions now refuse to run at all rather than quietly discarding tracker configuration.
The refusal names the upgrade command.
From `f07` onward tbd preserves config it does not recognize, so a block added by a
newer tbd survives an older one; that protects future additions, not versions already
published.

If a pre-0.6.0 tbd already stripped the block, it is recoverable: `config.yml` is
tracked, so `git checkout .tbd/config.yml` restores it, and `tbd doctor` reports the
loss by comparing the working copy against the committed version.

The block above is **committed**, so it is set up once per repository and everyone who
clones inherits it. Credentials are the opposite: `LINEAR_API_KEY` is per person and per
machine, set in the environment or in a **gitignored** `.env` at the repository root.
tbd reads it but never writes it back, and refuses to treat an unignored `.env` as
acceptable, because that is how a key gets committed.
A teammate joining a repository that already syncs therefore needs only a key—no config
edit at all.

Check that `.env` is ignored *before* writing a key into it.
For a configured integration, `status` distinguishes `not present and gitignored` from
the warning `not present and not gitignored`. When no integration is configured it is
inert and does not print the `.env` finding, so check the path directly:

```bash
git check-ignore -q .env && echo safe || echo "add .env to .gitignore first"
```

Create a personal key under Linear’s
[**Settings > Account > Security & Access**](https://linear.app/docs/api-and-webhooks#api-keys).
Full access works; a restricted key needs **Read**, **Write**, **Create issues**, and
**Create comments**, scoped to the configured team.
A workspace admin may need to enable **Settings > Administration > API > Member API
keys** first. Do not ask a user to paste the raw key into chat; they should enter it
through their local environment, secret manager, or gitignored `.env`.

`tbd shortcut setup-linear` walks through all of this, including which case you are in.

```bash
tbd integration status --offline # Shared config and local credential, no network
tbd integration status           # Also verify the key and target with Linear
```

`tbd doctor` reports the same findings.
Both are inert when nothing is enabled.

### What to sync

**Mirror the shape of the work, not the work itself.** The target is the epics someone
would ask about in a status meeting, plus whatever carries a live plan spec.

**Judge that against *open* work, not against every bead you have ever closed.** Status
gates the selection, so closed beads can never be mirrored and including them in the
denominator makes any policy look small.
Measured in this repository on 2026-08-14, the default policy selected 151 beads: about
9% of all 1,726 beads, but **52% of the 291 that were still open**. Both numbers move as
a repository grows; the second is the one that predicts what lands in the tracker.
Run `tbd --dry-run integration sync --push` for your own current count.

The default policy is *open epics, or anything whose `spec_path` points into
`specs/active/`*. Kind and spec are **alternatives**, not requirements, so both “every
open epic” and “everything with a live spec” qualify.
Status gates both, which is what makes finished work drop out on its own.
A spec archived out of `active/` stops being mirrored for the same reason.

None of this is fixed policy.
Set `kinds: []` to select purely by spec, `specs: none` to select purely by kind, or add
`labels:` to require an opt-in marker.
If the mirror stops being the thing people actually look at, it is selecting too much.

### Pushing beads outward

```bash
tbd --dry-run integration sync --push   # Preview: prints every bead id it would touch
tbd integration sync --push             # Project the policy's outbound set
```

A preview also reports why the set was selected, because a bare total cannot be checked
against intent:

```
linear: would create 799, would update 0, skipped 74, failed 0
  selected 799: 109 by kind, 690 by spec_path
  note: spec_path is inherited, so descendants of a bead with a live spec
  are selected too. Narrow with `specs: none` to mirror by kind alone.
```

That split is the number to check.
`109 by kind, 690 by spec_path` in a repository with 109 epics is recognizably wrong in
a way that `799` is not.

Every `list` selector works here too, and **overrides** the configured policy, so a
staged rollout needs no config edits:

```bash
tbd integration sync --push --bead tbd-abc1 tbd-def2   # Exactly these
tbd integration sync --push --type epic --limit 10     # Ten epics, deterministic order
tbd integration sync --push --spec plan-2026-08-10-x.md
```

The recommended way to start is to mirror a handful, look at the result in Linear, then
widen.

Mirroring is **idempotent**. Re-running updates in place rather than creating
duplicates, because the bead’s attachment is keyed on a stable `tbd://bead/<id>` URL. A
failed bead is reported and the rest still mirror.

### Bulk-change safety

A mis-set selector can turn “a couple of epics” into “every bead in the repo”, which is
tedious to undo by hand.
Runs above **20 creates** or **40 updates** need affirmation:

- On a terminal, you are asked to confirm.
- With no terminal (an agent, or CI), the run is **refused** rather than prompting, so
  it neither hangs nor silently makes a large change.
  Pass `--yes` to proceed, or narrow with `--bead` / `--limit`.

`--dry-run` is exempt: it writes nothing, and previewing should be easy.

### What lands in the tracker

Linear has no custom fields, so each mirrored issue carries:

- A managed `⟦tbd⟧` … `⟦/tbd⟧` region in the description with the bead id, status,
  priority, child counts, and a link to the plan spec.
  **Only that region is rewritten**, so prose a human adds around it survives.
  tbd also recognizes the former HTML-comment delimiters and upgrades them on the next
  outbound sync; malformed or mixed delimiters are reported and left untouched.
- An attachment keyed `tbd://bead/<id>` holding the full bead field set as structured
  metadata.

The bead’s side of the link is stored under `extensions.linear` rather than as a
top-level field, so a tbd that predates this feature reads and rewrites a linked bead
without disturbing it.
`tbd show` displays it as part of `extensions`. Because the namespace key is the
provider, a bead can carry a Linear link and a GitHub link at the same time, and can
never carry two of either.
- An attachment linking the plan spec, as a **permalink to the branch that actually has
  it**.

If a mirrored issue moves to another team, Linear renumbers it (identifiers are
team-scoped, so `FIN-11` becomes `TBD-4`). The link survives because it is keyed on the
issue UUID. The bead continues to store only that UUID and `linked_at`; the next mirror
run refreshes `external_key` and `external_url` in the provider bridge record.
Specs live on the branch that authored them, so a link built from the bare path would
404 depending on who follows it.

**Bead labels are not pushed as tracker labels by default.** A repository can carry a
hundred-plus distinct bead labels, and creating one Linear label for each pollutes a
team namespace that other projects and people share.
The labels are mirrored as structured data in the bead attachment regardless, so setting
`linear.labels.mirror: prefixed` only buys the ability to filter by them inside Linear;
this form prefixes them with `tbd:` so they stay identifiable and can be removed in
bulk. Set `linear.labels.create: all` as well if tbd may create missing mirrored labels.
Its safer `tbd` default creates only tbd-owned infrastructure labels.
tbd’s own status carriers (`tbd:paused`, `tbd:blocked`, `tbd:deferred`) are always
pushed, because they encode status Linear has no workflow state for.

New outbound sub-issues are mirrored to `linear.policy.outbound.max_nesting` levels
(effective default 2), and deeper new beads are skipped and reported.
Existing links and inbound Linear sub-issues always retain their true parent
relationship; the presentation limit never flattens source data.
Linear’s data model nests without limit, but its views flatten past about two levels, so
deeper structure is better left in beads where `tbd dep` renders it.

### The linking policy

`policy` answers three directional questions, as a preset name (`default`) or inline:

```yaml
policy:
  outbound: # when a bead should CREATE a tracker issue
    kinds: [epic]
    statuses: [open, in_progress, blocked]
    specs: active
  inbound: # when a tracker issue should BECOME a bead
    mode: report # off | report | auto
    as_kind: task
  field_sync: # how a LINKED pair's fields and comments flow
    fields:
      title: merge # merge | local | remote
      description: merge
      status: merge
      priority: merge
      labels: local
      assignee: local
    comments: two_way # two_way | inbound | outbound | off
    tie_break: newest # both-sides-changed fallback: newest | local | remote
```

The policy is only a default — explicit `integration sync --push` selectors,
`integration sync --pull --external`, and `integration link` always override it — and
linking is separate from syncing: once a pair is linked, integration sync reconciles it
until it is unlinked.

### Full synchronization

```bash
tbd --dry-run integration sync   # Preview the identical computation, write nothing
tbd integration sync             # Both directions: reconcile every linked pair
tbd integration sync --push      # Outbound only: project beads to the tracker
tbd integration sync --pull      # Inbound only: writes nothing to the tracker
tbd integration sync --pull --external FIN-123 # Create one bead, regardless of policy
tbd integration sync --yes       # Affirm a run over the bulk thresholds
```

Within `tbd integration sync`, **bare is both directions, `--push` is outbound only, and
`--pull` is inbound only**. `--pull` performs **no external writes at all**, including
replay of a pending outbound journal, so it is the safe way to take tracker changes
without touching the tracker.
A suppressed outbound change stays pending and the next full sync pushes it.
Top-level `tbd sync --push` and `--pull` select the issue Git surface and exclude
trackers unless `--integrations` is also explicit.
Thus `tbd sync --integrations --push` performs the outbound-only tracker projection as
well as the issue push; it does not pull tracker fields or replay the bidirectional
engine. Every inbound attachment claim is journaled before provider I/O; a full sync
removes the intent only after the upsert succeeds.
Under `--pull`, attachment claims and conflict notices remain local until the next full
sync posts them idempotently.
Outbound selectors (`--bead`, `--type`, `--status`, `--label`, `--spec`, and `--limit`)
are valid only with `--push`. Bare sync deliberately reconciles every linked pair;
supplying a push-only selector without `--push` is a usage error rather than a silently
broader run.

One full run performs, in order: replay of any interrupted prior run (external writes
are journaled before they happen, so a crash converges instead of duplicating), a pull
of recently changed tracker items, a per-field three-way reconciliation of every linked
pair against its recorded base (one-sided changes flow; both-sided changes fall to
`tie_break`, archive the losing value to the attic, and post a resolvable conflict
comment on the tracker item), comment flows per `field_sync.comments`, and finally the
policy’s outbound and inbound clauses for unlinked work on both sides.
The attic entry is written before either side is overwritten, and its exact path plus
the conflict comment’s client UUID ride the same write-ahead journal; a crash can
neither advertise a missing archive nor duplicate the comment on replay.
Two runs in a row with no changes report `nothing to do` — that is the expected steady
state, and anything else is worth reading.

Intent recovery is fail-closed.
A missing journal directory is an empty queue, but a present journal that is unreadable,
malformed, or invalid stops synchronization with the filename before any provider write.
Repair or recover that tracked file rather than deleting it blindly: it may contain the
stable client UUID preventing a duplicate item.

Cosmetic tracker rewrites (bullet style, list spacing, URL auto-linkification) are
normalized before comparison, so they never count as remote edits.
Priorities P3 and P4 both map to Linear’s “Low”; a P4 bead stays P4 rather than
oscillating. An archived or deleted tracker item marks its link **orphaned** and is
reported — the bead is never deleted or closed automatically.
An unfamiliar Linear workflow-state type maps conservatively to `open` and produces a
visible sync warning naming the provider item and unknown type; it never crashes the run
or silently invents a tbd status.
The bulk thresholds count both directions: creates and updates to the tracker AND
inbound creations and updates to beads.

### One command at session end

Plain `tbd sync` covers **every surface** — docs, issues, and any enabled tracker — so
an agent closing a session runs one command and the repository is current:

```bash
tbd sync                  # Docs, issues, and trackers
tbd sync --docs           # Only docs
tbd sync --issues         # Only issues
tbd sync --integrations   # Only trackers
tbd sync --push           # Push issues only
tbd sync --integrations --push # Push issues plus enabled trackers
```

**Surfaces run independently and their failures roll up.** An expired tracker credential
does not stop docs or issues from syncing; a git remote that is down does not stop docs.
Each surface is attempted, each failure is reported with its surface name, and the exit
code is non-zero if any failed — while everything that worked is still saved.
This includes provider operations returned as per-item failures, not only thrown network
errors. An unreadable or invalid integration config also fails closed instead of making
the tracker surface appear unconfigured.

The tracker run happens between the git pull and push, so it reconciles bead state that
already includes other machines’ work and its own writes ride the same push out.
If the git phase fails before reaching it, the tracker run still happens afterward and
records to the sync branch; the next successful push carries it.
A git problem delays tracker work rather than losing it.

`integrations.on_tbd_sync` decides how an enabled integration takes part in plain
`tbd sync`:

| Mode | Runs in `tbd sync` | Above the bulk thresholds |
| --- | --- | --- |
| `guarded` (default) | yes | refuses, and says how to proceed |
| `auto` | yes | proceeds |
| `report` | yes, as a dry run | nothing is written |
| `off` | no | run `tbd integration sync` by hand |

Enabling an integration is the opt-in to folding it in, so there is no second off-switch
that would let a configured tracker silently drift.
The default is `guarded` rather than `auto` because opting into a mirror is not the same
as opting into a write of unbounded size.
The two differ only above the bulk thresholds, so an ordinary session-end sync of a few
changed beads behaves identically; a first sync that would create hundreds of issues
stops and tells you how to look at it.
`integrations.sync_on_tbd_sync` is the retired pre-f08 boolean, still read: `true` maps
to `auto`, `false` to `off`.

### Linking, unlinking, and comments

```bash
tbd integration link tbd-abc1 FIN-123           # Bind a bead to an existing item
tbd integration link tbd-abc1 FIN-123 --take remote  # Adopt its values when they differ
tbd integration sync --pull --external FIN-124  # Create a bead from exactly this item
tbd integration unlink tbd-abc1                 # Sever; nothing is deleted anywhere
tbd integration comment tbd-abc1 "Blocked on the API quota decision."
```

`link` and explicit inbound creation refuse when the item is already linked locally or
carries another repository’s `tbd://bead/…` attachment (two bead writers make a
ping-pong machine).
`--force` is the explicit override for a verified stale remote claim;
the probe prevents ordinary sequential duplication but is not an atomic distributed
lock. When the two sides differ, `link` requires a stance: `--take local` pushes the
bead’s values on the next sync, `--take remote` adopts the item’s values now.
Without a terminal and without `--take`, it refuses rather than guessing.
Both manual linking and inbound creation persist the local link/base and an idempotent
attachment intent before attempting the remote claim, so an interrupted claim upsert
replays without duplicating the bead or the link.
`sync` and `doctor` also scan links already present from an older migration, import, or
hand edit.
If multiple beads name one external item, every holder is reported and none of
them is replayed, pulled, pushed, or base-advanced until `unlink` leaves exactly one;
unrelated links continue normally.
Pending writes for the ambiguous item are discarded; the durable surviving bead re-plans
current state after repair, preventing a stale former holder from writing after unlink.

Every pending provider write is tied to its bead and exact provider id.
Before replay, tbd checks that the relationship still exists; comment writes also
require the exact unpushed local entry.
A new outbound item records its client UUID as a provisional link with the journal
before any network call, so crash recovery cannot confuse live creation with work
canceled by unlink.
While that exact create journal remains, tbd still checks the item: a
live item reconciles normally even if attachment or managed-content work remains, while
a confirmed absence is pending rather than incorrectly orphaned, including under
`--pull`. If the item is live but follow-up work failed before its first bridge record,
the journaled creation values are the base; tracker edits made in that interval still
pull or conflict instead of being mistaken for outbound bead changes.
Filling in the created item’s key and URL preserves comments and other provider state
already recorded beside the link.
`unlink` removes matching pending writes first, clears the bead link second, and deletes
the bridge record last.
If cancellation cannot complete, the link remains intact and a repeated unlink can
safely finish; stale journals merged from another machine are consumed without touching
the former provider item.

`integration comment` works offline: the entry is queued immediately inside the linked
provider namespace on the bead.
The next `tbd integration sync` attempts delivery.
Replaying the same durable journal intent is idempotent, but independent stale replicas
do not yet share a destination-scoped delivery key and can duplicate a provider post
(`tbd-6vg5`). Inbound comments are folded into the bead the same way — append-only,
identified by the tracker’s immutable comment id, author recorded as a display name
only. Comment union is scoped to the provider issue named by the namespace’s nonempty
`id`. Two legacy namespaces that both omit `id` may union for compatibility.
A different ID, or a known ID paired with a missing, empty, or malformed ID, keeps the
selected namespace and archives the complete loser; a pending comment from an old link
cannot be posted to its replacement.
For entries with a provider `id`, a body over 10,000 JavaScript UTF-16 code units
becomes its first 10,000 units plus a truncation marker.
Only the newest 50 provider-ID entries retain a body, possibly truncated; older entries
retain all identity and metadata fields, including `local_id` when present, with
`body: ''`. Pending `local_id`-only entries remain full and outside both limits until a
provider ID lands; the tracker remains the system of record for long threads.
Comment edits, deletion, reactions, and thread shape are not synchronized.

This is provider-link storage, not a native comment on an arbitrary bead.
Current f08 releases do not provide `tbd comment add`, `list`, or `show`, and setup does
not create a native `comments/` tree.
The candidate native model has internal, dormant record/storage and inventory/transition
foundations, but its Git guards, recovery paths, format activation, commands, and
provider cutover remain future work.
See the
[native comment architecture](https://github.com/jlevy/tbd/blob/main/docs/project/architecture/current/arch-native-comments.md)
for the exact boundary.

The authoritative support/boundary matrix and its code/test traceability live in the
active external-tracker integration plan.
Maintainers run the API-driven live gate in `tests/qa/linear-integration.qa.md`; its
stable scenarios are the compatibility contract that a GitHub driver must reuse rather
than redesign.

### For agents: setting up and synchronizing Linear

**The guided walkthrough is `tbd shortcut setup-linear`.** It detects which of the cases
below applies and covers only that one.
Run it instead of improvising a setup sequence.

The distinction that drives everything: **configuration is shared, credentials are
personal.** The `integrations` block lives in `.tbd/config.yml`, which is committed, so
everyone who clones the repository inherits the team, project, and policy.
`LINEAR_API_KEY` lives in the environment or a gitignored `.env` and is never committed,
so every person and agent supplies their own.

`tbd integration status --offline` separates the two without a network call, and its
output is how you tell the cases apart:

| `status` shows | Case | What is needed |
| --- | --- | --- |
| `No external tracker integrations are configured.` | First-time repository setup | Config, then a key |
| `✓ enabled` / `✓ target`, `✗ credential` | **Joining a repo the team already set up** | Only your own key |
| all `✓` | Working | Nothing |

#### Joining a repository that already syncs

The common case on a team, and the one that needs the least work.
The `integrations` block arrived with the clone, and the bead↔issue links live in the
beads themselves on the sync branch, so they arrived too.
Supply a key and run a full sync:

```bash
tbd integration status --offline       # Confirms config is present, credential is not
# add LINEAR_API_KEY to a gitignored .env, then:
tbd --dry-run integration sync         # Preview
tbd sync                               # Pull beads, reconcile Linear, then push
```

Do **not** re-run first-time setup here: editing `linear.target.team_key` or
`linear.target.project` points this clone at a different place than the rest of the
team. Do not reach for `sync --push` either—the links already exist, so the full `sync`
is both correct and safer.
Plain `tbd sync` first pulls the current team bead state, reconciles the tracker in
place, and publishes the resulting state rather than projecting stale local values over
Linear. If the shared config deliberately has `integrations.on_tbd_sync: off`, preserve
it: run `tbd sync` to update bead state, preview and run `tbd integration sync`, then
run `tbd sync` again to publish the result.
Do not change a team-level override merely to simplify one contributor’s setup.

#### First-time setup for a repository

Add the `integrations:` block shown under [Setup](#setup) with the user’s team key (and
project, if they name one), add a key, verify, then stage the initial projection instead
of creating every issue at once:

```bash
tbd integration status                             # 1. Config and key resolve; team exists
tbd --dry-run integration sync --push              # 2. Preview the outbound set
tbd integration sync --push --type epic --limit 5  # 3. A handful; look at them in Linear
tbd integration sync --push                        # 4. Widen once the shape reads well
tbd sync                                           # 5. Pull and reconcile from then on
```

The default policy mirrors open epics and anything with an active plan spec — the right
starting point for “track our specs and major work”.
Re-running any of these is safe: mirroring is idempotent and sync converges to
`nothing to do`.

## Troubleshooting

### Sync Issues

```bash
# Check docs and issue Git status
tbd sync --status

# Diagnose and repair sync state (`--force` is currently an inert compatibility flag)
tbd doctor
tbd doctor --fix
```

### ID Not Found

If you get “Issue not found” errors, the error itself suggests near-miss IDs (“Did you
mean: …?”) when one is close.
To look an ID up directly:

```bash
# Search by partial or full ID (IDs are a searchable field)
tbd search a7k2

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
| Writer epoch | `$GIT_COMMON_DIR/tbd/data-sync.epoch` | machine-local, not in git | every shared data writer | none; the next writer replaces it |
| Forked docs (f05) | `docs/tbd/`, `.tbd/doc-forks/` | tracked once committed | only `tbd docs fork` | `git checkout --`/`git revert` if committed; delete if never committed |
| Integrations config (f07) | `.tbd/config.yml` → `integrations:` | tracked | only integration setup, never the migration | `git checkout --`/`git revert`; reverting the stamp alone leaves the block intact |
| Docs cache | `.tbd/docs/` | gitignored | doc sync (unchanged by migration) | none needed; always safe to delete and re-sync |
| Issue data | `tbd-sync` branch and `$GIT_COMMON_DIR/tbd/data-sync-worktree/` | git branch | **never touched by migration** | none needed; the worktree re-materializes from the branch |

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
- **Aborting f07 with a tracker configured re-opens the loss it prevents.** The stamp is
  what stops a pre-0.6.0 tbd from stripping the `integrations` block; on f06 that
  version runs again and drops the block on its next config write.
  If you must abort while an integration is configured, keep the block committed so
  `git checkout .tbd/config.yml` restores it, and treat `tbd doctor`’s report of a
  dropped block as the signal to re-upgrade.

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
