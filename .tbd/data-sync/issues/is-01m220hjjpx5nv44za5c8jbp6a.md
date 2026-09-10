---
type: is
id: is-01m220hjjpx5nv44za5c8jbp6a
title: Define native comment record and no-replace storage
kind: feature
status: closed
priority: 1
version: 13
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
updated_at: 2026-09-10T06:41:20.124Z
closed_at: 2026-09-09T04:54:36.401Z
close_reason: "Implemented immutable native-comment records and create-only storage in PR #282; full local CI and all GitHub checks pass across Linux, macOS, and Windows."
resolution: null
duplicate_of: null
---
Phase 2 stacked PR layer 1. Specify and implement the immutable native comment record, cm ID grammar, hash-sharded data-sync path, strict serialization and validation, bounded body size, and atomic create-if-absent publication with identical-retry and mismatched-ID outcomes. Add a current architecture document and focused red-green tests. Do not expose a public native write command or upgrade existing f08 repositories in this layer; Phase 2 remains gated on the unfinished Phase 1 epic.

## Notes

Foundation implementation is published as stacked PR #282 (https://github.com/jlevy/tbd/pull/282) on #279. Restacked final head: be81594396c3e136700e9cac84cf85404ac3cfbd. Strict cm-ULID records, canonical Markdown, well-formed Unicode and byte bounds, hash fanout, bounded no-follow reads, atomic create-only local publication, exact-byte retry identity, and content-addressed candidate preservation are complete. Existing f08 format, CLI, package exports, dependencies, and provider-comment behavior remain unchanged. Validation after restack: Flowmark and doc links; focused model/parser/format/provider tests (247); bounded full Vitest (167 files / 2519 tests); typecheck, lint, build, release:verify, packed f08/f06/legacy-remote upgrade proofs, and built-package negative assertions all passed. No dependency manifest or lockfile changed and pnpm audit --prod found no known vulnerabilities. Independent review found no merge-blocking or severity findings; two mandatory pre-freeze suggestions, S282-01 syscall/error-path evidence and S282-02 durable agent-ID grammar, are tracked in tbd-z3ag before format freeze or activation. The first leased push left the remote unchanged after one default five-second timeout in an unbounded local hook run with 2518 tests passed; both Git/subprocess-heavy candidates passed serially, and the exact-leased retry used the previously authorized local-hook exception. Exact-head GitHub CI then passed all 7 checks across Ubuntu Node 22/24, macOS, Windows, coverage/lint, benchmark, and DeepSource.
