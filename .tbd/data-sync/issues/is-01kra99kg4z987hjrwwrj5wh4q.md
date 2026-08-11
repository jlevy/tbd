---
type: is
id: is-01kra99kg4z987hjrwwrj5wh4q
title: "Q19: Decide as: field disambiguation (keep vs mode: discriminator vs KDEX-aligned)"
kind: task
status: open
priority: 2
version: 10
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra98tffpc00qar6ee3zk8tv
parent_id: is-01kra98fgac70pjft7jnarmave
created_at: 2026-05-11T01:09:16.932Z
updated_at: 2026-08-11T07:07:52.349Z
extensions:
  linear:
    id: 0c0d0100-26fa-4991-bee8-ce9e225de7c6
    key: TBD-31
    url: https://linear.app/finterm-ai/issue/TBD-31/q19-decide-as-field-disambiguation-keep-vs-mode-discriminator-vs-kdex
    linked_at: 2026-08-10T19:36:39.486Z
    comments:
      - id: 0999defc-2d63-455f-826d-51f6a4c38e3f
        at: 2026-08-11T07:07:11.980Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-kz1r` diverged and one value was discarded.

          - Kept: `"sha256v2:ffd95f20a64f1259c7273160a3713ccb37c20920ca8fab8990c537fb38d4a52c"`
          - Discarded: `"sha256v2:548aa70177123ed9b8b83f5a9a45ba8ac3ffbe2610ac7c8f00beb0756855586f"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kra99kg4z987hjrwwrj5wh4q`.
          Resolve this comment once the divergence has been reconciled.
---
as: currently means two unrelated things:

* On a source: "treat this source as a single named item rather than a bag of files" (whole-repo/single-URL mode).
* On a contents rule: "rename this upstream doc on import."

Options:

* A. Keep as-is and document the two meanings.
* B. Split into mode: discriminator on sources (files|file|repo); as: only on contents rules as rename semantics. Cleanest.
* C. KDEX-aligned: as: repo literal; as: <name> only on contents rules.

Spec section: ## Open Questions → Q19 (line ~891).
