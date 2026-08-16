---
type: is
id: is-01m00mw9ppcnxpzvqakekq5tpc
title: Add a docs list to beads for supporting context documents
kind: feature
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-2
dependencies:
  - type: blocks
    target: is-01m00k64qt61hy5vnwb66nr3zx
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T17:24:54.101Z
updated_at: 2026-08-16T00:14:08.019Z
extensions:
  linear:
    id: ccea668b-196d-43a7-89bb-d7cdbb0a9297
    linked_at: 2026-08-16T00:14:08.019Z
---
A bead needs one GOVERNING doc plus any number of supporting ones. spec_path stays exactly as it is — singular, inherited by descendants, load-bearing for selection and list --spec. docs is what else you should read: plural, local, not inherited.

Value is a repo-relative PATH, not a URL, because: the docs are in the same repo so a path is stable where a URL is branch-dependent; specPermalink already resolves any repo path to a branch-correct GitHub blob URL (permalink.ts:74-84), so rendering is solved; and paths union-merge trivially.

  docs:
    - path: docs/project/research/current/research-2026-08-14-....md
      role: research
    - path: docs/project/architecture/current/arch-testing.md
      role: architecture

role is an OPEN string with known values (research, architecture, qa, design), not a closed enum. Identity is path, so repeated adds are idempotent and docs: 'union' slots into FIELD_STRATEGIES beside labels and dependencies with no new merge machinery.

Kept separate from refs deliberately: a doc is a path in this repo (resolvable, permalinked, branch-aware) and a ref is a URL to an external system (opaque, may 404 independently). Merging them forces every consumer to branch on 'is this a path or a URL' and loses the permalink resolution that already works. Alternative flagged as Open Question 5 in the spec.

CLI: tbd doc add <bead> <path> [--role ...], tbd doc rm, rendered by tbd show.

Depends on f08.

Spec: plan-2026-08-14-external-sync-and-traceability.md Phase 2
