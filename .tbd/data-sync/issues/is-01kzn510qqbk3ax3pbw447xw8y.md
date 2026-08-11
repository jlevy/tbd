---
type: is
id: is-01kzn510qqbk3ax3pbw447xw8y
title: tbd integration link / unlink / import with one-source guard
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5117ezkyh9c1dqgr9pwty
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:12.790Z
updated_at: 2026-08-11T00:28:18.415Z
extensions:
  linear:
    id: 40dd2cf9-0efc-4a66-bed8-5cb77d3376cd
    key: TBD-63
    url: https://linear.app/finterm-ai/issue/TBD-63/tbd-integration-link-unlink-import-with-one-source-guard
    linked_at: 2026-08-10T21:10:26.024Z
---
link <bead> <ref> attaches a bead to an external item, refusing when already linked (--force re-links via unlink semantics). unlink <bead>. import <ref> creates a linked bead from an external item: explicitly user-invoked, NOT part of mirror, so the one-way claim stays honest. Provider inferred from ref via registry, --provider to disambiguate. Spec Component 6 and API Changes.

## Notes

Semantics finalized in the spec rewrite (bdd7b487, 'Linking and importing: where a pair begins'): link <bead> <ref> shows the field diff; equal fields converge; differing fields need a stance (--take local|remote); non-interactive without a stance refuses with exit 1 (bulk-guard philosophy). import <ref> = link + one-shot all-remote pull, canonical fields only (title, mapped status/priority, block-stripped description, as_kind from policy; no labels, no assignee, no raw payload), base := imported values. unlink clears extensions.<provider> and the bridge record; absence-as-value merge prevents resurrection. One-source guard both directions: reverse index + tbd://bead/<id> attachment probe, --force override. Depends on the sync engine (tbd-mmkd) for bridge-state and the one-shot pull.
