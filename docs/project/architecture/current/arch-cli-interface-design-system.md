# CLI Interface Design System Architecture

Last updated: 2026-01-17

Maintenance: When revising this doc you must follow instructions in
@shortcut-revise-architecture-doc.md.

## Overview

This document defines the universal design system for all CLI output in tbd.
It ensures consistent output structure, formatting, colors, and conventions across all
commands and output modes.

**Scope**: All CLI output including success messages, errors, warnings, data display,
verbose/debug logging, and progress indicators.

**Related Documents:**

- [plan-2026-01-17-cli-output-design-system.md](../specs/active/plan-2026-01-17-cli-output-design-system.md)
  \- Implementation plan
- [output.ts](packages/tbd-cli/src/cli/lib/output.ts) - OutputManager implementation
- [context.ts](packages/tbd-cli/src/cli/lib/context.ts) - Command context and modes

## Terminology

| Term | Definition |
| --- | --- |
| **Output Mode** | The combination of flags that control output format and verbosity |
| **Semantic Color** | A color with consistent meaning across all commands |
| **Display ID** | Human-friendly short ID (e.g., `bd-a1b2`) |
| **Internal ID** | Full ULID-based ID (e.g., `is-01hx5zzkbk...`) |

## Output Modes

**File(s)**: `packages/tbd-cli/src/cli/lib/context.ts`

tbd supports multiple output modes that can be combined:

### Mode Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  --quiet              Only errors and warnings (stderr)         │
├─────────────────────────────────────────────────────────────────┤
│  (default)            + Success, info, data output              │
├─────────────────────────────────────────────────────────────────┤
│  --verbose            + Verbose messages (operations, timing)   │
├─────────────────────────────────────────────────────────────────┤
│  --debug              + Debug messages (internal state, IDs)    │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Flags

| Flag | Effect |
| --- | --- |
| `--quiet` | Suppress success and info messages |
| `--verbose` | Show operation progress and timing |
| `--debug` | Show internal IDs, paths, and state |
| `--json` | Output data as JSON, messages as JSON to stderr |
| `--color=auto\|always\|never` | Control colorization |
| `--dry-run` | Show what would happen without doing it |

### Mode Combinations

| Mode | Data | Success | Info | Warning | Error | Debug |
| --- | --- | --- | --- | --- | --- | --- |
| Default | stdout | stdout | stdout | stderr | stderr | - |
| `--quiet` | stdout | - | - | stderr | stderr | - |
| `--verbose` | stdout | stdout | stdout | stderr | stderr | stderr |
| `--debug` | stdout | stdout | stdout | stderr | stderr | stderr |
| `--json` | JSON | - | - | JSON | JSON | - |
| `--json --verbose` | JSON | - | - | JSON | JSON | JSON |

## Output Channels

**File(s)**: `packages/tbd-cli/src/cli/lib/output.ts`

### Channel Rules

| Channel | Purpose | Format |
| --- | --- | --- |
| **stdout** | Primary data, success messages, info | Text or JSON |
| **stderr** | Warnings, errors, debug, progress | Always text (or JSON in `--json` mode) |

### Why stderr for Progress/Debug?

Progress indicators and debug output go to stderr because:
1. They don’t corrupt stdout when piping to other tools
2. They can be suppressed independently
3. They’re ephemeral (spinners, progress bars)

### OutputManager Methods

```typescript
// Primary data output - stdout, respects --json
output.data(data, textFormatter)

// Success confirmation - stdout, not in json/quiet
output.success("Created issue bd-a1b2")

// Informational - stdout, not in json/quiet
output.info("Syncing with remote...")

// Warning - stderr, always shown
output.warn("Remote branch not found")

// Error - stderr, always shown
output.error("Failed to read issue", error)

// Debug - stderr, only in verbose/debug mode
output.debug("Loading 42 issues from cache")

// External command - stderr, only in verbose mode
output.command("git", ["fetch", "origin", "tbd-sync"])

// Dry-run indicator - stdout, only in dry-run mode
output.dryRun("Would create issue", { title: "..." })

// Progress spinner - stderr, only in TTY mode
output.spinner("Syncing...")
```

