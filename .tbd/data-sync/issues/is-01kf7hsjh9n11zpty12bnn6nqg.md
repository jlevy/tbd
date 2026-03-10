---
type: is
id: is-01kf7hsjh9n11zpty12bnn6nqg
title: Audit and fix copy file operations to use atomic writes
kind: task
status: closed
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kf7hszjstaa0cn5jsnzskr75
created_at: 2026-01-18T03:18:49.128Z
updated_at: 2026-03-09T16:12:31.437Z
closed_at: 2026-01-19T08:21:32.828Z
close_reason: Completed in cf08856 - copy-docs.mjs now uses atomicCopy with atomically library
---
Audit all file copy operations in the codebase and ensure they use atomic writes.

Current issues:
- copy-docs.mjs uses Node's copyFileSync which is not atomic
- Need to find all other copy operations

The 'atomically' library we already use for writes can handle this:
```typescript
import { writeFile } from 'atomically';
// Read source, write atomically to dest
const content = await readFile(source);
await writeFile(dest, content);
```

Tasks:
1. Search codebase for all copyFile/copyFileSync usage
2. Replace with atomic read+write pattern
3. Consider creating a helper function for atomic copy
