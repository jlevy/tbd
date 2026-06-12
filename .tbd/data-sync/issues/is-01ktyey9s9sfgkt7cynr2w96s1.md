---
type: is
id: is-01ktyey9s9sfgkt7cynr2w96s1
title: Skill routing rows for fork/update/missing-file workflows
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesp3hmzqdxdg3zs79tjhz
created_at: 2026-06-12T17:44:10.280Z
updated_at: 2026-06-12T20:25:51.529Z
closed_at: 2026-06-12T20:25:51.529Z
close_reason: "Done in e5ce028: skill routing rows (list / fork-and-edit / update with conflict strategies / deleted-forked-file recovery) plus tbd docs entries in the Documentation command table, in skill-baseline.md and regenerated into all four skill copies via setup --auto (drift tests green)."
---
[Phase 5; release bar] PR #169. Add to skill-baseline.md User Request -> Agent Action: 'What guidelines are there?' -> tbd docs list; 'Make the guidelines visible / customize X' -> tbd docs fork (confirm scope+visibility); 'Update the guidelines' -> tbd docs update, then --merge/--keep-ours after asking; 'I deleted a forked file' -> tbd docs status shows missing, restore via fork --force or finalize via unfork. Add tbd docs list/fork to the Documentation command table; one-line Forkable docs note. Stay within the skill size budget. A command without its routing row is invisible to agents.
