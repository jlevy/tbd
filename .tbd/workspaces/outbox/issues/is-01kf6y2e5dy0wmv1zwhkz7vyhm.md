---
close_reason: Completed in cf08856 - enforce atomic writes and consolidate command context (#16)
closed_at: 2026-01-19T08:21:00.770Z
created_at: 2026-01-17T21:34:08.039Z
dependencies:
  - target: is-01kf6y2pm7sk2tzrzd90wnb4d5
    type: blocks
id: is-01kf6y2e5dy0wmv1zwhkz7vyhm
kind: task
labels: []
priority: 2
status: closed
title: Consolidate command context loading into unified CommandContext class
type: is
updated_at: 2026-03-09T16:12:31.158Z
version: 8
---
Currently, commands load configuration and mapping data in a repetitive pattern:

```ts
const mapping = await loadIdMapping(dataSyncDir);
const config = await readConfig(process.cwd());
```

While `loadDataContext()` in dataContext.ts exists, it should be expanded to:
1. Be the single source of truth for all command context data
2. Include the ctx (debug, json, color options) from the command
3. Be consistently used by ALL subcommands via the same mechanism
4. Be a shared library pattern that every subcommand uses identically

This will reduce code duplication and ensure consistent behavior across all commands.

References: packages/tbd-cli/src/cli/lib/dataContext.ts
