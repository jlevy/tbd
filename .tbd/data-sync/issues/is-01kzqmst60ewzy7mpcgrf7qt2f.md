---
type: is
id: is-01kzqmst60ewzy7mpcgrf7qt2f
title: "PR #206 review R3: GET /api/board reads mid-reload snapshot"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T05:30:22.783Z
updated_at: 2026-08-15T05:33:51.199Z
closed_at: 2026-08-15T05:33:51.199Z
close_reason: "Superseded and fixed by the production tbd web rewrite merged in PR #207."
---
Bugbot Medium, packages/tbd/scripts/bead-web.ts:1450 (arrived on #206 via the #207 merge). /api/board serves this.board without awaiting the serialized reload(), so a request during reloadOnce() can see a mixed snapshot. Real, but spike code; PR #207 phase 3 rebuilds the server with request/reload serialization. Disposition: defer to web productionization.
