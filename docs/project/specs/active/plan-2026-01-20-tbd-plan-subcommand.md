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
- Markform MF/0.1 spec - run `npx --yes markform@latest spec` to view

## Markform Compatibility Analysis

### Why Markform Field Wrappers Matter

After reviewing the Markform MF/0.1 spec, **field wrappers ARE required** for using the
Markform programmatic API. Key findings:

1. **Programmatic API requires fields**: The `set_checkboxes` patch operation targets a
   `fieldId`. Without field wrappers, there's no way to use `markform apply` to update
   checkbox states.

2. **Option IDs are required**: Each checkbox option needs an ID annotation (`{% #id %}`)
   for the API to address it.

3. **Checkbox modes align well**: Markform's `multi` mode provides exactly the 5 states
   we need: `todo`, `done`, `incomplete`, `active`, `na`.

### Two Implementation Approaches

**Approach A: Text-only manipulation (no Markform API)**

```markdown
## Backend <!-- #proj-a1b2 -->

- [x] Set up OAuth config <!-- #proj-c3d4 -->
- [*] Implement token refresh <!-- #proj-e5f6 -->
```

- Pros: Simpler format, no field wrappers needed, cleaner Markdown
- Cons: Can't use Markform's `apply` API, must do regex-based text manipulation
- Sync: `tbd plan sync` does direct text edits (change `[ ]` to `[x]`, etc.)

**Approach B: Full Markform integration**

```markdown
---
markform:
  spec: MF/0.1
---

{% form id="oauth_plan" %}

## Backend <!-- #proj-a1b2 -->

{% field kind="checkboxes" id="backend_tasks" label="Backend tasks" %}
- [x] Set up OAuth config {% #setup_oauth tbd:proj-c3d4 %}
- [*] Implement token refresh {% #token_refresh tbd:proj-e5f6 %}
{% /field %}

{% /form %}
```

