# Feature: Terminal Output Design System Audit

**Date:** 2026-01-29 (last updated 2026-01-29)

**Author:** Claude

**Status:** Draft

## Overview

This spec provides a systematic audit of all tbd CLI command outputs against the
established design system.
It builds on existing design system documentation to:

1. Catalog all reusable output components
2. Define a comprehensive component reference table
3. Audit each command for design system conformance
4. Create tracking beads for each command’s conformance status

## Goals

- Create a definitive reference for all CLI output components
- Systematically audit every tbd command against the design system
- Track conformance status with individual beads per command
- Identify and fix all inconsistencies

## Non-Goals

- Redefine the design system (already done in arch-cli-interface-design-system.md)
- Change fundamental output patterns without justification
- Add new features unrelated to output consistency

## Background

### Related Documentation

- [arch-cli-interface-design-system.md](../architecture/current/arch-cli-interface-design-system.md)
  \- Canonical design system reference
- [plan-2026-01-17-cli-output-design-system.md](plan-2026-01-17-cli-output-design-system.md)
  \- Original implementation plan
- [plan-2026-01-26-cli-output-formatting-consistency.md](plan-2026-01-26-cli-output-formatting-consistency.md)
  \- Heading consistency spec

### Observed Output Samples

**`tbd status` (initialized):**
```
tbd v0.1.9

Repository: /Users/levy/wrk/aisw/markform
  ✓ Initialized (.tbd/)
  ✓ Git repository (claude/review-markform-spec-PqCip)
  ✓ Git 2.50.1

⚠  Beads directory detected alongside tbd
   This may cause confusion for AI agents.
   Run tbd setup beads --disable for migration options

Sync branch: tbd-sync
Remote: origin
ID prefix: mf-

INTEGRATIONS
  ✓ Claude Code hooks (~/.claude/settings.json)
  ✓ Codex AGENTS.md (./AGENTS.md)

Worktree: /Users/levy/wrk/aisw/markform/.tbd/data-sync-worktree (healthy)

Use 'tbd stats' for issue statistics, 'tbd doctor' for health checks.
```

**`tbd doctor` output:**
```
REPOSITORY
tbd v0.1.9
Repository: /Users/levy/wrk/aisw/markform
  ✓ Initialized (.tbd/)
  ✓ Git repository (claude/review-markform-spec-PqCip)

Sync branch: tbd-sync
Remote: origin
ID prefix: mf-

STATISTICS
  Ready:       12
  In progress: 4
  Blocked:     0
  Open:        12
  Total:       690

INTEGRATIONS
✓ Claude Code skill (.claude/skills/tbd/SKILL.md)
✓ Codex AGENTS.md (AGENTS.md)

HEALTH CHECKS
✓ Git version - 2.50.1
✓ Config file (.tbd/config.yml)
✓ Issues directory (.tbd/issues)
✓ Dependencies
✓ Unique IDs
✓ Temp files (.tbd/issues)
✓ Issue validity
✓ Worktree (.tbd/data-sync-worktree)
✓ Data location
✓ Local sync branch - tbd-sync
✓ Remote sync branch - origin/tbd-sync
✓ Sync status
✓ Clone status
✓ Sync consistency

✓ Repository is healthy
```

## Design

### Component Reference Tables

#### Table 1: Message Icons

| Icon | Unicode | Color | Level | Usage |
| --- | --- | --- | --- | --- |
| `✓` | U+2713 | Green | success | Completed operations, passing checks |
| `✗` | U+2717 | Red | error | Failed operations, errors |
| `⚠` | U+26A0 | Yellow | warning | Warnings, cautions |
| `•` | U+2022 | Blue | notice | Noteworthy events |
| `>` | ASCII | Dim | command | External command display |

#### Table 2: Status Icons

| Status | Icon | Unicode | Color | Usage |
| --- | --- | --- | --- | --- |
| `open` | `○` | U+25CB | Blue | Issue awaiting action |
| `in_progress` | `◐` | U+25D0 | Green | Issue being worked |
| `blocked` | `●` | U+25CF | Red | Issue stopped |
| `deferred` | `○` | U+25CB | Dim | Issue postponed |
| `closed` | `✓` | U+2713 | Dim | Issue complete |

