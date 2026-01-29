# Plan Spec: Child Ordering Hints

## Purpose

Add an optional `children_order_hints` field to issues that tracks the intended display
order of child issues.
This provides a soft, manually-controllable ordering mechanism for parent-child
relationships without requiring strict transactional consistency.

## Background

Currently, when children are displayed under a parent (e.g., in `tbd list --pretty`),
they appear in the order returned by the file system or the order they were fetched.
There’s no way to specify a preferred display order for children.

Users need a simple way to control child ordering, especially for epics where task order
matters. However, maintaining perfect consistency (e.g., automatically removing deleted
children from hints) would require complex transactional logic.

The solution is a “hints” approach: the parent stores a list of child IDs representing
the preferred order.
This list may be stale (contain IDs that no longer exist or aren’t children) and may be
incomplete (not all children listed).
The display logic treats it as a soft preference overlay on top of existing sorting.

### Related Work

- `packages/tbd/src/lib/comparison-chain.ts` — Existing `ordering.manual()` for manual
  sort overlays
- `packages/tbd/src/cli/lib/tree-view.ts` — Tree rendering that needs ordering support
- `packages/tbd/src/cli/commands/update.ts` — Command to modify issue fields

## Summary of Task

1. **Schema change**: Add optional `children_order_hints` field to `IssueSchema` as an
   array of `IssueId`
2. **Automatic population**: When a child is added to a parent (via `--parent` flag),
   append the child’s internal ID to the parent’s `children_order_hints`
3. **Display ordering**: In all places where children are listed, use the hints to sort
   children (using `ordering.manual()`)
4. **Manual update**: Add `--children-order <ids>` flag to `tbd update` to reset the
   ordering hints list
5. **Visibility**: Add `--show-order` flag to `tbd show` to display the ordering hints

## Backward Compatibility

**Fully backward compatible.** The `children_order_hints` field is optional and
nullable. Existing issues without this field work unchanged—children display in default
order. No migration required.

## Stage 1: Planning Stage

### Feature Requirements

1. **Soft hints, not strict relationships**
   - The hints list is advisory only
   - May contain IDs that no longer exist (deleted issues)
   - May contain IDs that are no longer children of this parent (re-parented)
   - May be incomplete (not all children listed)
   - No automatic cleanup when children change

2. **Append on child add**
   - When `tbd update <child> --parent <parent>` is run, append the child’s internal ID
     to the parent’s `children_order_hints`
   - Only append if not already present in the list
   - Do not append if removing parent (`--parent ""`)

3. **Display ordering**
   - Apply hints as first-priority sort
   - Children in hints list appear first, in hints order
   - Children not in hints list appear after, sorted by default order
   - Use `ordering.manual()` from comparison-chain

4. **Manual reset**
   - `tbd update <id> --children-order <id1>,<id2>,...` replaces the entire list
   - Accepts short IDs (e.g., `bd-a1b2,bd-c3d4`) which are resolved to internal IDs
   - `tbd update <id> --children-order ""` clears the list

5. **Visibility**
   - `tbd show <id> --show-order` displays the children_order_hints
   - Shows short IDs for readability
   - Output format: `children_order_hints: [bd-a1b2, bd-c3d4, ...]`

### Not in Scope

- Automatic removal of stale IDs from hints
- Insertion at specific positions (only full replacement)
- Drag-and-drop or move-up/move-down semantics
- Validation that IDs in hints are actually children
- Circular reference detection (not possible since hints are one-directional)

### Acceptance Criteria

- [ ] `children_order_hints` field added to schema, optional array of IssueId
- [ ] Setting `--parent` on a child appends to parent’s hints list
- [ ] `tbd list --pretty` respects ordering hints for children
- [ ] `tbd update --children-order` sets the hints list
- [ ] `tbd show --show-order` displays the hints list
- [ ] All existing tests pass (backward compatibility)
- [ ] New tests cover hint population, sorting, and update

## Stage 2: Architecture Stage

### Schema Change

In `packages/tbd/src/lib/schemas.ts`:

```typescript
export const IssueSchema = BaseEntity.extend({
  // ... existing fields ...

  // Hierarchical issues
  parent_id: IssueId.nullable().optional(),

  // Child ordering hints - soft ordering for children under this parent
  // Array of internal IssueIds in preferred display order
  // May contain stale IDs; display logic filters for actual children
  children_order_hints: z.array(IssueId).nullable().optional(),

  // ... rest of fields ...
});
```

### Internal ID Usage

Like all other cross-references in the schema (e.g., `parent_id`,
`dependencies.target`), `children_order_hints` stores internal IDs (`is-{ulid}`), not
short IDs. This ensures:

- Stability across short ID remapping
- Consistency with existing patterns
- No additional mapping layer needed

### Key Code Changes

#### 1. Schema (`packages/tbd/src/lib/schemas.ts`)

- Add `children_order_hints: z.array(IssueId).nullable().optional()` to IssueSchema

#### 2. Update Command (`packages/tbd/src/cli/commands/update.ts`)

- When `--parent` is set and resolved to a parent issue:
  - Load parent issue
  - Append child’s internal ID to parent’s `children_order_hints` (if not present)
  - Save parent issue
- Add `--children-order` option:
  - Parse comma-separated short IDs
  - Resolve each to internal ID
  - Set as the new `children_order_hints` array