## Color System

**File(s)**: `packages/tbd-cli/src/cli/lib/output.ts`

### Semantic Colors

Colors have consistent meanings across all commands:

| Semantic | Color | ANSI | Usage |
| --- | --- | --- | --- |
| `success` | Green | 32 | Successful operations, positive states |
| `error` | Red | 31 | Errors, blocked states, critical items |
| `warn` | Yellow | 33 | Warnings, high priority, caution |
| `info` | Blue | 34 | Informational, paths, links |
| `id` | Cyan | 36 | All IDs (issue, label, reference) |
| `label` | Magenta | 35 | Labels, tags, categories |
| `dim` | Gray | 90 | Secondary info, metadata, disabled |
| `bold` | Bold | 1 | Titles, headers, emphasis |

### Usage Example

```typescript
const colors = output.getColors();

console.log(colors.success(`Created issue ${colors.id('bd-a1b2')}`));
console.log(colors.error('Failed to sync'));
console.log(colors.dim(`Updated 2 hours ago`));
```

### Status Colors

| Status | Color | Rationale |
| --- | --- | --- |
| `open` | Blue (info) | Neutral, awaiting action |
| `in_progress` | Green (success) | Active, positive progress |
| `blocked` | Red (error) | Needs attention, problem |
| `deferred` | Gray (dim) | Low priority, background |
| `closed` | Gray (dim) | Complete, historical |

### Priority Colors

| Priority | Color | Rationale |
| --- | --- | --- |
| P0 (Critical) | Red (error) | Urgent, demands attention |
| P1 (High) | Yellow (warn) | Important, elevated |
| P2-P4 | Default | Normal priority |

### Priority Display Format

**Rule**: Always display priorities with the “P” prefix: P0, P1, P2, P3, P4.

**Display Examples:**
```
ID          PRI  STATUS        TITLE
bd-a1b2     P0   blocked       Fix authentication timeout
bd-c3d4     P1   in_progress   Add dark mode support
bd-e5f6     P2   open          Update documentation
```

**Parsing Rules:**
- Accept both formats on input: `P1` or `1` → P1
- Case-insensitive: `p1`, `P1`, `1` all parse to P1
- Invalid values should error with clear message

**Implementation:**
```typescript
// In a shared utility (e.g., lib/priority.ts)

/** Format priority for display - always includes P prefix */
export function formatPriority(priority: number): string {
  return `P${priority}`;
}

/** Parse priority from user input - accepts "P1" or "1" */
export function parsePriority(input: string): number {
  const normalized = input.toUpperCase().replace(/^P/, '');
  const num = parseInt(normalized, 10);
  if (isNaN(num) || num < 0 || num > 4) {
    throw new Error(`Invalid priority: ${input}. Use P0-P4 or 0-4.`);
  }
  return num;
}
```

**Rationale:**
- Consistent display reduces cognitive load
- “P” prefix makes priorities visually distinct from other numbers
- Flexible parsing improves UX (users don’t need to remember exact format)
- Matches common conventions (P0/P1/P2 terminology)

### Color Control

```bash
# Auto-detect based on TTY (default)
tbd list

# Force colors (useful for piping to less -R)
tbd list --color=always

# Disable colors
tbd list --color=never

# Environment variable override
NO_COLOR=1 tbd list
```

## Message Formatting

### Icons and Prefixes

**Standard Icons:**

| Icon | Meaning | When to Use |
| --- | --- | --- |
| `✓` | Success/Complete | Operation completed successfully |
| `✗` | Error/Failure | Operation failed |
| `⚠` | Warning/Caution | Non-fatal issue, needs attention |
| `•` | Bullet/Item | List items |
| `⠋⠙⠹...` | Progress | Spinner animation for in-progress operations |

**Text Prefixes:**

| Prefix | Meaning | When to Use |
| --- | --- | --- |
| `[debug]` | Debug info | Internal state in verbose/debug mode |
| `[DRY-RUN]` | Dry run | Simulated action, no changes made |
| `>` | Command | External shell command being executed |