- Pros: Can use Markform's `markform apply` for updates, structured validation
- Cons: More complex format, requires field wrappers around every checklist
- Sync: Could use `markform apply` with `set_checkboxes` patches
- Note: `checkboxMode="multi"` omitted (it's the default)

### Recommended Approach: Hybrid (Approach B with graceful degradation)

**Use full Markform structure** for these benefits:

1. **Programmatic API**: `tbd plan sync` can call `markform apply` internally
2. **Validation**: Markform validates checkbox structure and IDs
3. **Future-proof**: Ready for Markform ecosystem tools
4. **Agent compatibility**: Agents can use Markform tools directly on plan files

**Key design decisions for Markform integration:**

1. **Dual ID system**: Options have Markform IDs (`{% #setup_oauth %}`) AND tbd
   references (`tbd:proj-c3d4`). This separates plan structure from issue linkage.

2. **Auto-generate field wrappers**: `tbd plan create` wraps contiguous checklists in
   `{% field kind="checkboxes" %}` tags automatically.

3. **Field IDs from context**: Field IDs are derived from the enclosing heading
   (e.g., `backend_tasks` from `## Backend`).

4. **Graceful parsing**: `tbd plan sync` can handle both:
   - Full Markform (use `markform apply`)
   - Plain Markdown (fall back to text manipulation)

### Status Mapping (tbd ↔ Markform)

| tbd status | Markform checkbox state | Marker |
| --- | --- | --- |
| `open` | `todo` | `[ ]` |
| `in_progress` | `active` | `[*]` |
| `blocked` | `incomplete` | `[/]` |
| `deferred` | `na` | `[-]` |
| `closed` | `done` | `[x]` |

This mapping is bidirectional and lossless.

### Markform Limitations and Workarounds

1. **Option labels must be plain text**: Markform validates that option labels are
   plain text (no inline Markdown). For plan items with code or links:
   - Use plain text labels in the checkbox
   - Put rich content in description below the field

2. **Canonical serialization doesn't preserve arbitrary content**: Markform's
   canonical serialize doesn't preserve content outside fields. Workaround:
   - Use minimal-diff patching (only change checkbox markers)
   - Or use `markform apply` which handles this correctly

3. **No cross-field dependencies**: Markform doesn't model task dependencies.
   tbd handles this via `dependencies[].type: blocks`.

### Proposed Markform Spec Clarifications

For tbd plan integration, we'd like to propose these clarifications to the Markform spec:

1. **File extension**: Clarify that `.form.md` is *recommended* but not strictly required.
   Document identification is based on the `markform:` frontmatter, so extensions like
   `.plan.md`, `.survey.md`, etc. should be valid when frontmatter is present.

2. **Default checkbox mode**: Already documented that `checkboxMode="multi"` is the
   default (so it can be omitted), but could be more prominent.

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

**Decision 2: Full Markform structure**

- Planfile uses Markform MF/0.1 format for programmatic API access
- Checklists are wrapped in `{% field kind="checkboxes" %}` tags
- Option IDs use Markdoc syntax: `{% #option_id %}`
- tbd issue links use custom attribute: `tbd:proj-xxxx`
- `tbd plan create` auto-generates Markform scaffolding from plain Markdown

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
- [ ] Markform field wrappers around checklists (`{% field kind="checkboxes" %}`)
- [ ] Markform frontmatter (`markform: spec: MF/0.1`)
- [ ] Dual ID system: Markform option IDs + tbd issue references
- [ ] Hierarchy: headings and nested checkboxes
- [ ] Multi-state checkbox markers ([ ], [x], [*], [/], [-])
- [ ] Extensions metadata for plan traceability
- [ ] Use `markform apply` for checkbox state updates (when Markform structure present)

**Out of Scope (future):**

- `tbd plan schedule` - Agent assignment and scheduling
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

#### File Extension

tbd plan files use the `.plan.md` extension (e.g., `oauth.plan.md`).

**Note:** The Markform spec currently says `.form.md` is "required", but document
identification is actually based on the frontmatter (`markform: spec: MF/0.1`), not the
extension. This should be clarified in a future Markform spec revision to note that
`.form.md` is *recommended* but other extensions like `.plan.md` are valid when the
frontmatter is present.

#### Full Markform Example

```markdown
---
markform:
  spec: MF/0.1
---

{% form id="oauth_plan" title="OAuth Implementation Plan" %}

# OAuth Implementation <!-- tbd:proj-root -->

{% group id="backend" title="Backend" %}

## Backend <!-- tbd:proj-a1b2 -->

{% field kind="checkboxes" id="backend_tasks" label="Backend tasks" %}
- [x] Set up OAuth provider config {% #setup_oauth tbd:proj-c3d4 %}
- [*] Implement token refresh {% #token_refresh tbd:proj-e5f6 %}
- [ ] Add rate limiting {% #rate_limiting tbd:proj-g7h8 %}
{% /field %}

{% field kind="checkboxes" id="rate_limit_subtasks" label="Rate limiting subtasks" %}
- [ ] Design rate limit algorithm {% #rate_algo tbd:proj-i9j0 %}
- [ ] Implement token bucket {% #token_bucket tbd:proj-k1l2 %}
{% /field %}

{% /group %}

{% group id="frontend" title="Frontend" %}

## Frontend <!-- tbd:proj-m3n4 -->

{% field kind="checkboxes" id="frontend_tasks" label="Frontend tasks" %}
- [ ] Create login button component {% #login_button tbd:proj-o5p6 %}
- [/] Handle OAuth callback {% #oauth_callback tbd:proj-q7r8 %}
{% /field %}

{% /group %}

{% /form %}
```

**Note:** `checkboxMode="multi"` is omitted because it's the default in Markform.

#### Dual ID System

**Markform option IDs** (structural identity within the document):
```
{% #setup_oauth %}
```
- Uses Markdoc attribute shorthand
- Scoped to the containing field
- Used by Markform's `set_checkboxes` patch API

**tbd issue references** (link to tbd issue tracking):
```
tbd:proj-c3d4
```
- Custom attribute linking to tbd display ID
- Used by `tbd plan sync` to correlate with issues
- Placed alongside the Markform option ID

**Combined format:**
```
- [x] Set up OAuth provider config {% #setup_oauth tbd:proj-c3d4 %}
```

#### Heading Annotations

Headings use HTML comments for tbd references (since they're not inside fields):
```markdown
## Backend <!-- tbd:proj-a1b2 -->
```

#### Checkbox Markers

| Marker | Markform State | tbd Status |
| --- | --- | --- |
| `[ ]` | `todo` | `open` |
| `[x]` | `done` | `closed` |
| `[*]` | `active` | `in_progress` |
| `[/]` | `incomplete` | `blocked` |
| `[-]` | `na` | `deferred` |

These are Markform's `checkboxMode="multi"` states.

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

**Algorithm (with Markform integration):**

1. Parse planfile:
   - If has Markform frontmatter: use `markform` library to parse
   - Otherwise: fall back to plain Markdown parsing
2. Build tbd reference map from `tbd:proj-xxxx` attributes
3. For each checkbox option with tbd reference:
   - Load issue from tbd
   - Compare checkbox state to issue status
   - If mismatch: queue a `set_checkboxes` patch
4. For checkboxes without tbd references:
   - Create new tbd issue
   - Queue edit to add `tbd:proj-xxxx` attribute
5. Apply changes:
   - If Markform: use `markform apply` with patches
   - Otherwise: use text-based edits
6. Update `extensions.plan.line_number` in tbd issues if positions changed
7. Write modified planfile

**Using Markform Apply:**

```typescript
import { parseForm, applyPatches, getMarkdown } from 'markform';

// Build patches from tbd status
const patches = checkboxUpdates.map(({ fieldId, optionId, newState }) => ({
  op: 'set_checkboxes',
  fieldId,
  value: { [optionId]: newState }
}));

// Apply via Markform API
const result = applyPatches(parsedForm, patches);
const updatedMarkdown = getMarkdown(result.form);
```

**Truth Rules (v1):**

- Status/assignee: tbd → plan (tbd wins)
- Structure/wording: plan → tbd (for new issues only)
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

### 3.1 Parsing Strategy

**Dual-mode parsing:**

`tbd plan` supports two parsing modes:

1. **Markform mode** (preferred): When file has Markform frontmatter, use `markform`
   library for parsing and the `apply` API for updates.

2. **Plain Markdown mode** (fallback): For files without Markform structure, use
   regex-based parsing and text manipulation.

**Markform mode benefits:**

- Structured parsing via Markdoc AST
- `set_checkboxes` patch API for reliable updates
- Built-in validation of checkbox states
- Consistent serialization

**Detection logic:**

```typescript
function hasMarkformStructure(content: string): boolean {
  // Check for Markform frontmatter
  return /^---\s*\nmarkform:\s*\n\s+spec:\s*MF\//.test(content);
}
```

### 3.2 Markform Integration

**Parsing Markform planfiles:**

```typescript
import { parseForm } from 'markform';

const parsed = parseForm(content);

// Extract tbd references from option attributes
for (const field of parsed.schema.fields) {
  if (field.kind === 'checkboxes') {
    for (const option of field.options) {
      // Custom attribute: tbd:proj-xxxx
      const tbdRef = option.attributes?.tbd;
      if (tbdRef) {
        tbdReferenceMap.set(tbdRef, {
          fieldId: field.id,
          optionId: option.id,
          currentState: parsed.responsesByFieldId[field.id]?.values?.[option.id]
        });
      }
    }
  }
}
```

**Applying checkbox updates via Markform:**

```typescript
import { applyPatches, getMarkdown } from 'markform';

// Build patches from tbd issue status
const patches = updates.map(({ fieldId, optionId, tbdStatus }) => ({
  op: 'set_checkboxes' as const,
  fieldId,
  value: { [optionId]: tbdStatusToMarkformState(tbdStatus) }
}));

// Apply patches - Markform handles serialization correctly
const result = applyPatches(parsedForm, patches);

if (result.applyStatus === 'applied') {
  const updatedMarkdown = getMarkdown(result.form);
  await fs.writeFile(planPath, updatedMarkdown);
}
```

### 3.3 Plain Markdown Fallback

For files without Markform structure, use text-based manipulation:

**Read-modify-write pattern:**

```typescript
async function syncPlanFilePlain(path: string): Promise<SyncResult> {
  const content = await fs.readFile(path, 'utf8');
  const nodes = parsePlainMarkdown(content);
  const edits: Edit[] = [];

  for (const node of nodes) {
    if (node.tbdRef) {
      const issue = await loadIssue(node.tbdRef);
      const newMarker = statusToMarker(issue.status);
      if (node.marker !== newMarker) {
        edits.push({
          type: 'marker',
          line: node.line,
          col: node.markerCol,
          from: node.marker,
          to: newMarker
        });
      }
    }
  }

  const newContent = applyEdits(content, edits.reverse());
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
