---
type: is
id: is-01ktyeyn8hpk1pxgyb4sxpcxc3
title: "Capture design rationale: export-only forking and resolve-by-convention"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesp3hmzqdxdg3zs79tjhz
created_at: 2026-06-12T17:44:22.033Z
updated_at: 2026-06-12T18:20:51.257Z
closed_at: 2026-06-12T18:20:51.257Z
close_reason: "Done in e8b5112: spec Alternatives gains the copy-all-and-gitignore rejection; tbd-design 2.9 states the resolve-by-convention / track-only-non-derivable / docmap-is-a-view principle."
---
[Phase 0.2] PR #169 review sec 3. (a) Spec Alternatives: add 'copy all docs into docs/tbd and gitignore the unforked ones' as a considered+rejected alternative (gitignored mirrors are invisible on GitHub; edits to them silently diverge with no team visibility; gitignore-on-tracked-files semantics; sync-vs-deletion contradictions; fork --all already gives all-visible in tracked form). (b) tbd-design 2.9: one short paragraph stating the principle - resolve by convention (search path), track only what cannot be derived (fork point/provenance), publish the inventory as a generated view (docmap is a view, not an input today).
