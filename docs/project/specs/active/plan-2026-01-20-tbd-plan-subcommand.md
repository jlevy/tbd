# Plan Spec: tbd plan Subcommand

## Purpose

This is a technical design doc for implementing the `tbd plan` subcommand, which bridges
human-readable plan documents (Markdown) with tbd's issue tracking system. The goal is
to automate the workflow of creating issues from plan documents and keeping them
synchronized.

## Background

**Current State:**

tbd provides git-native issue tracking with:
- Issues stored as Markdown + YAML frontmatter files
- Status values: `open`, `in_progress`, `blocked`, `deferred`, `closed`
- Hierarchical organization via `parent_id`
- Dependencies via `dependencies[].type: blocks`
- Extensibility via `extensions` namespace
- CLI commands: `create`, `update`, `list`, `ready`, `blocked`, etc.

**The Problem:**

Currently, translating a plan document (e.g., `docs/plans/oauth.plan.md`) into tbd
issues is manual:
1. Human writes plan with headings and checkboxes
2. Human manually creates tbd issues for each item
3. Human manually updates checkboxes when issue status changes
4. No automated way to keep plan doc and issues in sync

**The Solution:**

`tbd plan` automates this by:
- Parsing plan documents for headings and checkboxes
- Creating tbd issues from plan items
- Inserting issue ID annotations back into the plan doc
- Syncing checkbox markers based on issue status

**Reference Documentation:**

- [tbd-design.md](../../tbd-design.md) - Overall product design (sections 2.6.3
  IssueSchema, 2.7 Relationships, 4.4 Issue Commands)
- [schemas.ts](../../../packages/tbd/src/lib/schemas.ts) - Issue schema with extensions
- Markform MF/0.1 spec (external) - Structured Markdown format

## Summary of Task

Implement `tbd plan` subcommand with four core operations:

1. **`tbd plan create <file>`** - Parse plan doc, create issues, insert ID annotations
2. **`tbd plan sync <file>`** - Reconcile plan doc with tbd issues
3. **`tbd plan status <file>`** - Show what sync would change (dry-run report)
4. **`tbd plan validate <file>`** - Check syntax and referential integrity

The planfile remains a readable Markdown document while tbd issues become the
system-of-record for status, assignment, and dependencies.

## Backward Compatibility

### CLI Compatibility

| Area | Compatibility Level | Notes |
| --- | --- | --- |
| Existing commands | Maintain | No changes to existing commands |
| Issue schema | Maintain | Uses existing `extensions` namespace |
| File format | Maintain | Planfiles are valid Markdown |

### Breaking Changes

- None - this is a new additive feature

---

## Stage 1: Planning Stage

### 1.1 Core Design Decisions

**Decision 1: tbd issues as system-of-record**

- Status, assignee, dependencies are managed in tbd
- Plan doc checkbox markers reflect tbd status (read-only sync)
- Avoids dual-source-of-truth conflicts

**Decision 2: Minimal planfile format**

- Planfile is Markdown with optional Markform structure
- ID annotations use HTML comments: `<!-- #proj-xxxx -->`
- Comments are invisible in GitHub rendering
- No complex frontmatter required for basic usage

**Decision 3: Hierarchy from document structure**

- `# Heading` becomes parent issue (epic)
- `## Subheading` becomes child issue (feature/task)
- `- [ ] Checkbox` becomes leaf issue (task)
- Nested checkboxes inherit parent from enclosing checkbox

**Decision 4: Derived status for headings**

- Heading issues don't have checkbox markers in the doc
- Their status is computed from children during sync
- Prevents drift between heading status and child status

**Decision 5: Status mapping**

| tbd status | Checkbox marker | Rationale |
| --- | --- | --- |
| `open` | `[ ]` | todo |
| `in_progress` | `[*]` | active/current focus |
| `blocked` | `[/]` | incomplete (started but stuck) |
| `deferred` | `[-]` | n/a / out of scope |
| `closed` | `[x]` | done |

### 1.2 Scope Definition

**In Scope (v1):**

- [ ] `tbd plan create <file>` - Create issues from plan doc
- [ ] `tbd plan sync <file>` - Update checkbox markers from issue status
- [ ] `tbd plan sync <file>` - Create issues for new checkboxes
- [ ] `tbd plan status <file>` - Dry-run report
- [ ] `tbd plan validate <file>` - Syntax and reference validation
- [ ] ID annotation format: `<!-- #proj-xxxx -->`
- [ ] Hierarchy: headings and nested checkboxes
- [ ] Multi-state checkbox markers ([ ], [x], [*], [/], [-])
- [ ] Extensions metadata for plan traceability

