---
type: is
id: is-01kzrs94ma78nxv4qyd4yx8hr5
title: "Phase 4.2: move viewer DOM, template, and design system into strict sources"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - client
  - ui
  - web
dependencies:
  - type: blocks
    target: is-01kzrs9eanh9pfsh52fed3gdna
parent_id: is-01kzrs6dd1abehychzed2yc1fk
created_at: 2026-08-11T16:07:53.737Z
updated_at: 2026-08-11T18:03:03.860Z
closed_at: 2026-08-11T18:03:03.860Z
close_reason: Production CLI/server/client implementation complete; lifecycle, security, race, build, browser, performance, and packaged-artifact evidence is green.
extensions:
  linear:
    id: 051fc604-e4b3-47e2-9db1-eed9cca757ed
    linked_at: 2026-08-11T16:24:53.514Z
    key: TBD-145
    url: https://linear.app/finterm-ai/issue/TBD-145/phase-42-move-viewer-dom-template-and-design-system-into-strict
---
Create packages/tbd/src/web/client.ts as thin typed DOM glue over ClientStore; move HTML shell to src/web/index.html and CSS to src/web/styles.css; preserve query controls, tree/body rendering, data-vs-UI motion, change deltas, status/stats/log panels, theme chooser, reduced motion, accessibility, and no unsafe HTML insertion. Retarget design-system tests to styles.css.
