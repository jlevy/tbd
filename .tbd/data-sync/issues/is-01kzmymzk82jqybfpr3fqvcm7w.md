---
type: is
id: is-01kzmymzk82jqybfpr3fqvcm7w
title: tbd update --due rejects a plain date and reports a raw Zod error
kind: bug
status: closed
priority: 2
version: 3
labels:
  - cli-ux
dependencies: []
created_at: 2026-08-10T04:24:46.951Z
updated_at: 2026-08-20T06:01:19.609Z
closed_at: 2026-08-20T06:01:19.607Z
close_reason: Both halves fixed. The raw Zod dump became a clean sentence when writeIssue started formatting its errors; --due and --defer now normalize a plain date and refuse an unparseable one by flag name. Tests added.
resolution: null
duplicate_of: null
---
tbd update <id> --due 2026-09-01 fails with a raw schema dump:

  "message": "Invalid datetime",
  "path": [ "due_date" ]

The help text says '--due <date>' for update and '--due <date>  Due date (ISO8601)' for create, but only a full datetime is accepted (2026-09-01T00:00:00Z works). Two issues: a plain calendar date is the obvious input for a due date and is rejected, and the failure surfaces as an unformatted Zod error rather than an actionable CLI message naming the accepted format.

Fix: either coerce a bare YYYY-MM-DD to end-of-day UTC, or catch the validation failure and emit a normal ValidationError showing an accepted example. Same treatment for --defer, which takes the same shape.

Found while exercising all-field change coverage for the watch viewer.
