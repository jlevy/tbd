---
type: is
id: is-01kf7hnha4ytvrx9c470qypj3d
title: Refactor copy-docs.mjs to use shared settings
kind: task
status: open
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kf7hnzdpcrp8db39nxemw8ej
  - type: blocks
    target: is-01kf7hx5ysfrbynw0cf54x6brb
created_at: 2026-01-18T03:16:36.803Z
updated_at: 2026-03-09T16:12:31.426Z
---
Refactor packages/tbd-cli/scripts/copy-docs.mjs to be less repetitive:

Current code has duplicated file lists for prebuild and postbuild phases:
```javascript
copyFileSync(join(repoRoot, 'docs', 'tbd-docs.md'), join(srcDocs, 'tbd-docs.md'));
copyFileSync(join(repoRoot, 'docs', 'tbd-design.md'), join(srcDocs, 'tbd-design.md'));
copyFileSync(join(repoRoot, 'docs', 'SKILL.md'), join(srcDocs, 'SKILL.md'));
copyFileSync(join(repoRoot, 'README.md'), join(srcDocs, 'README.md'));
```

Tasks:
1. Create a shared settings.ts file with the docs list
2. Import and use the list in copy-docs.mjs
3. Loop over the list instead of repeating copyFileSync calls
4. Handle both prebuild and postbuild phases with the same list
