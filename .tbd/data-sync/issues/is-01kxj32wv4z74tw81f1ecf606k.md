---
type: is
id: is-01kxj32wv4z74tw81f1ecf606k
title: Add full-state regression coverage for setup dry-run
kind: task
status: closed
priority: 1
version: 5
labels:
  - testing
  - setup
  - dry-run
dependencies:
  - type: blocks
    target: is-01kxj32x4qe3m6xh137axnjv68
parent_id: is-01kxj32wgrjfa51wytr33z286r
created_at: 2026-07-15T05:13:10.244Z
updated_at: 2026-07-15T05:59:12.117Z
closed_at: 2026-07-15T05:59:12.116Z
close_reason: Added fresh and initialized linked-worktree whole-state dry-run regression tests.
---
Create the failing behavioral tests before changing setup implementation.

Acceptance criteria:
- Snapshot file paths, contents, modes, and relevant symlink metadata for the entire temporary project before and after setup --auto --dry-run, including tracked, untracked, and ignored files.
- Snapshot relevant shared git-common-dir tbd state so layout/worktree writes cannot hide outside git status.
- Cover an older tbd_version/tbd_upgrades stamp, an f05-to-f06 config migration, missing .tbd gitignore/gitattributes entries, stale docs cache/config/state, legacy hooks/scripts, and stale or missing agent surfaces.
- Assert byte-for-byte and metadata equality after dry-run, a clean git status, correct exit code, and hypothetical output for every planned change.
- Keep fixtures local and network-free; use the local built CLI and a temporary git repository.
- Retain the focused issue #126 hook tests while adding the broader invariant.
