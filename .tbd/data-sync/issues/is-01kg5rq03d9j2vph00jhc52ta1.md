---
created_at: 2026-01-29T20:56:57.708Z
dependencies: []
id: is-01kg5rq03d9j2vph00jhc52ta1
kind: task
labels: []
priority: 1
status: open
title: "Post-mortem: Silent error swallowing - process improvements to prevent recurrence"
type: is
updated_at: 2026-01-29T20:57:34.156Z
version: 2
---
## Background

A P0 bug (tbd-ca3g) was discovered where `tbd sync` silently swallowed push failures and reported "Already in sync" to users, leading them to believe their data was synced when it wasn't.

## Root Cause Analysis

The pattern that led to this bug:
1. An operation result was stored: `const result = await this.doPushWithRetry()`
2. Failure was only logged to debug: `this.output.debug('Push failed: ...')`
3. The function continued and reported success based on other criteria

## Systematic Fixes to Prevent Recurrence

### 1. Code Pattern: Explicit Result Handling
Create a lint rule or code pattern that requires explicit handling of `{ success: boolean }` results:
```typescript
// BAD: Silent swallowing
const result = await operation();
if (\!result.success) {
  this.output.debug(`Failed: ${result.error}`); // Hidden\!
}
// continues as if nothing happened...

// GOOD: Explicit handling required
const result = await operation();
if (\!result.success) {
  throw new SyncError(result.error); // Or explicit user-facing error
}
```

### 2. ESLint Rule
Create a custom ESLint rule that flags:
- `output.debug()` calls that contain error/fail strings without a corresponding throw or user-visible error
- Functions returning `{ success: false }` where the failure path only logs to debug

### 3. Type-Level Enforcement
Consider using a Result type that must be unwrapped:
```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
// Forces explicit handling via pattern matching
```

### 4. Code Review Checklist
Add to review checklist:
- [ ] All git operations have explicit error handling
- [ ] Failures are reported to users, not just logged to debug
- [ ] No "success" message is shown if any critical operation failed

### 5. Test Coverage
Add tests that verify:
- Sync failures are reported to users (not just logged)
- Exit codes reflect actual success/failure
- JSON output includes failure information

## Action Items

1. [ ] Audit all `output.debug()` calls for hidden error swallowing
2. [ ] Create ESLint rule for error-swallowing patterns
3. [ ] Add explicit error handling guidelines to CLAUDE.md
4. [ ] Add tests for failure scenarios in sync, push, pull
