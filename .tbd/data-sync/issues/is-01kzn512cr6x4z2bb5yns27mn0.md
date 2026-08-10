---
type: is
id: is-01kzn512cr6x4z2bb5yns27mn0
title: "integrations/core/three-way.ts: diffAgainstBase and fieldwise merge"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5132f7f1gntqbg68wg2hv
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:14.487Z
updated_at: 2026-08-10T06:16:15.182Z
---
diffAgainstBase(current, base) and mergeFieldwise(base, local, remote), reusing the shape of mergeIssues in file/git.ts. Local diff = bead vs base; remote diff = mapped external issue vs base. Fields changed on only one side merge silently: this is what keeps conflicts rare rather than merely survivable. Spec Component 10.
