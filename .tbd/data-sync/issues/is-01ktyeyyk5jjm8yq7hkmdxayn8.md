---
type: is
id: is-01ktyeyyk5jjm8yq7hkmdxayn8
title: docref-format.md reference doc + wire validation into tbd
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:31.589Z
updated_at: 2026-06-12T20:25:48.691Z
closed_at: 2026-06-12T20:25:48.691Z
close_reason: "Done in e5ce028: references/docref-format.md authored (forms, strictness rationale, normalization incl. fragment preservation, syntactic equality, purl prior art, future-protocols note) and the docref-everywhere rule enforced at a real boundary — manifest source fields validate via isDocRef on read (invalid entries dropped with the existing warning). Serving the doc through a reference kind remains Phase 5."
---
[Phase 0.3 / Phase 2] PR #169 review sec 4. Author references/docref-format.md: the grammar, internal: defined app-relatively (the consuming tool's bundled collection), strictness decisions, syntactic equality semantics (no case normalization), purl cited as prior art and why it does not fit. Then enforce the docref-everywhere rule somewhere real: tryParseDocRef validation at manifest read and docs status (today nothing outside the module parses a docref).
