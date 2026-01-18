---
created_at: 2026-01-18T03:19:20.048Z
dependencies: []
id: is-01kf7htgqhy36w25mnk7c6qwqs
kind: task
labels: []
priority: 3
status: open
title: Add ESLint rule to enforce atomically for file writes
type: is
updated_at: 2026-01-18T03:19:28.347Z
version: 2
---
Create or configure an ESLint rule to enforce use of 'atomically' library for all file write operations.

Options to explore:
1. Use eslint-plugin-node's no-restricted-imports to ban fs.writeFile imports
2. Create a custom ESLint rule that detects writeFile usage from 'fs' or 'fs/promises'
3. Use @typescript-eslint/no-restricted-imports

Example config:
```javascript
{
  'no-restricted-imports': ['error', {
    paths: [{
      name: 'fs',
      importNames: ['writeFile', 'writeFileSync'],
      message: 'Use writeFile from "atomically" instead for atomic writes.'
    }]
  }]
}
```

This prevents accidental use of non-atomic writes in future code.