**Message Prefixes:**

| Type | Format | Example |
| --- | --- | --- |
| Success | `✓ {message}` | `✓ Created issue bd-a1b2` |
| Error | `✗ {message}` | `✗ Issue not found: bd-xyz` |
| Warning | `⚠ {message}` | `⚠ Remote branch not found` |
| Debug | `[debug] {message}` | `[debug] Cache hit for bd-a1b2` |
| Dry-run | `[DRY-RUN] {message}` | `[DRY-RUN] Would create issue` |
| Command | `> {command}` | `> git fetch origin tbd-sync` |

**Icon Rules:**
- Always use `✓` for successful completion (green)
- Always use `✗` for errors (red)
- Always use `⚠` for warnings (yellow)
- Never mix icons (e.g., don’t use `✔` or `√` instead of `✓`)
- Icons appear at start of line, followed by space

### Success Messages

```
✓ {Action performed} {target}

Examples:
✓ Created issue bd-a1b2
✓ Updated 3 issue(s)
✓ Synced: pulled 2, pushed 1
✓ Already up to date
```

### Error Messages

```
✗ {What failed}
  {Why it failed, if known}
  {How to fix, if actionable}

Examples:
✗ Issue not found: bd-xyz
  The ID may be incorrect or the issue may have been deleted.

✗ Failed to sync with remote
  Could not connect to origin (timeout after 30s)
  Check your network connection and try again.

✗ Not a tbd repository
  Run 'tbd init' or 'tbd import --from-beads' first.
```

### Warning Messages

```
⚠ {Potential issue}
  {Context or suggestion}

Examples:
⚠ Remote branch not found (will be created on push)
⚠ 3 orphaned dependency reference(s) found
  Run 'tbd doctor --fix' to clean up.
```

### Debug Messages

```
[debug] {Internal operation details}

Examples:
[debug] Loading 42 issues from .tbd/data-sync-worktree
[debug] Cache miss for bd-a1b2, reading from disk
[debug] Git command: git fetch origin tbd-sync
[debug] Resolved bd-a1b2 -> is-01hx5zzkbkactav9wevgemmvrz
```

## Data Formatting

### Tables

```
ID          PRI  STATUS        TITLE
bd-a1b2     P0   blocked       Fix authentication timeout
bd-c3d4     P1   in_progress   Add dark mode support
bd-e5f6     P2   open          Update documentation

3 issue(s)
```

**Rules:**
- Header row in dim color
- Column widths consistent within table
- Priorities always as P0-P4 (never raw numbers)
- Left-align text columns (ID, PRI, TITLE, STATUS)
- Count summary at bottom in dim color

### Lists

```
• Item one
• Item two
  - Sub-item A
  - Sub-item B
• Item three

3 item(s)
```

**Rules:**
- Use `•` for top-level items
- Use `-` for sub-items
- 2-space indent per level

### IDs

```
# Default mode
bd-a1b2

# Debug mode (--debug)
bd-a1b2 (is-01hx5zzkbkactav9wevgemmvrz)
```

**Rules:**
- Always show display ID in normal output
- Show internal ID only in debug mode
- Color all IDs with cyan (`id` semantic)

### Priorities

```
# Display format (always use this)
P0, P1, P2, P3, P4

# Never display as raw numbers
0, 1, 2, 3, 4  ← WRONG
```

**Rules:**
- Always display with “P” prefix: P0, P1, P2, P3, P4
- Never output raw numbers in any context (tables, details, JSON text fields)
- Use `formatPriority()` utility for all display
- Color P0 red (error), P1 yellow (warn), P2-P4 default

**Parsing (user input):**
- Accept both formats: `P1` or `1` → P1
- Case-insensitive: `p1`, `P1`, `1` all valid
- Use `parsePriority()` utility for all input

### Counts

```
3 issue(s)
1 file(s) changed
0 conflict(s)
```

**Rules:**
- Use `(s)` suffix for proper pluralization
- Show in dim color
- Place at end of output section

### Empty States

```
No issues found
No results matching "search term"
```

