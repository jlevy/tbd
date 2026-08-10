---
type: is
id: is-01kzpj77hq9f1wkhb4mgqb69vq
title: "PR #207 review R2: ready view accepts --sort but banner claims exact tbd ready"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kzpj754g9qh0be784sdkxdwr
created_at: 2026-08-10T19:26:02.294Z
updated_at: 2026-08-10T21:26:50.213Z
closed_at: 2026-08-10T21:26:50.213Z
close_reason: Fixed in ac3b0776; threads replied and resolved on PR 207
---
describeQueryAsCommand's ready branch omits sort from the unsupported set (bead-web.ts ~:440), so ready=1&sort=updated shows 'tbd ready' with commandExact=true while rows are sorted in an order tbd ready cannot produce. Fix: non-default sort marks the ready command inexact.