#### 3. Tree View (`packages/tbd/src/cli/lib/tree-view.ts`)

- Modify `buildIssueTree()` to accept parent order hints
- In the parent-child relationship pass, sort children using `ordering.manual()`
- Children in hints appear first in hints order; others follow in default order

#### 4. List Command (`packages/tbd/src/cli/commands/list.ts`)

- When building tree view, pass each parent’s `children_order_hints` to the tree builder

#### 5. Show Command (`packages/tbd/src/cli/commands/show.ts`)

- Add `--show-order` flag
- When flag is set, display `children_order_hints` as short IDs after the main issue
  output

### Sorting Algorithm

Using the existing `ordering.manual()` from `comparison-chain.ts`:

```typescript
// In tree-view.ts, when sorting children
const sortChildren = (children: TreeNode[], hints: string[] | undefined): TreeNode[] => {
  if (!hints || hints.length === 0) {
    // No hints - use default order (ID for determinism)
    return children.sort(
      comparisonChain<TreeNode>()
        .compare((n) => n.issue.id)
        .result()
    );
  }

  return children.sort(
    comparisonChain<TreeNode>()
      .compare((n) => n.issue.id, ordering.manual(hints))
      .compare((n) => n.issue.id) // Secondary for items not in hints
      .result()
  );
};
```

The `ordering.manual(hints)` comparator:
- Items in `hints` array sort by their position in the array
- Items not in `hints` sort after all hinted items
- Among non-hinted items, secondary sort (by ID) ensures determinism

## Stage 3: Refine Architecture

### Reusable Components Found

1. **`ordering.manual()`** in `comparison-chain.ts` — Already implements manual sort
   overlay, no new sorting code needed

2. **`resolveToInternalId()`** in `update.ts` — Existing helper for short ID → internal
   ID resolution, reuse for `--children-order` parsing

3. **`loadFullContext()`** in `data-context.ts` — Provides ID resolution helpers and
   data access patterns

4. **`serializeIssue()`** in `parser.ts` — Will automatically include the new field in
   YAML output

### Performance Considerations

- `children_order_hints` is a small array (typically <20 items)
- `ordering.manual()` creates a Map for O(1) lookups
- No additional file reads required; hints stored on parent issue
- No database queries or indexes affected (file-based storage)

### Simplifications

- No need for complex insertion/reordering logic—only full replacement
- No validation of hint IDs—stale IDs are harmless (filtered out during display)
- No automatic cleanup—avoids transactional complexity

## Stage 4: Implementation

### Phase 1: Schema and Basic Storage

- [ ] Add `children_order_hints` field to `IssueSchema` in `schemas.ts`
- [ ] Add corresponding type to `types.ts` if needed
- [ ] Verify serialization/parsing handles the new field correctly
- [ ] Write unit test: issue with `children_order_hints` serializes and deserializes
  correctly

### Phase 2: Automatic Population on Parent Set

- [ ] In `update.ts`, when `--parent` is set to a valid parent:
  - Load the parent issue
  - Append child ID to `children_order_hints` (dedup check)
  - Save parent issue with incremented version
- [ ] Write unit test: setting parent appends to hints
- [ ] Write unit test: setting parent when already in hints doesn’t duplicate
- [ ] Write unit test: removing parent (empty string) doesn’t affect hints

### Phase 3: Display Ordering

- [ ] Modify `buildIssueTree()` signature to accept order hints per parent
- [ ] Create helper function `sortChildren()` using `ordering.manual()`
- [ ] Apply sorting in tree-view when building children arrays
- [ ] In `list.ts`, pass order hints when calling tree view functions
- [ ] Write unit test: children sorted by hints order
- [ ] Write unit test: children not in hints appear after hinted ones
- [ ] Write unit test: empty/missing hints uses default order

### Phase 4: Manual Update Command

- [ ] Add `--children-order` option to update command
- [ ] Parse comma-separated short IDs
- [ ] Resolve each to internal ID (error if any not found)
- [ ] Set `children_order_hints` field on issue
- [ ] Write unit test: `--children-order a,b,c` sets correct internal IDs
- [ ] Write unit test: `--children-order ""` clears the list
- [ ] Write e2e test: full round-trip (set order, list, verify order)

### Phase 5: Show Command Enhancement

- [ ] Add `--show-order` flag to show command
- [ ] When flag is set, output `children_order_hints` (as short IDs)
- [ ] Format: after main issue output, add line like `Children order: bd-a1b2, bd-c3d4`
- [ ] If no hints, show “Children order: (none)”
- [ ] Write unit test: `--show-order` displays hints correctly

### Phase 6: Validation and Cleanup

- [ ] Run full test suite
- [ ] Run lint and typecheck
- [ ] Test manually with various scenarios:
  - Create parent, add children in order
  - Verify `tbd list --pretty` shows correct order
  - Reset order with `--children-order`
  - Verify new order in list
  - Check `--show-order` displays correctly
- [ ] Update any relevant documentation

## Validation

- [ ] All tests pass (existing + new)
- [ ] Lint, typecheck, format pass
- [ ] Build succeeds
- [ ] Manual testing confirms expected behavior
- [ ] Backward compatibility: existing issues work unchanged
