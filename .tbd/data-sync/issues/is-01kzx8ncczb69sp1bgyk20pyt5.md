---
type: is
id: is-01kzx8ncczb69sp1bgyk20pyt5
title: Document and package the web external-link design contract
kind: task
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - web
  - integration
dependencies: []
parent_id: is-01kzx8mkeyergsd0hmq8zj1zd7
created_at: 2026-08-13T09:53:41.279Z
updated_at: 2026-08-13T16:00:50.938Z
extensions:
  linear:
    id: 691dcef9-0896-4e6b-8168-8c93a6372a93
    linked_at: 2026-08-13T16:00:50.938Z
    key: TBD-161
    url: https://linear.app/finterm-ai/issue/TBD-161/document-and-package-the-web-external-link-design-contract
---
Update the authoritative design-system inventory in src/web/styles.css plus tbd-design.md, tbd-docs.md, README.md, docs/development.md, CHANGELOG.md, and installed skill tiers. State that the browser only displays/navigates provider links, agents perform link/unlink/sync through tbd commands, provider filtering is shared CLI semantics, and no web request contacts Linear or GitHub. Extend generated-doc, package stitch, web-package, empty-repo, and installed-skill tests so the new SVG/CSS/data assets ship in the single self-contained page.
