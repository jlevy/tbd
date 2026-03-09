---
close_reason: Implemented documentation improvements
closed_at: 2026-01-17T10:56:04.137Z
created_at: 2026-01-17T10:41:18.185Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.951Z
    original_id: tbd-1911
id: is-01kf5zyg8ppvcfr8ps2p3nvsj1
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Revise Quick Reference with realistic examples
type: is
updated_at: 2026-03-09T16:12:30.593Z
version: 6
---
## Quick Reference

### Find and claim work
tbd ready                                  # What's available?
tbd show bd-1847                           # Review details
tbd update bd-1847 --status in_progress    # Claim it

### Complete work
tbd close bd-1847 --reason "Fixed in auth.ts, added retry logic"
tbd sync                                   # Push to remote

### Create issues
tbd create "API returns 500 on malformed input" -t bug -p 1
tbd create "Add rate limiting to /api/upload" -t feature
tbd create "Refactor database connection pooling" -t task -p 3

### Track dependencies
tbd create "Write integration tests" -t task
tbd dep add bd-1850 bd-1847               # Tests blocked until bd-1847 done
tbd blocked                                # See what's waiting

### Daily workflow
tbd sync                    # Start of session
tbd ready                   # Find work
# ... do work ...
tbd close bd-xxxx           # Complete
tbd sync                    # End of session
