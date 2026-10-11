---
type: is
id: is-01m4map1z8hhmcpqjcxr4e8frq
title: "PR324 A4: Use resolved actor identity in takeover and handoff"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: sol-pr324-fixes-01a127df
labels: []
dependencies: []
parent_id: is-01m4manp9y8srxqpyce3sbq1xe
hold: null
hold_until: null
created_at: 2026-10-11T01:54:19.750Z
updated_at: 2026-10-11T02:25:53.889Z
started_at: 2026-10-11T01:54:28.923Z
closed_at: 2026-10-11T02:25:53.888Z
close_reason: Implemented in pushed845d55c; focused behavioral tests and hosted Coverage & Lint pass. Review A dispositions and security Review B published on PR324. Separate parser correctness defect and package proof remain tracked in tbd-7pdk/tbd-4x46.
resolution: null
duplicate_of: null
---
Medium finding A4 from https://github.com/jlevy/tbd/pull/324#pullrequestreview-5481539139. whoami --as must inspect flag identity; raw update --delegate stores verbatim and can differ from normalized start actor. Require unique resolved names.