**Rules:**
- Use standard “No {items} found” pattern
- Use `info()` method (blue color)
- Don’t show table headers for empty results

### Timestamps

| Context | Format | Example |
| --- | --- | --- |
| JSON output | ISO 8601 | `2026-01-17T14:30:00Z` |
| Recent (< 24h) | Relative | `2 hours ago` |
| Recent (< 7d) | Day + time | `Monday at 2:30 PM` |
| Older | Full date | `Jan 15, 2026` |

## Verbose vs Debug Mode

### Verbose Mode (`--verbose`)

Shows **operational progress** that helps users understand what’s happening:

```bash
$ tbd sync --verbose
⠋ Syncing with remote...
> git fetch origin tbd-sync
> git rev-list --count origin/tbd-sync..tbd-sync
Loading 42 issues from local cache
Comparing with remote (3 new, 1 modified)
> git push origin tbd-sync
✓ Synced: sent 2 new, 2 updated
```

**What to include:**
- **External commands**: Every shell command (git, etc.)
  with `> ` prefix
- Network operations (fetch, push, pull)
- File operations (reading, writing)
- Performance timing
- Operation progress
- Stack traces on errors

### External Command Display

**Rule**: In verbose mode, always display every external command being executed.

**Format:**
```
> {command} {args...}
```

**Examples:**
```bash
> git fetch origin tbd-sync
> git rev-list --count origin/tbd-sync..tbd-sync
> git push origin tbd-sync
> git status --porcelain
```

**Rules:**
- Use `> ` prefix (dim color) to indicate shell command
- Show the full command as it would be typed
- Output to stderr (like other verbose output)
- Only show in verbose mode, not in quiet/default mode
- In debug mode, also show command output/results

**Implementation:**
```typescript
// In OutputManager
command(cmd: string, args: string[]): void {
  if (this.ctx.verbose && !this.ctx.json) {
    const fullCmd = [cmd, ...args].join(' ');
    console.error(this.colors.dim(`> ${fullCmd}`));
  }
}
```

**Rationale:**
- Users can see exactly what tbd is doing under the hood
- Helpful for debugging sync issues or unexpected behavior
- Commands can be copy-pasted for manual execution
- Mirrors familiar patterns from make, npm, and other build tools

### Debug Mode (`--debug`)

Shows **internal state** for troubleshooting:

```bash
$ tbd show bd-a1b2 --debug
[debug] Resolved bd-a1b2 -> is-01hx5zzkbkactav9wevgemmvrz
[debug] Reading /path/to/.tbd/data-sync-worktree/.tbd/data-sync/issues/is-01hx5zzkbkactav9wevgemmvrz.md
[debug] Cache hit, using memoized issue
---
id: bd-a1b2 (is-01hx5zzkbkactav9wevgemmvrz)
...
```

### Git Stat Log in Debug Mode

**Rule**: In `--debug` mode, after any git push/pull operation, show the git log with stat for the commits that were just synced.

```bash
$ tbd sync --debug
⠋ Syncing with remote...
> git fetch origin tbd-sync
> git push origin tbd-sync
✓ Synced: sent 1 updated

[debug] Commits synced:
commit ee88823f61a0d224371fadaff177a8b0b54b04b1 (origin/tbd-sync, tbd-sync)
Author: Joshua Levy <joshua@cal.berkeley.edu>
Date:   Sat Jan 17 15:50:56 2026 -0800

    tbd sync: 2026-01-17T23-50-56 (1 file)

 .tbd/data-sync/issues/is-01kf5zyg8jgkn9s6c1z1r1n6sn.md | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

**Implementation:**
```bash
# After push, show commits that were pushed
git log --stat origin/tbd-sync@{1}..origin/tbd-sync

