---
type: is
id: is-01m0c70wfbn8sz4r2x65kdzffw
title: "PR #245 review R4: sibling headers overstate cross-spec dependency"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0c70tzc5skz4tp79sfmmyrg
created_at: 2026-08-19T05:13:37.514Z
updated_at: 2026-08-19T05:15:11.671Z
closed_at: 2026-08-19T05:15:11.668Z
close_reason: "Fixed in 89c97de9: both Sibling headers scoped to the identity-binding phase"
---
Both specs' Sibling lines say the actor spec depends on the resolver; only actor Phase 2 does. Scope wording to the identity-binding phase.
