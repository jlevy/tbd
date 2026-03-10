---
type: is
id: is-01kf8180r77abr20pjpnzr7t2f
title: Document all merge strategies completely
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies: []
parent_id: is-01kf817cfba3htpetxgesej8hx
created_at: 2026-01-18T07:48:51.079Z
updated_at: 2026-03-09T16:12:31.875Z
closed_at: 2026-01-18T07:54:01.974Z
close_reason: Already completed as part of tbd-9bgj - merge strategies table now shows all 4 strategies (Immutable, LWW, Union, Max+1) with complete field lists
---
tbd-design.md only shows 3 merge strategies (LWW, Union, Immutable) but the spec defines more: lww_with_attic, merge_by_id, max_plus_one, recalculate, preserve_oldest, deep_merge_by_key. Need to either add these or note they exist with reference to full spec.