**Out of Scope (future):**

- `tbd plan schedule` - Agent assignment and scheduling
- Markform field wrappers (not required for v1)
- Full Markform frontmatter
- Bidirectional title sync (plan text vs issue title)
- Auto-discovery of child issues from tbd
- Ordering preservation
- Validation state marker ([v])

### 1.3 Success Criteria

- [ ] `tbd plan create` parses Markdown and creates issues
- [ ] `tbd plan create` inserts ID annotations without corrupting doc
- [ ] `tbd plan sync` updates checkbox markers correctly
- [ ] `tbd plan status` shows accurate diff report
- [ ] `tbd plan validate` catches broken ID references
- [ ] Round-trip: create -> manual status change -> sync works
- [ ] Tests cover core scenarios

---

## Stage 2: Architecture Stage

### 2.1 Planfile Format

#### Minimal Example

```markdown
# OAuth Implementation

## Backend <!-- #proj-a1b2 -->

- [x] Set up OAuth provider config <!-- #proj-c3d4 -->
- [*] Implement token refresh <!-- #proj-e5f6 -->
- [ ] Add rate limiting <!-- #proj-g7h8 -->
  - [ ] Design rate limit algorithm <!-- #proj-i9j0 -->
  - [ ] Implement token bucket <!-- #proj-k1l2 -->

## Frontend <!-- #proj-m3n4 -->

- [ ] Create login button component <!-- #proj-o5p6 -->
- [/] Handle OAuth callback <!-- #proj-q7r8 -->
```

#### ID Annotation Format

```
<!-- #<display-id> -->
```

- Placed at end of heading line or checkbox line
- Uses display ID (e.g., `proj-a1b2`) not internal ULID
- HTML comment is invisible in GitHub Markdown rendering
- Parser matches: `<!-- #([a-z]+-[0-9a-z]+) -->`

#### Checkbox Markers

| Marker | Meaning | Maps to tbd status |
| --- | --- | --- |
| `[ ]` | Todo | `open` |
| `[x]` | Done | `closed` |
| `[*]` | Active | `in_progress` |
| `[/]` | Incomplete | `blocked` |
| `[-]` | N/A / Deferred | `deferred` |

These markers are from Markform's `checkboxMode="multi"` specification.

### 2.2 Issue Extensions Schema

Plan-managed issues use the `extensions.plan` namespace:

```yaml
extensions:
  plan:
    file: docs/plans/oauth.plan.md
    node_kind: checkbox  # or "heading"
    outline_path:
      - "OAuth Implementation"
      - "Backend"
    line_number: 15
```

This enables:
- Finding all issues belonging to a plan
- Reconstructing hierarchy if plan structure changes
- Debugging sync issues

### 2.3 Kind Mapping

| Document Element | tbd Kind | Rationale |
| --- | --- | --- |
| `# H1` heading | `epic` | Top-level plan items |
| `## H2+` heading | `task` | Sub-sections (could be `feature`) |
| Checkbox | `task` | Leaf work items |

### 2.4 Derived Status Algorithm

For heading issues (no checkbox marker):

```
function deriveStatus(children: Issue[]): Status {
  if (children.every(c => c.status in ['closed', 'deferred'])) {
    return 'closed';
  }
  if (children.some(c => c.status === 'blocked')) {
    return 'blocked';
  }
  if (children.some(c => c.status === 'in_progress')) {
    return 'in_progress';
  }
  return 'open';
}
```

### 2.5 Command Specifications

#### `tbd plan create <file>`

**Purpose:** Convert plan document to tbd issues.

**Algorithm:**

1. Parse Markdown file (headings, checkboxes, existing ID annotations)
2. For each heading without ID:
   - Create tbd issue (kind based on level)
   - Set `parent_id` to enclosing heading's issue
   - Set `extensions.plan` metadata
   - Insert `<!-- #proj-xxxx -->` annotation
3. For each checkbox without ID:
   - Create tbd issue (kind: task)
   - Set `parent_id` to enclosing heading or checkbox
   - Set status from marker
   - Set `extensions.plan` metadata
   - Insert `<!-- #proj-xxxx -->` annotation
4. Write modified Markdown back to file

**Options:**

```bash
tbd plan create <file> [options]

Options:
  --dry-run           Show what would be created without making changes
  --no-sync           Don't sync to remote after creating issues
  --prefix <kind>     Override kind prefix for headings (default: epic for H1)
```

**Output:**

