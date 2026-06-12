---
type: is
id: is-01ktyeyyk5jjm8yq7hkmdxayn8
title: docref-format.md reference doc + wire validation into tbd
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:31.589Z
updated_at: 2026-06-12T17:44:31.589Z
---
[Phase 0.3 / Phase 2] PR #169 review sec 4. Author references/docref-format.md: the grammar, internal: defined app-relatively (the consuming tool's bundled collection), strictness decisions, syntactic equality semantics (no case normalization), purl cited as prior art and why it does not fit. Then enforce the docref-everywhere rule somewhere real: tryParseDocRef validation at manifest read and docs status (today nothing outside the module parses a docref).
