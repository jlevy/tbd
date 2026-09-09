---
type: is
id: is-01m222yv5nn21vthsjnqwg1vc5
title: Add native-comment doctor migration and compatibility gates
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-compat
labels: []
dependencies: []
parent_id: is-01m220htdx8tv5k1mpjavfpsca
created_at: 2026-09-09T03:21:35.665Z
updated_at: 2026-09-09T06:12:14.603Z
---
Add read-only-first doctor diagnostics and deterministic repair/quarantine surfaces for native comments; make misplaced-data migration, scaffold readiness/repair, and sync metadata comment-aware; install and validate data-sync attributes that disable text, encoding, identity, and filter transformations for comment and quarantine paths; disable all doctor fixes under unreadable or future format state; and extend packed previous-client and stale-branch upgrade tests to snapshot raw comment and evidence trees. This is the f08-compatible preservation release gate before f09 activation.

## Notes

The compatibility gate owns graph-level read-only diagnostics that require complete issue and native-comment inventories: report a reply_to whose known record belongs to a different bead; retain missing reply targets and missing target beads as unresolved, recoverable references rather than corrupt records; and keep fixes disabled until explicit repair can preserve both sides. Model-level self-replies are already rejected. This bead also owns scaffold repair and doctor reporting for missing or conflicting non-transform data-sync attributes. The activation CLI must surface these states without rewriting immutable records.
