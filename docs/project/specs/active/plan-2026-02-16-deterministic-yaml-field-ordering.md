# Feature: Deterministic YAML Field Ordering

**Date:** 2026-02-16

**Author:** Claude

**Status:** Draft

## Overview

Replace alphabetical YAML key sorting with deterministic manual field ordering across
all YAML serializations in tbd. Field order will mirror the Zod schema definitions,
putting the most human-relevant fields (title, kind, status, priority) near the top and
bookkeeping fields (version, timestamps, extensions) near the bottom.

This uses the `ordering.manual()` pattern from the existing `comparison-chain.ts`
utility, which is already used elsewhere in the codebase for custom sort orderings.

## Goals

- Define explicit field order arrays for each Zod schema that is serialized to YAML
- Ensure field order in the arrays mirrors the Zod schema definition order
- Replace alphabetical `Object.keys().sort()` with manual ordering in `serializeIssue()`
- Apply the same pattern to other YAML serialization points (Config, AtticEntry,
  LocalState, Meta)
- Use the existing `ordering.manual()` from `comparison-chain.ts` for the comparator
- Make issue YAML files significantly more readable by putting important fields first

## Non-Goals

- Changing the Zod schema definitions themselves (they already define fields in a
  sensible order)
- Changing the parsed representation or any runtime behavior
- Changing the YAML library or its configuration globally (changes are localized to
  serialization functions)
- Sorting nested object keys within arrays (e.g., individual dependency objects)

## Background

### Current State

All YAML serialization in tbd uses alphabetical key sorting via two mechanisms:

1. **Pre-sort in `serializeIssue()`** (`packages/tbd/src/file/parser.ts:126-130`):
   ```typescript
   const sortedMetadata: Record<string, unknown> = {};
   for (const key of Object.keys(metadata).sort()) {
     sortedMetadata[key] = metadata[key as keyof typeof metadata];
   }
   ```

2. **YAML library option** (`packages/tbd/src/lib/settings.ts:51`):
   ```typescript
   sortMapEntries: true,  // alphabetical sorting
   ```

This produces issue YAML with fields in alphabetical order:
```yaml
assignee: null
child_order_hints: null
close_reason: null
closed_at: null
created_at: 2025-01-07T10:00:00Z
created_by: alice
deferred_until: null
dependencies: []
due_date: null
extensions: {}
id: is-01hx5zzkbkactav9wevgemmvrz
kind: bug
labels:
  - backend
  - security
parent_id: null
priority: 1
spec_path: null
status: in_progress
title: Fix authentication timeout
type: is
updated_at: 2025-01-08T14:30:00Z
version: 3
```

The **title** is buried near the bottom. The **type** and **id** (the most fundamental
identity fields) are also buried. Timestamps and bookkeeping fields like `version` and
`extensions` are interleaved with human-relevant fields like `status` and `priority`.

### Desired State

Fields should appear in a human-friendly order that matches the Zod schema definition:

```yaml
type: is
id: is-01hx5zzkbkactav9wevgemmvrz
title: Fix authentication timeout
kind: bug
status: in_progress
priority: 1
assignee: alice
labels:
  - backend
  - security
dependencies: []
parent_id: null
child_order_hints: null
due_date: null
deferred_until: null
spec_path: null
created_by: alice
created_at: 2025-01-07T10:00:00Z
updated_at: 2025-01-08T14:30:00Z
closed_at: null
close_reason: null
version: 3
extensions: {}
```

This puts identity and content first, classification next, relationships and scheduling
in the middle, and bookkeeping at the bottom.

### Existing Utilities

The `ordering.manual()` function in `packages/tbd/src/lib/comparison-chain.ts:84-97`
already implements exactly what we need:

```typescript
const manualOrderComparator = <T>(order: readonly T[]): Comparator<T> => {
  const orderMap = new Map(order.map((value, index) => [value, index]));
  return (a: T, b: T): number => {
    const indexA = orderMap.get(a);
    const indexB = orderMap.get(b);
    if (indexA === undefined) return indexB === undefined ? 0 : 1;
    if (indexB === undefined) return -1;
    return indexA - indexB;
  };
};
```

Values not in the order array sort to the end, providing safe handling if new fields are
added to a schema but the order array isn't updated yet.