```
Created 12 issues from docs/plans/oauth.plan.md:
  proj-a1b2: OAuth Implementation (epic)
  proj-c3d4: Backend (task)
  proj-e5f6: Set up OAuth provider config (task)
  ...
```

#### `tbd plan sync <file>`

**Purpose:** Reconcile plan document with tbd issue state.

**Algorithm:**

1. Parse Markdown file for ID annotations
2. For each annotated item:
   - Load issue from tbd
   - If checkbox: update marker to match issue status
   - If heading: compute derived status from children
3. For items without ID annotations:
   - Create new issues (like `create`)
4. Update `extensions.plan.line_number` if positions changed
5. Write modified Markdown back to file

**Truth Rules (v1):**

- Status/assignee: tbd -> plan (tbd wins)
- Structure/wording: plan -> tbd (for new issues only)
- Conflicts: tbd wins for status, warn if title differs

**Options:**

```bash
tbd plan sync <file> [options]

Options:
  --dry-run           Show what would change without making changes
  --no-sync           Don't sync to remote after changes
  --force             Update even if plan file has unsaved changes
```

**Output:**

```
Synced docs/plans/oauth.plan.md:
  Updated: proj-e5f6 [ ] -> [x] (closed)
  Updated: proj-g7h8 [ ] -> [*] (in_progress)
  Created: proj-new1 "New task from plan"
  Warning: proj-q7r8 title differs: "Handle callback" vs "Handle OAuth callback"
```

#### `tbd plan status <file>`

**Purpose:** Show sync status without making changes.

**Output Categories:**

1. **Marker mismatches** - checkbox marker != issue status
2. **Missing IDs** - plan items without ID annotations
3. **Broken references** - IDs that don't resolve to issues
4. **Title mismatches** - plan text differs from issue title (warning)
5. **Hierarchy mismatches** - parent_id doesn't match plan structure

**Options:**

```bash
tbd plan status <file> [options]

Options:
  --json              Output as JSON for scripting
  --quiet             Only show if there are changes needed
```

**Output:**

```
Plan status: docs/plans/oauth.plan.md

Marker mismatches (3):
  Line 5: proj-e5f6 [*] should be [x] (issue is closed)
  Line 7: proj-g7h8 [ ] should be [*] (issue is in_progress)
  Line 12: proj-q7r8 [x] should be [/] (issue is blocked)

Missing IDs (1):
  Line 20: "- [ ] New task" needs ID

Broken references (0):
  (none)

Run `tbd plan sync docs/plans/oauth.plan.md` to apply changes.
```

#### `tbd plan validate <file>`

**Purpose:** Check plan document validity.

**Checks:**

1. **Markdown syntax** - valid Markdown structure
2. **ID annotation format** - valid `<!-- #proj-xxxx -->` syntax
3. **ID uniqueness** - no duplicate IDs in document
4. **Reference resolution** - all IDs resolve to existing issues
5. **Plan ownership** - issues have matching `extensions.plan.file`

**Options:**

```bash
tbd plan validate <file> [options]

Options:
  --json              Output as JSON
  --strict            Treat warnings as errors
```

**Output:**

```
Validating docs/plans/oauth.plan.md...

Errors (1):
  Line 15: ID proj-xxxx does not exist

Warnings (2):
  Line 8: proj-abc1 belongs to different plan (docs/plans/other.md)
  Line 22: Duplicate ID proj-e5f6

Validation failed with 1 error(s).
```

---

## Stage 3: Refine Architecture

### 3.1 Markdown Parsing Strategy

**Minimal-diff patching approach:**

To preserve arbitrary Markdown content, we do NOT re-render the entire document.
Instead:

1. Parse to identify checkbox lines and heading lines
2. Track line numbers and column positions
3. Apply surgical edits:
   - Change checkbox marker: `[ ]` -> `[x]`
   - Append ID annotation: ` <!-- #proj-xxxx -->`
4. Leave all other content byte-for-byte identical

This avoids Markform's canonical serialization which doesn't preserve arbitrary content.

**Parser requirements:**

- Identify GFM task list items: `- [ ]`, `- [x]`, `- [*]`, `- [/]`, `- [-]`
- Identify ATX headings: `#`, `##`, etc.
- Extract existing ID annotations: `<!-- #... -->`
- Track nesting level for checkboxes (indentation-based)
- Handle edge cases: checkboxes in code blocks (ignore), etc.

### 3.2 File Operations

**Read-modify-write pattern:**

