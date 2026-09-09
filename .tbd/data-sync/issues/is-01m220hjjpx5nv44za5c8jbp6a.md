---
type: is
id: is-01m220hjjpx5nv44za5c8jbp6a
title: Define native comment record and no-replace storage
kind: feature
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-model
labels: []
dependencies:
  - type: blocks
    target: is-01m220htdx8tv5k1mpjavfpsca
  - type: blocks
    target: is-01m222xy6md5svr7r89cdjkh1g
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
created_at: 2026-09-09T02:39:23.733Z
updated_at: 2026-09-09T04:54:36.402Z
closed_at: 2026-09-09T04:54:36.401Z
close_reason: "Implemented immutable native-comment records and create-only storage in PR #282; full local CI and all GitHub checks pass across Linux, macOS, and Windows."
resolution: null
duplicate_of: null
---
Phase 2 stacked PR layer 1. Specify and implement the immutable native comment record, cm ID grammar, hash-sharded data-sync path, strict serialization and validation, bounded body size, and atomic create-if-absent publication with identical-retry and mismatched-ID outcomes. Add a current architecture document and focused red-green tests. Do not expose a public native write command or upgrade existing f08 repositories in this layer; Phase 2 remains gated on the unfinished Phase 1 epic.

## Notes

Foundation implementation is published as stacked PR #282 (https://github.com/jlevy/tbd/pull/282) on #279. Strict cm-ULID records, canonical Markdown, well-formed Unicode and byte bounds, hash fanout, bounded no-follow reads, atomic create-only publication, exact-byte retry identity, and content-addressed candidate preservation are complete. Existing f08 format, CLI, package exports, and dependencies remain unchanged. Validation: pnpm run ci passed 167 files / 2514 tests; pre-push gates including package age passed; independent compatibility audit and senior code review found no remaining issues.
