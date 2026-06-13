---
type: is
id: is-01ktyez5s6ygg9d22a07ef2146
title: "DocMap: version acceptance policy (docmap/0.* only)"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyessevb2mdcafd12z7670n
created_at: 2026-06-12T17:44:38.950Z
updated_at: 2026-06-12T18:20:49.397Z
closed_at: 2026-06-12T18:20:49.396Z
close_reason: "Fixed in a3a5b37: readers accept docmap/0.* only; other majors rejected with an unsupported-version error; tests added."
---
PR #169 review sec 4. parseDocMap accepts any docmap/* tag. Accept docmap/0.* and reject other majors with a clear unsupported-version error; state the reader policy in the format doc.
