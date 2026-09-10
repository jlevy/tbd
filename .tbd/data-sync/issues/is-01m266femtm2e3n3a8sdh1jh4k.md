---
type: is
id: is-01m266femtm2e3n3a8sdh1jh4k
title: Qualify watch-beads worker recipe for current readiness gaps
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T17:40:03.353Z
updated_at: 2026-09-10T20:20:02.986Z
started_at: 2026-09-10T18:27:56.731Z
closed_at: 2026-09-10T20:20:02.986Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-01: The watch-beads shortcut currently implies watch --ready drains existing work and wakes when deferred_until expires. Document the current remote-tip-only behavior and the initial/periodic readiness checks required until tbd-zxg6 lands.
