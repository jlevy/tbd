---
type: is
id: is-01m00k639pqyx9p30eszfh06k0
title: Add a refs list to beads for PRs, external issues, and docs
kind: feature
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - traceability
  - phase-2
dependencies:
  - type: blocks
    target: is-01m00k64qt61hy5vnwb66nr3zx
  - type: blocks
    target: is-01m00k6t67cbxc3hrcwek1563e
  - type: blocks
    target: is-01m00h5bwwh3cnhd087t7yc7dx
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:55:18.070Z
updated_at: 2026-08-15T08:03:03.067Z
closed_at: 2026-08-15T08:03:03.067Z
close_reason: "refs field shipped with tbd ref add|rm, kind inferred from GitHub URLs. Needed union_by_key, not plain union: whole-item dedup would keep the same PR twice when two clones titled it differently."
---
A bead has four things it needs to point at — a PR (often several), an external issue, a research doc, a plan spec — and exactly one place to put any of them: spec_path, which is singular. External identity lives in extensions.<provider>, which is deliberately one-link-per-provider ('The namespace key IS the provider, which makes at most one link per provider structural rather than a rule the merge code has to enforce', schemas.ts:145-147). That is right for a tracker and wrong for PRs.

Proposal: one additive, optional, top-level list.

  refs:
    - kind: pr
      url: https://github.com/jlevy/tbd/pull/222
      title: 'research: Agent sync protocol...'
      at: 2026-08-14T17:12:00Z

- kind is an OPEN string with known values (pr, issue, doc, design, other), not a closed enum — same call WorkflowState.type gets, for the same reason.
- url is the identity, so repeated adds are idempotent and the merge is a union keyed on it. refs: 'union' slots into the existing field-merge table (git.ts:449-451) beside labels and dependencies — NO new merge machinery, and two agents attaching different PRs concurrently both survive.
- Provider-neutral by construction: a ref is a URL with a kind. Nothing about it knows Linear exists.
- spec_path STAYS. It is load-bearing for selection, propagation, and list --spec. The split: spec_path is the doc this work is defined by (singular, inherited); refs is everything else this work points at (plural, local).
- Additive, so no format bump.

CLI: tbd ref add <bead> <url> [--kind ...] [--title ...], tbd ref rm, tbd ref ls.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F14, §5.5, E14
