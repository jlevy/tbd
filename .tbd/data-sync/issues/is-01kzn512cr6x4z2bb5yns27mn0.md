---
type: is
id: is-01kzn512cr6x4z2bb5yns27mn0
title: "integrations/core/three-way.ts: diffAgainstBase and fieldwise merge"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5132f7f1gntqbg68wg2hv
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:14.487Z
updated_at: 2026-08-13T09:54:26.445Z
closed_at: 2026-08-13T09:54:26.445Z
close_reason: "Implemented in PR #206 Phase 2. The delivered equivalents are bridge-state.ts link records, reconcile.ts field matrix, intents.ts replay, conflict attic/comment lifecycle, sync-engine.ts orchestration, integration documentation plus real-binary E2E, and the guarded tbd sync fold. Revalidated after merging v0.5.0 main: typecheck/build pass, 189 integration tests pass, and 73 integration/bridge/query/web-seam tests pass."
extensions:
  linear:
    id: 3c59726b-a627-44e5-add4-787d72fb078b
    linked_at: 2026-08-11T06:50:53.832Z
    key: TBD-122
    url: https://linear.app/finterm-ai/issue/TBD-122/integrationscorethree-wayts-diffagainstbase-and-fieldwise-merge
---
diffAgainstBase(current, base) and mergeFieldwise(base, local, remote), reusing the shape of mergeIssues in file/git.ts. Local diff = bead vs base; remote diff = mapped external issue vs base. Fields changed on only one side merge silently: this is what keeps conflicts rare rather than merely survivable. Spec Component 10.
