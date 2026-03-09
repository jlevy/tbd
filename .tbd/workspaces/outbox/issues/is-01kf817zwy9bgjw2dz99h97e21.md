---
close_reason: Clarified dependency data model description to show exactly which issue stores the dependency and how to read the data model
closed_at: 2026-01-18T07:52:23.959Z
created_at: 2026-01-18T07:48:50.206Z
dependencies: []
id: is-01kf817zwy9bgjw2dz99h97e21
kind: bug
labels: []
parent_id: is-01kf817cfba3htpetxgesej8hx
priority: 2
status: closed
title: Fix confusing dependency data model description
type: is
updated_at: 2026-03-09T16:12:31.864Z
version: 8
---
tbd-design.md says 'Dependencies stored on the blocker: B.dependencies = [{type: "blocks", target: A}]' which is confusing. Need to clarify: when 'tbd dep add A B' runs (A depends on B), the dependency is stored on B (the blocker) pointing to A (the blocked). The current wording is technically correct but reads backwards.
