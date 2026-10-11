---
type: is
id: is-01m4map1z8hhmcpqjcxr4e8frq
title: "PR324 A4: Use resolved actor identity in takeover and handoff"
kind: bug
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
hold: null
hold_until: null
created_at: 2026-10-11T01:54:19.750Z
updated_at: 2026-10-11T01:54:28.923Z
started_at: 2026-10-11T01:54:28.923Z
---
Medium finding A4 from https://github.com/jlevy/tbd/pull/324#pullrequestreview-5481539139. whoami --as must inspect flag identity; raw update --delegate stores verbatim and can differ from normalized start actor. Require unique resolved names.