```typescript
async function syncPlanFile(path: string): Promise<SyncResult> {
  // 1. Read file
  const content = await fs.readFile(path, 'utf8');

  // 2. Parse structure
  const nodes = parsePlanNodes(content);

  // 3. Load issues and compute changes
  const edits: Edit[] = [];
  for (const node of nodes) {
    if (node.id) {
      const issue = await loadIssue(node.id);
      const newMarker = statusToMarker(issue.status);
      if (node.marker !== newMarker) {
        edits.push({ type: 'marker', line: node.line, col: node.markerCol, from: node.marker, to: newMarker });
      }
    } else {
      const issue = await createIssue(node);
      edits.push({ type: 'insertId', line: node.line, col: node.lineEnd, id: issue.displayId });
    }
  }

  // 4. Apply edits (reverse order to preserve positions)
  const newContent = applyEdits(content, edits.reverse());

  // 5. Write back
  await fs.writeFile(path, newContent, 'utf8');

  return { edits };
}
```

### 3.3 Existing Code Reuse

| Component | Existing | Reuse Strategy |
| --- | --- | --- |
| Issue creation | `packages/tbd/src/cli/commands/create.ts` | Extract core logic to shared function |
| Issue loading | `packages/tbd/src/file/issue-store.ts` | Use directly |
| ID resolution | `packages/tbd/src/lib/ids.ts` | Use directly |
| Extensions | `IssueSchema.extensions` | Use existing field |
| Output | `packages/tbd/src/cli/lib/output.ts` | Use OutputManager |

### 3.4 New Files Required

```
packages/tbd/src/
├── cli/
│   └── commands/
│       └── plan.ts              # CLI command definitions
├── plan/
│   ├── parser.ts                # Markdown parsing
│   ├── edits.ts                 # Edit application
│   ├── sync.ts                  # Sync algorithm
│   └── types.ts                 # Plan-specific types
```

---

## Changes to tbd-design.md

### New Section: 4.X Plan Commands

Add after section 4.9 (Maintenance Commands):

```markdown
### 4.X Plan Commands

The plan commands bridge Markdown plan documents with tbd issue tracking.

#### Overview

A **planfile** is a Markdown document containing headings and checkboxes that
map to tbd issues. The `tbd plan` commands automate:

- Creating issues from plan items
- Syncing checkbox markers based on issue status
- Validating plan document integrity

#### Plan Create

\`\`\`bash
tbd plan create <file> [options]

Options:
  --dry-run           Show what would be created
  --no-sync           Don't sync after creating
\`\`\`

Creates tbd issues for all headings and checkboxes in the plan document.
Inserts ID annotations (e.g., `<!-- #proj-a1b2 -->`) to link plan items
to issues.

#### Plan Sync

\`\`\`bash
tbd plan sync <file> [options]

Options:
  --dry-run           Show what would change
  --no-sync           Don't sync after changes
\`\`\`

Updates checkbox markers in the plan document to reflect issue status.
Creates issues for new plan items without ID annotations.

#### Plan Status

\`\`\`bash
tbd plan status <file> [options]

Options:
  --json              JSON output
  --quiet             Exit code only
\`\`\`

Shows what `sync` would change without making modifications.

#### Plan Validate

\`\`\`bash
tbd plan validate <file> [options]

Options:
  --strict            Treat warnings as errors
\`\`\`

Checks plan document syntax and verifies all ID references resolve to
existing issues.
```

### Update Section 2.6.3: IssueSchema

Add `extensions.plan` documentation:

```markdown
**Plan Extensions:**

Issues created from plan documents include plan metadata:

\`\`\`yaml
extensions:
  plan:
    file: docs/plans/oauth.plan.md
    node_kind: checkbox
    outline_path: ["OAuth Implementation", "Backend"]
    line_number: 15
\`\`\`

Fields:
- `file`: Path to source plan document (relative to repo root)
- `node_kind`: Type of plan node ("heading" or "checkbox")
- `outline_path`: Heading ancestry for context
- `line_number`: Line number in plan document (updated on sync)
```

### Update Section 7.2: Future Enhancements

Add:

```markdown
#### Plan Scheduling

`tbd plan schedule` for agent assignment and work distribution:
- Identify ready tasks from plan
- Assign to agents round-robin or by section
- Generate per-agent work prompts
```

---

## Code Changes Summary

### New Files

| File | Purpose |
| --- | --- |
| `src/cli/commands/plan.ts` | CLI command: plan create/sync/status/validate |
| `src/plan/parser.ts` | Markdown parser for headings and checkboxes |
| `src/plan/edits.ts` | Apply surgical edits to Markdown |
| `src/plan/sync.ts` | Core sync algorithm |
| `src/plan/types.ts` | PlanNode, SyncResult, etc. |

