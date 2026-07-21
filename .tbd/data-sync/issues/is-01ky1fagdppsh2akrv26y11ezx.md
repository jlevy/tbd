---
type: is
id: is-01ky1fagdppsh2akrv26y11ezx
title: "PR #196 review R6: explicit empty --spec now activates the filter"
kind: bug
status: closed
priority: 3
version: 3
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:39.062Z
updated_at: 2026-07-21T04:48:29.783Z
closed_at: 2026-07-21T04:48:29.783Z
close_reason: "Fixed in 52867bd: explicit empty --spec treated as no-filter in change-selection and list, restoring historic behavior."
---
Shared-predicate refactor passes options.spec ?? null, so --spec '' becomes an active filter in list/changes/watch where old list code ignored it. list.ts:206-213, change-selection.ts:44. Fix: treat empty string as absent.