## Design

### Approach

1. **Define field order arrays** alongside each Zod schema in `schemas.ts` (or in a
   companion `field-orders.ts` file). Each array lists the schema's field names in the
   desired serialization order, mirroring the Zod definition order.

2. **Create a `sortKeys()` utility** that takes an object and a field order array,
   returning a new object with keys in the specified order. This uses
   `ordering.manual()` internally.

3. **Update each serialization point** to use `sortKeys()` instead of alphabetical
   sorting, and pass `sortMapEntries: false` to `stringifyYaml` to preserve the
   manual order (since `sortMapEntries: true` would re-sort alphabetically).

### Field Order Definitions

Each order array mirrors the Zod schema definition, with the principle: **identity
first, human-relevant fields next, bookkeeping last.**

#### Issue Fields

Derived from `IssueSchema` (note: `description` and `notes` are body content, not
frontmatter):

```typescript
export const ISSUE_FIELD_ORDER = [
  // Identity
  'type',
  'id',

  // Core content (most important for human readers)
  'title',

  // Classification
  'kind',
  'status',
  'priority',

  // Assignment and categorization
  'assignee',
  'labels',
  'dependencies',

  // Hierarchy
  'parent_id',
  'child_order_hints',

  // Scheduling
  'due_date',
  'deferred_until',

  // Linking
  'spec_path',

  // Provenance
  'created_by',

  // Timestamps
  'created_at',
  'updated_at',

  // Lifecycle (closure)
  'closed_at',
  'close_reason',

  // Internal bookkeeping (least important)
  'version',
  'extensions',
] as const;
```

#### Config Fields

Derived from `ConfigSchema`:

```typescript
export const CONFIG_FIELD_ORDER = [
  'tbd_format',
  'tbd_version',
  'display',
  'sync',
  'settings',
  'docs_cache',
] as const;
```

#### Attic Entry Fields

Derived from `AtticEntrySchema`:

```typescript
export const ATTIC_ENTRY_FIELD_ORDER = [
  'entity_id',
  'timestamp',
  'field',
  'lost_value',
  'winner_source',
  'loser_source',
  'context',
] as const;
```

#### Meta Fields

Derived from `MetaSchema`:

```typescript
export const META_FIELD_ORDER = [
  'schema_version',
  'created_at',
] as const;
```

#### Local State Fields

Derived from `LocalStateSchema`:

```typescript
export const LOCAL_STATE_FIELD_ORDER = [
  'last_sync_at',
  'last_doc_sync_at',
  'welcome_seen',
] as const;
```

### Key Utility: `sortKeys()`

A new utility function in `yaml-utils.ts` (or a new `field-ordering.ts`):

```typescript
import { ordering } from '../lib/comparison-chain.js';

/**
 * Create a new object with keys sorted according to a manual field ordering.
 * Fields not in the order array are placed at the end in their original order.
 */
export function sortKeys<T extends Record<string, unknown>>(
  obj: T,
  fieldOrder: readonly string[],
): Record<string, unknown> {
  const keyComparator = ordering.manual(fieldOrder);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort(keyComparator)) {
    sorted[key] = obj[key];
  }
  return sorted;
}
```

### Changes to Serialization Points

#### 1. `serializeIssue()` in `parser.ts`

**Before:**
```typescript
const sortedMetadata: Record<string, unknown> = {};
for (const key of Object.keys(metadata).sort()) {
  sortedMetadata[key] = metadata[key as keyof typeof metadata];
}
const yaml = stringifyYaml(sortedMetadata, { lineWidth: 0, nullStr: 'null' });
```

**After:**
```typescript
const sortedMetadata = sortKeys(metadata, ISSUE_FIELD_ORDER);
const yaml = stringifyYaml(sortedMetadata, {
  lineWidth: 0,
  nullStr: 'null',
  sortMapEntries: false,  // Preserve manual ordering
});
```

#### 2. `writeConfig()` in `config.ts`

**Before:**
```typescript
const yaml = stringifyYaml(config, { lineWidth: 0 });
```

**After:**
```typescript
const sorted = sortKeys(config, CONFIG_FIELD_ORDER);
const yaml = stringifyYaml(sorted, { lineWidth: 0, sortMapEntries: false });
```

#### 3. `writeLocalState()` in `config.ts`