### Modified Files

| File | Change |
| --- | --- |
| `src/cli/cli.ts` | Register `plan` command |
| `src/lib/schemas.ts` | Add `PlanExtensions` type (optional, for validation) |
| `src/file/issue-store.ts` | Possibly extract shared creation logic |

### Tests

| Test File | Coverage |
| --- | --- |
| `tests/plan/parser.test.ts` | Markdown parsing edge cases |
| `tests/plan/sync.test.ts` | Sync algorithm scenarios |
| `tests/plan/e2e.test.ts` | End-to-end create/sync/status |

---

## Open Questions and Design Issues

### 1. Checkbox Label Constraints

**Issue:** Markform specifies plain-text-only option labels. Plan checkboxes often contain:
- Inline code: `` `src/foo.ts` ``
- Links: `[ADR-12](docs/adr-12.md)`
- Emphasis: `**important**`

**Options:**
- A) v1 accepts any Markdown, defer strict validation
- B) Warn but don't error on inline formatting
- C) Strip formatting for issue title, preserve in plan doc

**Recommendation:** Option A - accept any Markdown for v1, note that full Markform
validation is future work.

### 2. Title Sync Direction

**Issue:** Should plan text changes update issue titles?

**Options:**
- A) One-way: plan creates issue title, never updates it
- B) Two-way: sync detects title changes, prompts for resolution
- C) Plan-wins: plan text always overwrites issue title

**Recommendation:** Option A for v1 - simpler, avoids conflicts. Title divergence
shown as warning in `status`.

### 3. Removed Items

**Issue:** What happens if a checkbox is removed from the plan doc?

**Options:**
- A) Issue remains in tbd, orphaned from plan
- B) Issue is closed/archived
- C) Issue is deleted

**Recommendation:** Option A - warn in `status`, don't auto-delete. Future:
`tbd plan prune` command.

### 4. Multiple Plans per Issue

**Issue:** Can an issue belong to multiple plans?

**Recommendation:** No for v1. `extensions.plan.file` is singular. Future could
support `extensions.plan.files[]`.

### 5. Ordering

**Issue:** Should issue order in `tbd list` reflect plan document order?

**Recommendation:** Defer to future. Current `tbd list` sorts by priority. Could
add `extensions.plan.order` field and `--sort=plan` option later.

### 6. Schedule Command

**Issue:** The `tbd plan schedule` command was discussed but is complex.

**Recommendation:** Defer entirely. v1 focuses on create/sync/status/validate.
Schedule can be added once the core workflow is proven.

### 7. Stable Node Keys

**Issue:** Using display IDs (`proj-a7k2`) as linkage means:
- If issue is deleted, plan has orphan reference
- If issue is recreated, gets different ID

**Alternative:** Internal plan node ID separate from issue ID:
```markdown
- [ ] Task <!-- @plan:node-001 tbd:proj-a7k2 -->
```

**Recommendation:** Use display IDs for v1 (simpler). Track this as potential
enhancement if orphan references become problematic.

### 8. Markform Integration Depth

**Issue:** Full Markform would require:
- Frontmatter: `markform: spec: MF/0.1`
- Form wrapper: `<!-- form id="..." -->`
- Field wrapper: `<!-- field kind="checkboxes" ... -->`

**Recommendation:** Optional for v1. Create works without any Markform structure.
Future: `--markform` flag to add full scaffolding.

---

## Implementation Phases

### Phase 1: Core Parsing and Create (Minimum Viable)

- [ ] Markdown parser for headings and checkboxes
- [ ] ID annotation extraction and insertion
- [ ] `tbd plan create` command
- [ ] Basic tests

### Phase 2: Sync and Status

- [ ] Status-to-marker mapping
- [ ] Derived status for headings
- [ ] `tbd plan sync` command
- [ ] `tbd plan status` command
- [ ] Tests for sync scenarios

### Phase 3: Validation

- [ ] `tbd plan validate` command
- [ ] Reference resolution checks
- [ ] Duplicate ID detection
- [ ] Plan ownership verification

### Phase 4: Polish

- [ ] Edge case handling (code blocks, nested lists)
- [ ] Warning messages for divergence
- [ ] Documentation updates
- [ ] Golden tests with real plan documents

---

## Stage 4: Validation Stage

*To be completed after implementation.*

- [ ] All commands work as specified
- [ ] Round-trip test: create -> update issue -> sync works
- [ ] Error handling covers edge cases
- [ ] Documentation is complete
- [ ] Design doc updated with final implementation