# After pull, show commits that were pulled
git log --stat HEAD@{1}..HEAD
```

**Rationale:**
- Provides full visibility into exactly what changed
- Shows file-level diff stats (insertions/deletions)
- Helpful for debugging sync issues
- Can verify correct issues were synced

**What to include:**
- Internal ID mappings
- Full file paths
- Git commands being executed
- Cache hit/miss status
- Schema validation details
- Raw API responses

## JSON Mode

**File(s)**: `packages/tbd-cli/src/cli/lib/output.ts`

### Data Output

```bash
$ tbd list --json
[
  {
    "id": "bd-a1b2",
    "internalId": "is-01hx5zzkbkactav9wevgemmvrz",
    "priority": 0,
    "status": "open",
    "kind": "bug",
    "title": "Fix authentication timeout"
  }
]
```

### Error Output

```bash
$ tbd show bd-invalid --json
{
  "error": "Issue not found: bd-invalid",
  "details": "No issue with ID bd-invalid exists"
}
```

### Warning Output

```bash
$ tbd sync --json 2>&1
{
  "warning": "Remote branch not found, will be created on push"
}
{"pulled": 0, "pushed": 3, "conflicts": 0}
```

**Rules:**
- Data goes to stdout as JSON array or object
- Errors go to stderr as JSON object with `error` key
- Warnings go to stderr as JSON object with `warning` key
- No color codes in JSON mode
- All fields use camelCase

## Progress Indicators

### Spinners

```
⠋ Syncing with remote...
⠙ Syncing with remote...
⠹ Syncing with remote...
```

**Rules:**
- Only show in TTY mode
- Output to stderr (don’t corrupt stdout)
- Clear line on completion
- No spinners in quiet/json modes

### Progress Updates

```
⠋ Processing 1 of 100 issues...
⠙ Processing 42 of 100 issues...
✓ Processed 100 issues
```

**Rules:**
- Update message in-place (same line)
- Show final count on completion
- Replace spinner with success/error prefix

## Sync Operations

### Sync vs Local Operations

Commands must clearly distinguish between local-only changes and sync operations:

| Operation Type | Indicator | Example |
| --- | --- | --- |
| Local only | Immediate success | `✓ Updated issue bd-a1b2` |
| With sync | Progress → Success | `⠋ Syncing...` → `✓ Synced: ...` |

**Rule**: Any command that touches the network must:
1. Show immediate progress indicator when sync starts
2. Show completion message when sync finishes

**Example flow:**
```bash
$ tbd update bd-a1b2 --status=closed
✓ Updated issue bd-a1b2
⠋ Syncing...
✓ Synced: sent 1 updated

$ tbd create --title="New feature" --type=feature
✓ Created issue bd-c3d4
⠋ Syncing...
✓ Synced: sent 1 new
```

### Sync Summary Format

**Rule**: Sync summaries must show meaningful tallies of what changed.

**Format:**
```
✓ Synced: sent {summary}, received {summary}
```

**Tallies to track:**

| Direction | Metric | Meaning |
| --- | --- | --- |
| Sent (push) | `new` | Issues created locally, pushed to remote |
| Sent (push) | `updated` | Issues modified locally, pushed to remote |
| Sent (push) | `deleted` | Issues deleted locally, pushed to remote |
| Received (pull) | `new` | Issues created remotely, pulled to local |
| Received (pull) | `updated` | Issues modified remotely, pulled to local |
| Received (pull) | `deleted` | Issues deleted remotely, pulled to local |

**Examples:**
```bash
# Simple case - one issue updated locally
✓ Synced: sent 1 updated

# Created new issue
✓ Synced: sent 1 new

# Pull from remote with changes
✓ Synced: received 2 new, 1 updated

# Bidirectional sync
✓ Synced: sent 1 updated, received 3 new

# Nothing to sync
✓ Already in sync

# Multiple changes
✓ Synced: sent 2 new, 1 updated, received 1 deleted
```

**JSON format:**
```json
{
  "synced": true,
  "sent": { "new": 2, "updated": 1, "deleted": 0 },
  "received": { "new": 0, "updated": 0, "deleted": 0 }
}
```

**Summary formatting rules:**
- Omit zero counts (don't say "sent 0 new")
- Use singular/plural correctly: "1 new" vs "2 new"
- Order: new → updated → deleted
- Separate sent/received with comma if both present
- Use "Already in sync" when nothing changed

### Sync Progress Visibility

**Rule**: Never leave the user waiting without feedback.

**Problem:**
```bash
$ tbd sync
# ... 3 seconds of silence ...
✓ Synced: sent 1 updated
```

**Solution:**
```bash
$ tbd sync
⠋ Syncing with remote...
✓ Synced: sent 1 updated
```

**Implementation:**
- Start spinner immediately when sync begins
- Update spinner message for different phases if sync is long
- Replace spinner with final status on completion

## Implementation

### Key Components

#### 1. OutputManager

**File(s)**: `packages/tbd-cli/src/cli/lib/output.ts`

Central class for all output operations:

```typescript
export class OutputManager {
  // Primary data output
  data<T>(data: T, textFormatter?: (data: T) => void): void

