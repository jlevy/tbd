---
type: is
id: is-01kzqwd1969akp4xrasm614n43
title: "PR #206 Bugbot R2: outbound attachments/splice unjournaled; journal deleted on failure"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T07:43:12.677Z
updated_at: 2026-08-11T07:43:19.415Z
closed_at: 2026-08-11T07:43:19.415Z
close_reason: Fixed in 9b30be4c with regression coverage; threads resolved, disposition on the PR.
---
Medium. Fixed in 9b30be4c: attachments + managed-block splice journaled against the create client UUID; journal consumed only on zero-failure runs. Crash-injection test pins replay to a complete item.
