---
type: is
id: is-01m1hzmtahp48jg4rm4aahx4w0
title: "PR #264 review R6: create --defer still fails on bare dates"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m1hzmrdcgkf45b2nf8mhqghq
created_at: 2026-09-02T21:15:50.480Z
updated_at: 2026-09-02T21:43:55.361Z
closed_at: 2026-09-02T21:43:55.360Z
close_reason: "Fixed in c1235d3c on PR #264; disposition map posted as issuecomment-5516854053."
resolution: null
duplicate_of: null
---
create.ts:191-192. Verified exit 1 with deferred_until: Invalid datetime. Route create --due/--defer through parseDateOption and cover in the tryscript.
