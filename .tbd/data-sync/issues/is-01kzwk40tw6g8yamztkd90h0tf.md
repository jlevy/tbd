---
type: is
id: is-01kzwk40tw6g8yamztkd90h0tf
title: Audit Ready semantics and prominence in the live browser
kind: task
status: closed
priority: 1
version: 3
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:37:12.283Z
updated_at: 2026-08-13T04:06:22.914Z
closed_at: 2026-08-13T04:06:22.914Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Review the Ready concept end to end before changing UI prominence. Map the CLI semantics and documentation, server/query computation, client filter and row tag, tests, and actual workflow value. Decide whether Ready is an actionable derived state worth retaining, whether its row-level tag duplicates other signals, and how prominent the control should be. Document the conclusion in the authoritative design/spec docs and implement any justified UI adjustment with tests.

## Notes

Audited Ready end to end: it remains the exact documented tbd ready predicate (open, unassigned, and no open blocker), so the checkbox is useful and retained. Its row indicator is now quiet, unboxed derived metadata after user labels rather than a prominent lifecycle chip.
