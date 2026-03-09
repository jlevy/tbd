---
close_reason: Superseded by compile cache approach (tbd-1937). Lazy loading was attempted but showed minimal benefit due to single-bundle architecture. Compile cache provides ~25% improvement with much less complexity.
closed_at: 2026-01-17T12:43:09.376Z
created_at: 2026-01-17T11:22:04.118Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.111Z
    original_id: tbd-1934
id: is-01kf5zyg8qapr45a89xtqjzyhh
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement lazy command loading for CLI startup performance
type: is
updated_at: 2026-03-09T16:12:30.807Z
version: 6
---
## Goal
Reduce CLI startup time from ~55ms to ~30ms for help/version/simple commands by lazy-loading command handlers.

## Background
Profiling shows:
- V8 baseline: ~20ms (unavoidable)
- Commander + picocolors: ~9ms
- Zod + yaml + schemas: ~18ms (loaded for ALL commands even help/version)

Currently all 24 commands and their dependencies load at startup. With lazy loading, only commander+picocolors load until a command is actually invoked.

## Approach
Move from eager command registration to lazy dynamic imports:

```typescript
// BEFORE: All commands load at startup
import { listCommand } from './commands/list.js';
program.addCommand(listCommand);

// AFTER: Commands load on-demand
program
  .command('list')
  .description('List issues')
  .option('--status <status>', '...')
  .action(async (opts, cmd) => {
    const { ListHandler } = await import('./commands/list.js');
    await new ListHandler(cmd).run(opts);
  });
```

## Implementation Steps
1. Create command-definitions.ts with option specs (no heavy imports)
2. Refactor cli.ts to use lazy imports in action handlers
3. Update command files to export handlers only (no Command creation)
4. Verify help text still works correctly
5. Run benchmarks to confirm improvement

## Expected Results
- help/version: ~55ms → ~30ms
- Actual commands: ~55ms → ~55ms (same, loads deps on first use)

## Files to Modify
- packages/tbd-cli/src/cli/cli.ts
- packages/tbd-cli/src/cli/commands/*.ts (all 24 files)
