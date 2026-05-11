---
type: is
id: is-01kra99k339r7jwtw5wdjzbrs5
title: "Q18: Decide override provenance (computed-by-name vs recorded edge)"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
  - type: blocks
    target: is-01kra9b8m3jtk1jp7qyzdkvy1a
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:16.515Z
updated_at: 2026-05-11T01:11:17.020Z
---
Decision required before Phase 2 override roundtrip work. Depends on Q16.

- A. Computed-by-name (current). Cheap; no extra state. Roundtrip degrades when upstream renames/removes.
- B. Frontmatter pointer in override doc (_upstream: {source_id, docref, revision, content_hash}).
- C. Sidecar edge (.tbd/overrides.yml or <file>.override.yml).
- D. tbd-internal overlay file (.tbd/docmap-overrides.yml). Single source of truth.

Cases that get muddy without provenance: late-arriving upstream creates fake override; removing upstream loses diff/unfork data; upstream rename loses discoverability; tbd source upstream PR needs exact upstream source/path/revision.

Spec section: ## Open Questions → Q18 (line ~856).
