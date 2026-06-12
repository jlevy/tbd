---
type: is
id: is-01ktyez7efx62agahwy47sxmwz
title: "docmap-format.md (Phase 0.3): path-relativity, extension fields, view-not-input"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyessevb2mdcafd12z7670n
created_at: 2026-06-12T17:44:40.655Z
updated_at: 2026-06-12T20:25:50.092Z
closed_at: 2026-06-12T20:25:50.092Z
close_reason: "Done in e5ce028: references/docmap-format.md authored — location required per entry, path relativity (relative to the docmap's own directory; generated maps state their root), extension-field policy with size metrics as extensions, docmap/0.* reader policy, and the view-not-input principle."
---
PR #169 review sec 4. When authoring references/docmap-format.md include: path is relative to the docmap file's own directory (committed files) or a stated collection root (generated output); extension-field policy (consumers ignore unknown fields; size metrics are extensions); and the principle that the docmap is a generated view, not a resolution input.