#### Table 3: Priority Display

| Priority | Display | Color |
| --- | --- | --- |
| 0 | P0 | Red |
| 1 | P1 | Yellow |
| 2 | P2 | Default |
| 3 | P3 | Default |
| 4 | P4 | Default |

#### Table 4: Section Heading Patterns

| Pattern | Format | Example | When to Use |
| --- | --- | --- | --- |
| Major Section | `ALL CAPS` (bold) | `REPOSITORY` | Top-level sections |
| Subsection | `Title:` (bold) | `Summary:` | Subsections within major |
| Inline Label | `Label:` (dim) | `Sync branch:` | Key-value pairs |
| Progress | `Action...` | `Syncing...` | Operation in progress |

#### Table 5: Output Structure Patterns

| Component | Format | Color | Example |
| --- | --- | --- | --- |
| Version banner | `tbd v{version}` | Bold (first word) | `tbd v0.1.9` |
| Repository path | `Repository: {path}` | Default | `Repository: /path` |
| Check item | `  {icon} {name} ({detail})` | Icon-colored | `  ✓ Git repository (main)` |
| Warning block | `{icon}  {message}\n   {detail}` | Yellow | Multi-line warning |
| Config item | `{label}: {value}` | Label dim, value default | `Sync branch: tbd-sync` |
| Count row | `  {label}: {count}` | Label padded | `  Ready:       12` |
| Diagnostic line | `{icon} {name} - {detail} ({path})` | Per-icon | `✓ Git version - 2.50.1` |
| Footer hint | `Use '{cmd}' for {action}.` | Bold cmd | Help suggestion |
| Final status | `{icon} {summary}` | Green/Red | `✓ Repository is healthy` |

#### Table 6: Spacing Patterns

| Context | Rule |
| --- | --- |
| After version banner | Blank line |
| After repository header | No blank (checks follow) |
| Before major section | Blank line |
| After major section heading | No blank line |
| After warning block | Blank line |
| Before config block | Blank line |
| After config block | No blank |
| Before footer hint | Blank line |
| After footer hint | No trailing blank |

#### Table 7: Diagnostic Output Pattern

```
{icon} {check_name}[ - {message}][ ({path})][ [fixable]]
[    {detail_line}]
[    {suggestion}]
```

| Element | When Shown | Color |
| --- | --- | --- |
| icon | Always | Per status |
| check_name | Always | Default |
| message | If present | Default |
| path | If present | Dim, parenthesized |
| [fixable] | If fixable & not ok | Dim |
| detail lines | If status != ok | Dim, 4-space indent |
| suggestion | If status != ok | Dim, 4-space indent |

### Command Output Audit

Each command below will have a dedicated bead tracking its conformance status.

#### Commands to Audit

| Command | Output Type | Key Components |
| --- | --- | --- |
| `status` | Orientation | Version, checks, config, integrations |
| `doctor` | Diagnostics | Sections, stats, checks, summary |
| `stats` | Statistics | Summary counts, breakdowns |
| `list` | Table | Header, issue lines, count |
| `show` | Detail | YAML with colorization |
| `search` | Table | Header, issue lines, count |
| `ready` | Table | Header, issue lines, count |
| `blocked` | Table | Header, issue lines, count |
| `sync` | Progress | Spinner, summary |
| `create` | Confirmation | Success message |
| `update` | Confirmation | Success message |
| `close` | Confirmation | Success message |
| `reopen` | Confirmation | Success message |
| `prime` | Orientation | Sections, markdown content |
| `setup` | Progress | Steps, confirmations, next steps |
| `init` | Confirmation | Success, next steps |
| `import` | Progress | Counts, summary |
| `config` | Display | Key-value pairs |
| `label` | Table | Label operations |
| `dep` | Display | Dependencies |
| `attic` | Table | Archived issues |
| `stale` | Table | Stale issues |
| `design` | Display | Design document |
| `shortcut` | Content | Markdown rendering |
| `guidelines` | Content | Markdown rendering |
| `template` | Content | Template output |
| `docs` | Listing | Documentation list |
| `skill` | Content | Skill content |
| `closing` | Process | Closing workflow |

