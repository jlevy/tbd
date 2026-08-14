---
type: is
id: is-01kzze197akw5m3y7e3s9wmvaf
title: Stamp repository with published tbd 0.6.0
kind: task
status: closed
priority: 1
version: 2
labels:
  - release
dependencies: []
parent_id: is-01kzz0cgt3p51mrh1rt5bg9ypq
created_at: 2026-08-14T06:06:02.975Z
updated_at: 2026-08-14T07:49:24.396Z
closed_at: 2026-08-14T07:49:24.395Z
close_reason: "Completed by PR #218 using exact published get-tbd@0.6.1 after correcting the immutable 0.6.0 artifact. Repository is stamped f07/0.6.1 and post-merge main CI passed."
---
After get-tbd 0.6.0 is verified on npm and GitHub, run the exact published 0.6.0 setup --auto in a clean main worktree. Commit the f07 config stamp and refreshed managed agent surfaces in a follow-up PR, pass CI, merge it, and verify main is clean. This must remain post-publish so latest resolves to a client that understands f07.
