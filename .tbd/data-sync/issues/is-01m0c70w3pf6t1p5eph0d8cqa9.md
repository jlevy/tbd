---
type: is
id: is-01m0c70w3pf6t1p5eph0d8cqa9
title: "PR #245 review R3: resolver evidence conflates pre/post-provisioning counts"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0c70tzc5skz4tp79sfmmyrg
created_at: 2026-08-19T05:13:37.141Z
updated_at: 2026-08-19T05:15:11.204Z
closed_at: 2026-08-19T05:15:11.203Z
close_reason: "Fixed in 89c97de9: resolver section states the pre-provisioning three-state count; provisioned four stays in the evidence section"
---
state spec, resolver section says 'four started states'; pre-provisioning observation was three. Restore three here; evidence section keeps four.
