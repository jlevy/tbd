---
type: is
id: is-01kzrs94ma78nxv4qyd4yx8hr5
title: "Phase 4.2: move viewer DOM, template, and design system into strict sources"
kind: task
status: open
priority: 1
version: 2
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
updated_at: 2026-08-11T16:08:03.667Z
---
Create packages/tbd/src/web/client.ts as thin typed DOM glue over ClientStore; move HTML shell to src/web/index.html and CSS to src/web/styles.css; preserve query controls, tree/body rendering, data-vs-UI motion, change deltas, status/stats/log panels, theme chooser, reduced motion, accessibility, and no unsafe HTML insertion. Retarget design-system tests to styles.css.
