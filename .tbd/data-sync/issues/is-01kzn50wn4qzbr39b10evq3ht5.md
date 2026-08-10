---
type: is
id: is-01kzn50wn4qzbr39b10evq3ht5
title: "file/git.ts: extensions whole-object LWW to per-namespace merge (tbd-le2l)"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5152hkvnx553tj4gwgc28
parent_id: is-01kzn2w9gdhb0xt2hztn7v0aha
created_at: 2026-08-10T06:16:08.611Z
updated_at: 2026-08-10T06:16:17.232Z
---
FIELD_STRATEGIES currently sets extensions: 'lww', so two writers touching DIFFERENT namespaces silently drop one side. Change to per-namespace merge (union arrays within a namespace, recurse into the namespace map), with an attic entry on per-namespace loss. Prerequisite for extensions.github holding PR URLs (Component 4) and for any provider metadata living under extensions. Spec Background + Component 4.
