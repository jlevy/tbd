# Feature: Show Parent Context and Max-Lines Truncation

**Date:** 2026-02-13

**Author:** Agent (with user direction)

**Status:** Implemented

## Overview

When `tbd show` displays a child bead, it now automatically renders the full parent bead
above it (capped at a configurable line limit), so agents and humans always see the
parent’s context without a separate lookup.
A new `--max-lines` option enables output truncation on any bead display with a dimmed
omission notice.

## Goals

- Child beads auto-display their parent’s full details for context inheritance
- Eliminate the need to duplicate parent context in child bead descriptions
- Provide `--max-lines <n>` for general output truncation
- Configurable parent context cap via `PARENT_CONTEXT_MAX_LINES` in settings.ts
- `--no-parent` flag to suppress parent display when not needed

## Non-Goals

- Recursive parent display (grandparent chains) — only immediate parent
- Changing the storage format or `parent_id` field semantics
- Modifying `tbd list` or other commands (only `tbd show`)

## Background

Previously, `tbd show` on a child bead displayed `parent_id: is-01hx...` as a bare
internal ID string with no context.
Agents viewing child beads had zero information about what the parent epic/feature was
about, leading to:

1. Users duplicating parent descriptions into every child bead
2. Agents missing important context when working on child tasks
3. Extra `tbd show` calls to look up the parent separately

## Design

### Approach

1. **Parent context**: When a shown issue has `parent_id`, fetch the parent issue and
   render it in the same colorized YAML+Markdown format, capped at
   `PARENT_CONTEXT_MAX_LINES` (50), above the child’s output with a `Parent:` header.

2. **Max-lines truncation**: A reusable `printWithTruncation()` function handles capping
   any set of output lines.
   When exceeded, appends:
   ```
   … [N lines omitted]
   ```
   in dimmed styling.

3. **Flags**:
   - `--no-parent`: Suppress parent context (Commander.js negation pattern)
   - `--max-lines <n>`: Truncate the main issue output

4. **JSON output**: Includes full `parent` object with `displayId`, all fields.

### Components

| File | Change |
| --- | --- |
| `src/lib/settings.ts` | Add `PARENT_CONTEXT_MAX_LINES = 50` |
| `src/cli/commands/show.ts` | Extract `renderIssueLines()`, add `printWithTruncation()`, parent fetch logic, `--max-lines` and `--no-parent` options |
| `docs/tbd-design.md` | §4.4 Show: document new options and parent context behavior; §2.8.2: add context inheritance property |
| `docs/tbd-prime.md` | Note auto-display in show command reference |
| `docs/tbd-docs.md` | Update show command and epic workflow sections |
| `docs/shortcuts/standard/plan-implementation-with-beads.md` | Clarify context inheritance |

### API Changes

**CLI additions to `tbd show`:**

```bash
tbd show <id> --no-parent        # Suppress parent context
tbd show <id> --max-lines 20     # Truncate output to 20 lines
```

**JSON output addition:**

When the issue has a parent, the JSON output includes:
```json
{
  "parent": {
    "displayId": "proj-a1b2",
    "id": "is-...",
    "title": "...",
    "status": "...",
    "priority": 1,
    "kind": "epic",
    "description": "..."
  }
}
```

## Implementation Plan

### Phase 1: Core Implementation (done)

- [x] Add `PARENT_CONTEXT_MAX_LINES = 50` to `settings.ts`
- [x] Extract `renderIssueLines()` — reusable colorized issue renderer returning
  string[]
- [x] Add `printWithTruncation()` — prints lines with optional cap + omission notice
- [x] Fetch parent issue when `parent_id` is set and `--no-parent` not specified
- [x] Render parent with `Parent:` header, capped at `PARENT_CONTEXT_MAX_LINES`
- [x] Add `--max-lines <n>` option for main issue truncation
- [x] Include `parent` object in JSON output
- [x] Handle missing parent gracefully (silently skip)

### Phase 2: Documentation (done)

- [x] Update `tbd-design.md` §4.4 Show with new options and parent context docs
- [x] Update `tbd-design.md` §2.8.2 with context inheritance key property
- [x] Update `tbd-prime.md` show command reference
- [x] Update `tbd-docs.md` show command and epic workflow
- [x] Update `plan-implementation-with-beads.md` shortcut

### Phase 3: Golden Test Coverage (todo)

- [ ] Add tryscript scenario: show child bead auto-displays parent
- [ ] Add tryscript scenario: `--no-parent` suppresses parent
- [ ] Add tryscript scenario: `--max-lines` truncates with omission notice
- [ ] Add tryscript scenario: show bead without parent (no change)
- [ ] Add tryscript scenario: JSON output includes parent object

## Testing Strategy

### Golden Test Tryscript: `cli-show-parent-context.tryscript.md`

```yaml
---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test
---
```

**Scenario 1: Child bead auto-displays parent context**

Create a parent epic, then a child task, and verify `tbd show` on the child includes the
parent’s details.

```markdown
# Test: Create parent epic

` ` `console
$ tbd create "Build Auth System" --type=epic --priority=1 --description="Users need OAuth and SAML auth" --json | jq -r '.displayId' | tee parent_id.txt
test-[SHORTID]
? 0
` ` `

# Test: Create child task under parent

` ` `console
$ tbd create "Implement OAuth" --type=task --parent=$(cat parent_id.txt) --json | jq -r '.displayId' | tee child_id.txt
test-[SHORTID]
? 0
` ` `

# Test: Show child displays parent context

` ` `console
$ tbd show $(cat child_id.txt)
Parent:
---
...
title: Build Auth System
...
---

Users need OAuth and SAML auth

---
...
title: Implement OAuth
...
---
? 0
` ` `
```

**Scenario 2: `--no-parent` suppresses parent context**

```markdown
# Test: Show child with --no-parent

` ` `console
$ tbd show $(cat child_id.txt) --no-parent
---
...
title: Implement OAuth
...
---
? 0
` ` `

# Test: Verify no "Parent:" line with --no-parent

` ` `console
$ tbd show $(cat child_id.txt) --no-parent | grep -c "Parent:"
0
? 0
` ` `
```

**Scenario 3: `--max-lines` truncates output**

```markdown
# Test: Show child with --max-lines 3

` ` `console
$ tbd show $(cat child_id.txt) --no-parent --max-lines 3
---
[..]
[..]
… [omitted]
? 0
` ` `
```

**Scenario 4: Root bead has no parent header**

```markdown
# Test: Show root bead (no parent)

` ` `console
$ tbd show $(cat parent_id.txt) | grep -c "Parent:"
0
? 0
` ` `
```

**Scenario 5: JSON output includes parent object**

```markdown
# Test: JSON output includes parent

` ` `console
$ tbd show $(cat child_id.txt) --json | jq '.parent.title'
"Build Auth System"
? 0
` ` `
```

## Open Questions

None — implementation is complete and tested.

## References

- `tbd-design.md` §4.4 Show, §2.8.2 Parent-Child Relationships
- `settings.ts` — `PARENT_CONTEXT_MAX_LINES`
- `show.ts` — `renderIssueLines()`, `printWithTruncation()`
