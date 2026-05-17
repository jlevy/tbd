---
type: is
id: is-01kra9a79pckz3rj3fq1jb88w7
title: "Wire docmap: block in .tbd/config.yml (workflow W1)"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9a7mp2ta4536cre83mt13
  - type: blocks
    target: is-01kra9a8ae405nqc2mh0jfd8zf
parent_id: is-01kra98szn2ah4f59kmbnfbery
created_at: 2026-05-11T01:09:37.206Z
updated_at: 2026-05-11T01:11:13.513Z
---
Replace the existing docs_cache block with a docmap: manifest block conforming to the docmap manifest schema. No files: / lookup_path: — those are removed entirely (no runtime compat).

Spec: Phase 1 bullet 1 (line ~1603), Workflow W1.
