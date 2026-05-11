---
type: is
id: is-01kra98fgac70pjft7jnarmave
title: "Spec: Docs config redesign (f05)"
kind: epic
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
child_order_hints:
  - is-01kra98szn2ah4f59kmbnfbery
  - is-01kra98tffpc00qar6ee3zk8tv
  - is-01kra98tz1mb3br9kg77933vdx
  - is-01kra99hzj671634xwep4zchqn
  - is-01kra99jbfhknp9jsqfhj9kzbk
  - is-01kra99jqbvtjysnr4gc0r7dwm
  - is-01kra99k339r7jwtw5wdjzbrs5
  - is-01kra99kg4z987hjrwwrj5wh4q
  - is-01kra99kvf2ys81vcakyb8vbzz
created_at: 2026-05-11T01:08:40.073Z
updated_at: 2026-05-11T01:09:17.295Z
---
Top-level epic for the docs config redesign (f05 schema) tracked in PR #117 (https://github.com/jlevy/tbd/pull/117).

Spec: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md

Already done on branch claude/review-config-format-2wxh8 (committed, in PR):
- docref module: parser, types, 31 tests
- docmap module: Zod schemas, resolution algorithm, 21 tests
- Resolver semantics fix (priority-wins same (type, name); ambiguous across types)
- Spec §4.4/§4.5 rewritten
- Zod schemas .strict() everywhere
- Cross-field validation (bundle required for non-local docrefs)
- Plan-spec written, design docs (design-docref-format.md, design-docmap-format.md), std-doc-guidelines.md

Remaining work is broken into three sub-epics (Phase 1/2/3) plus the open architectural questions Q15-Q20 which gate Phase 2 implementation per PR-comment from jlevy.

CI: green. Status: draft PR, waiting on architectural decisions (Q15-Q20).