**Before:**
```typescript
const yaml = stringifyYaml(state, { lineWidth: 0 });
```

**After:**
```typescript
const sorted = sortKeys(state, LOCAL_STATE_FIELD_ORDER);
const yaml = stringifyYaml(sorted, { lineWidth: 0, sortMapEntries: false });
```

#### 4. `saveAtticEntry()` in `attic.ts` and `saveConflictToAttic()` in `workspace.ts`

**Before:**
```typescript
const content = stringifyYaml(entry);
```

**After:**
```typescript
const sorted = sortKeys(entry, ATTIC_ENTRY_FIELD_ORDER);
const content = stringifyYaml(sorted, { sortMapEntries: false });
```

#### 5. Global default: keep `sortMapEntries: true`

The global `YAML_STRINGIFY_OPTIONS.sortMapEntries` stays `true` as a safe default for
any YAML serialization that doesn't explicitly override it. This way, only the
serialization points that opt in to manual ordering get it.

### Backward Compatibility

- **File format**: YAML field order has no semantic meaning; parsers read by key name,
  not position. Changing order is a no-op for readers.
- **Git diffs**: The first commit will produce a one-time diff on all existing issue
  files when they are next written (e.g., via `tbd update`, `tbd close`). After that,
  diffs will be smaller and more readable because related fields are grouped.
- **Existing tests**: Golden tests or snapshot tests that assert exact YAML output will
  need updating. Parser round-trip tests should be unaffected since they parse by field
  name.

## Implementation Plan

### Phase 1: Field Order Definitions and Utility

- [ ] Add field order arrays to `packages/tbd/src/lib/schemas.ts` (co-located with
  their Zod schemas)
- [ ] Add `sortKeys()` utility to `packages/tbd/src/utils/yaml-utils.ts`
- [ ] Add unit tests for `sortKeys()` (unknown keys go to end, empty order = original
  order, etc.)
- [ ] Add a compile-time or test-time check that each field order array contains all
  fields from its Zod schema (prevents drift)

### Phase 2: Apply to All Serialization Points

- [ ] Update `serializeIssue()` in `parser.ts` to use `sortKeys()` with
  `ISSUE_FIELD_ORDER`
- [ ] Update `writeConfig()` in `config.ts` to use `sortKeys()` with
  `CONFIG_FIELD_ORDER`
- [ ] Update `writeLocalState()` in `config.ts` to use `sortKeys()` with
  `LOCAL_STATE_FIELD_ORDER`
- [ ] Update `saveAtticEntry()` in `attic.ts` to use `sortKeys()` with
  `ATTIC_ENTRY_FIELD_ORDER`
- [ ] Update `saveConflictToAttic()` in `workspace.ts` to use `sortKeys()` with
  `ATTIC_ENTRY_FIELD_ORDER`
- [ ] Update any other serialization points found during implementation
- [ ] Update parser round-trip tests to verify field ordering
- [ ] Update any golden/snapshot tests that assert exact YAML output

## Testing Strategy

1. **Unit tests for `sortKeys()`**: Test manual ordering, unknown keys handling, empty
   inputs
2. **Field order completeness test**: Verify each field order array matches its Zod
   schema's keys (catches drift when fields are added)
3. **Round-trip tests**: Ensure `parseIssue(serializeIssue(issue))` produces identical
   data regardless of field order
4. **Serialization order tests**: Assert that `serializeIssue()` produces keys in the
   expected manual order
5. **Existing test suite**: Run full test suite to catch any regressions

## Open Questions

- Should nested objects (e.g., `Config.sync`, `Config.settings`, `AtticEntry.context`)
  also have explicit field orderings, or is alphabetical acceptable for small nested
  objects?
- Should we add a lint rule or CI check to enforce that field order arrays stay in sync
  with Zod schemas?

## References

- `tbd guidelines typescript-sorting-patterns` - Comparison chain and manual ordering
  patterns
- `packages/tbd/src/lib/comparison-chain.ts` - `ordering.manual()` implementation
- `packages/tbd/src/lib/schemas.ts` - Zod schema definitions
- `packages/tbd/src/file/parser.ts` - `serializeIssue()` current implementation
- `packages/tbd/src/lib/settings.ts` - YAML stringify options
