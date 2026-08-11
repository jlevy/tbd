---
type: is
id: is-01kzqmssswsrh8necjx6js9ecf
title: "PR #206 review R2: board refresh() drops SSE wake during in-flight fetch"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T05:30:22.395Z
updated_at: 2026-08-11T05:30:22.395Z
---
Bugbot Medium, packages/tbd/scripts/bead-web.html:951 (arrived on #206 via the #207 merge). refresh() treats an in-flight fetch with a matching query string as already handled, so a data wake during fetch can be dropped. Real, but in spike code that PR #207 phases 3-4 rewrite into src/cli/web/ with SSE tip-as-event-id resume. Disposition: defer to web productionization; fix belongs in the rewritten client, not the spike.
