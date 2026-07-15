---
type: is
id: is-01kxj32xg2qpdfb73qsg9pnt4s
title: Add read-only managed-surface drift diagnostics to tbd doctor
kind: task
status: open
priority: 2
version: 2
labels:
  - doctor
  - setup
  - agent-skills
dependencies: []
parent_id: is-01kxj32wgrjfa51wytr33z286r
created_at: 2026-07-15T05:13:10.913Z
updated_at: 2026-07-15T05:13:54.452Z
---
Use the setup planning logic to report stale generated skill/hook/AGENTS.md surfaces without rewriting them.

Acceptance criteria:
- Add the diagnostic to tbd doctor rather than prime, so every session does not pay for a deep drift scan.
- Report each stale, missing, user-owned, or too-new managed artifact and the exact opt-in tbd setup --auto command that would refresh it.
- Never rewrite surfaces from doctor without an explicit existing fix/apply mode; the ordinary diagnostic remains read-only.
- Reuse the same comparison/plan model as setup dry-run so preview and doctor cannot drift.
- Add focused tests for current, stale, missing, and newer-format surfaces.