## Implementation Plan

### Phase 1: Conformance Audit Beads (Created)

Tracking beads for each command audit:

| Bead ID | Command(s) | Status |
| --- | --- | --- |
| tbd-myb5 | `status` | ○ open |
| tbd-d417 | `doctor` | ○ open |
| tbd-0ddl | `stats` | ○ open |
| tbd-6a7k | `list` | ○ open |
| tbd-wa96 | `show` | ○ open |
| tbd-tzlo | `search` | ○ open |
| tbd-dp2l | `ready` | ○ open |
| tbd-nfx6 | `blocked` | ○ open |
| tbd-pwah | `sync` | ○ open |
| tbd-8eaa | `create` | ○ open |
| tbd-x8lk | `update` | ○ open |
| tbd-gfmt | `close`/`reopen` | ○ open |
| tbd-21pt | `prime` | ○ open |
| tbd-lt0z | `setup` | ○ open |
| tbd-fh7c | `init` | ○ open |
| tbd-l3nu | `import` | ○ open |
| tbd-i041 | `config` | ○ open |
| tbd-le0n | `label`/`dep`/`attic` | ○ open |
| tbd-lse2 | `shortcut`/`guidelines`/`template` | ○ open |
| tbd-gb1d | `docs`/`skill` | ○ open |

Use `tbd list --spec plan-2026-01-29-terminal-output-design-system-audit.md` to view all
beads.

### Phase 2: Conduct Audits

For each command audit bead:

1. Run command with sample data
2. Compare output against design system tables
3. Document specific deviations
4. Mark bead as either:
   - `closed` if fully conformant
   - `open` with notes if fixes needed

### Phase 3: Fix Non-Conformant Commands

Address issues found in audits:

- [ ] Fix heading format inconsistencies (see Table 4)
- [ ] Fix spacing inconsistencies (see Table 6)
- [ ] Fix icon/color usage (see Tables 1-3)
- [ ] Fix diagnostic output format (see Table 7)
- [ ] Update golden tests for new consistent output

## Observed Inconsistencies (Preliminary)

Based on the sample outputs provided:

### `tbd status` vs `tbd doctor` Differences

| Element | `status` | `doctor` | Design System |
| --- | --- | --- | --- |
| Version line | Before repository | After section heading | ? |
| Section format | `INTEGRATIONS` | `REPOSITORY`, `STATISTICS`, etc. | ALL CAPS |
| Check indent | 2 spaces | None for section items | 2 spaces per design |
| Config block | After checks | After repository section | Should be consistent |
| Worktree line | Standalone | Under HEALTH CHECKS | Should match |

### Specific Issues Found

1. **Version placement**: `status` shows version first, `doctor` shows it after
   REPOSITORY heading
2. **Integration check indent**: `status` has 2-space indent, `doctor` has no indent
3. **Worktree display**: Different formats between commands
4. **Config spacing**: Different placement relative to checks

## Testing Strategy

1. **Golden tests**: Capture exact output for each command
2. **Component tests**: Test formatting functions in isolation
3. **Integration tests**: Verify end-to-end command output

## Open Questions

1. Should version always appear as first line, or under a section heading?
   - **Recommendation**: First line for orientation commands, under heading for
     diagnostic

2. Should we create a `heading()` method that handles both format and spacing?
   - **Recommendation**: Yes, encapsulate the pattern

3. How should multi-line warnings be indented?
   - **Current**: 3 spaces for continuation
   - **Recommendation**: Standardize to 3 spaces

## References

- [arch-cli-interface-design-system.md](../architecture/current/arch-cli-interface-design-system.md)
- [plan-2026-01-17-cli-output-design-system.md](plan-2026-01-17-cli-output-design-system.md)
- [plan-2026-01-26-cli-output-formatting-consistency.md](plan-2026-01-26-cli-output-formatting-consistency.md)
- [output.ts](packages/tbd/src/cli/lib/output.ts)
- [diagnostics.ts](packages/tbd/src/cli/lib/diagnostics.ts)
- [issue-format.ts](packages/tbd/src/cli/lib/issue-format.ts)
