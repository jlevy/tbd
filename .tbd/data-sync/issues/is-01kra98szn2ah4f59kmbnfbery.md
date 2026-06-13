---
type: is
id: is-01kra98szn2ah4f59kmbnfbery
title: "Phase 1: Basic capabilities and migration (f06+ framework backing impl)"
kind: epic
status: open
priority: 1
version: 13
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
parent_id: is-01kra98fgac70pjft7jnarmave
child_order_hints:
  - is-01kra9a79pckz3rj3fq1jb88w7
  - is-01kra9a7mp2ta4536cre83mt13
  - is-01kra9a7zedavram862qv9qwnk
  - is-01kra9a8ae405nqc2mh0jfd8zf
  - is-01kra9a8p986pwpazqavzragar
  - is-01kra9a91xm3ktgs9bykv1n0qb
  - is-01kra9a9d5hkb9exmv0ah7h0z6
  - is-01kra9a9rgnw0ea5171yg7e317
  - is-01kra9aa46rm710x8f5mh0bbbt
  - is-01kra9aag4p0ec6nmg1htaa128
  - is-01kra9aave6br1ysqedyccf8y5
created_at: 2026-05-11T01:08:50.805Z
updated_at: 2026-06-13T01:51:09.265Z
---
Goal: existing UX preserved; new schema and modules are the backing implementation. No new user-visible features beyond what exists today.

Spec section: ## Implementation Plan → Phase 1 (line ~1577).

Already done (skipped): docref module, docmap module (schemas + resolver), .strict() schemas, bundle cross-field validation, plan-spec.

Blocked by: Q20a-c (rename type→category, glob-first contents, contents rule shape) which are mechanical and ship together with Phase 1 per the spec.

## Notes

Retitled from (f05 backing impl): f05 shipped via the forkable-docs spec on PR #169 (migration included — see closed tbd-kax2). This phase now reads against the f06+ framework era.
