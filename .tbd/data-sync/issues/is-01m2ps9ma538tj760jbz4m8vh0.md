---
type: is
id: is-01m2ps9ma538tj760jbz4m8vh0
title: "Spec: project-level grants are primary; user-level grants a fallback"
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T04:16:46.404Z
updated_at: 2026-09-17T04:19:18.057Z
closed_at: 2026-09-17T04:19:18.056Z
close_reason: Plan now treats project policy grants as the primary record, user-level grants as a fallback for unanswered policies, and default-branch reading as the only safeguard
resolution: null
duplicate_of: null
---
User correction 2026-09-16: user-level-only grants were never a requirement; project-level grants are preferred because they are shared by every human and agent on the repo. Remove the plan's endorsement of #308's user-level preference and the extra outside-the-repo confirmation; keep default-branch reading; user-level grants apply only to unanswered policies.