  // Message methods
  success(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string, err?: Error): void
  debug(message: string): void
  dryRun(message: string, details?: object): void

  // Verbose mode
  command(cmd: string, args: string[]): void  // Show external command being run

  // Progress
  spinner(message: string): Spinner

  // Colors
  getColors(): ColorFunctions
}
```

#### 2. Priority Utilities

**File(s)**: `packages/tbd-cli/src/lib/priority.ts`

Format and parse priorities consistently:

```typescript
/** Format priority for display - always includes P prefix */
export function formatPriority(priority: number): string {
  return `P${priority}`;
}

/** Parse priority from user input - accepts "P1" or "1" */
export function parsePriority(input: string): number {
  const normalized = input.toUpperCase().replace(/^P/, '');
  const num = parseInt(normalized, 10);
  if (isNaN(num) || num < 0 || num > 4) {
    throw new Error(`Invalid priority: ${input}. Use P0-P4 or 0-4.`);
  }
  return num;
}
```

#### 3. CommandContext

**File(s)**: `packages/tbd-cli/src/cli/lib/context.ts`

Tracks output mode settings:

```typescript
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: ColorOption;
  nonInteractive: boolean;
  debug: boolean;
}
```

#### 4. Color Functions

**File(s)**: `packages/tbd-cli/src/cli/lib/output.ts`

Semantic color helpers:

```typescript
export function createColors(colorOption: ColorOption) {
  return {
    // Status colors
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    info: colors.blue,

    // Semantic colors
    id: colors.cyan,
    label: colors.magenta,
    path: colors.blue,

    // Formatting
    bold: colors.bold,
    dim: colors.dim,
  };
}
```

## Usage Guidelines

### DO: Use OutputManager Methods

```typescript
// ✅ CORRECT: Use output methods
output.success(`Created issue ${colors.id(displayId)}`);
output.debug(`Resolved ${displayId} -> ${internalId}`);
output.error('Failed to sync', error);
```

### DON’T: Use console Directly

```typescript
// ❌ WRONG: Direct console usage
console.log('Created issue ' + id);
console.error('[DEBUG] ' + message);
```

### DO: Respect Mode Hierarchy

```typescript
// ✅ CORRECT: Check modes appropriately
if (!this.ctx.quiet && !this.ctx.json) {
  output.info('Syncing...');
}

// Debug only in verbose/debug mode
output.debug(`Cache ${hit ? 'hit' : 'miss'} for ${id}`);
```

### DON’T: Mix Output Channels

```typescript
// ❌ WRONG: Data to stderr
console.error(JSON.stringify(issues));

// ❌ WRONG: Debug to stdout
console.log('[debug] Loading issues');
```

### DO: Use Semantic Colors

```typescript
// ✅ CORRECT: Semantic color usage
console.log(`${colors.id(id)} ${colors.dim(status)}`);
console.log(colors.success('✓') + ' Operation complete');
```

### DON’T: Use Arbitrary Colors

```typescript
// ❌ WRONG: Arbitrary color choices
console.log(colors.magenta(id)); // IDs should be cyan
console.log(colors.blue('✓'));   // Success should be green
```

## References

- [picocolors](https://github.com/alexeyraspopov/picocolors) - Tiny color library
- [marked-terminal](https://github.com/mikaelbr/marked-terminal) - Markdown rendering
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46) -
  CLI best practices
- [NO_COLOR](https://no-color.org/) - Color disable standard
