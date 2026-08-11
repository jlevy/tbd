---
type: is
id: is-01kra98fgac70pjft7jnarmave
title: "Spec: Docs config redesign (f06+ framework)"
kind: epic
status: open
priority: 1
version: 19
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
updated_at: 2026-08-11T07:07:51.120Z
extensions:
  linear:
    id: 469c60b7-7a9d-4724-82a1-cd0d24d76321
    key: TBD-39
    url: https://linear.app/finterm-ai/issue/TBD-39/spec-docs-config-redesign-f06-framework
    linked_at: 2026-08-10T19:36:32.543Z
    comments:
      - id: 09e779fd-4ece-4cd3-9a8e-0c71920a55a4
        at: 2026-08-11T07:07:10.114Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-up8l` diverged and one value was discarded.

          - Kept: `"sha256v2:c76843d39f5d8b60d3604fa14f76434c78eb25ce0d9f2bc3686496eccab379c7"`
          - Discarded: `"sha256v2:e64e254194c3162359145370f5f2255fa9ac258109ef509381392c934ed886e6"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kra98fgac70pjft7jnarmave`.
          Resolve this comment once the divergence has been reconciled.
---
Top-level epic for the docs config redesign (f05 schema) tracked in PR #117 ([https://github.com/jlevy/tbd/pull/117](<https://github.com/jlevy/tbd/pull/117>)).

Spec: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md

Already done on branch claude/review-config-format-2wxh8 (committed, in PR):

* docref module: parser, types, 31 tests
* docmap module: Zod schemas, resolution algorithm, 21 tests
* Resolver semantics fix (priority-wins same (type, name); ambiguous across types)
* Spec §4.4/§4.5 rewritten
* Zod schemas .strict() everywhere
* Cross-field validation (bundle required for non-local docrefs)
* Plan-spec written, design docs (design-docref-format.md, design-docmap-format.md), std-doc-guidelines.md

Remaining work is broken into three sub-epics (Phase 1/2/3) plus the open architectural questions Q15-Q20 which gate Phase 2 implementation per PR-comment from jlevy.

CI: green. Status: draft PR, waiting on architectural decisions (Q15-Q20).

## Notes

Era correction before merging PR #169: f05 shipped as the forkable-docs workflow (specs/done/plan-2026-06-11-forkable-docs.md), which deliberately deferred this spec's scope — external bundles, lockfiles, resolver policy, operations over docmaps — to the f06+ framework (see its 'line deliberately not crossed' section and Q15-Q20 here). Retitled from (f05) so the open questions read as future work, not as a parallel claim on the shipped format.
