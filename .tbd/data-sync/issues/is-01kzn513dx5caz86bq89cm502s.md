---
type: is
id: is-01kzn513dx5caz86bq89cm502s
title: "tbd integration sync: batched pull, push, echo suppression, orphans"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn513t5rt6bak750hcvzeta
  - type: blocks
    target: is-01kzn5147yrf3sw28jc7n600r7
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:15.548Z
updated_at: 2026-08-10T06:16:16.381Z
---
Batched pull filtered on updatedAt (page cap 250); push scan of local diffs. Echo suppression: after a push record the post-write updatedAt and refresh base, so the next pull sees no remote diff for tbd's own write (no actor filtering needed, works with a plain API key). Orphans: archived or deleted external item -> mark link orphaned and warn, NEVER auto-delete a bead; deleted bead -> external item untouched, reported. Failure containment: external errors mark the run degraded and are reported per link, git phases still complete, external failure never blocks or corrupts git sync. Spec Component 10.
