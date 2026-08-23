---
type: is
id: is-01m0ph9m9kt4tv25sbhht10a20
title: Delete the three-option Clippy menu from rust-project-setup
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:25:34.131Z
updated_at: 2026-08-23T08:35:01.767Z
closed_at: 2026-08-23T08:35:01.767Z
close_reason: "Completed in PR #258 (branch claude/rust-guidelines-extraction-o9x2yy)."
resolution: null
duplicate_of: null
---
rust-project-setup section 'Define a Clippy Policy' offers three lint strategies whose first option, default lints plus -D warnings, is materially weaker than the other two. An agent handed ranked alternatives takes the cheapest. Reduce the section to a pointer at rust-lint-format-rules. The same no-menus pass resolves the 19 instances of choose/may/either/one-of phrasing across the seven Rust documents.
