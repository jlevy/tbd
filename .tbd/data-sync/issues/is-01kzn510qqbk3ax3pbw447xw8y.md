---
type: is
id: is-01kzn510qqbk3ax3pbw447xw8y
title: tbd integration link / unlink / import with one-source guard
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5117ezkyh9c1dqgr9pwty
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:12.790Z
updated_at: 2026-08-10T06:16:13.293Z
---
link <bead> <ref> attaches a bead to an external item, refusing when already linked (--force re-links via unlink semantics). unlink <bead>. import <ref> creates a linked bead from an external item: explicitly user-invoked, NOT part of mirror, so the one-way claim stays honest. Provider inferred from ref via registry, --provider to disambiguate. Spec Component 6 and API Changes.
