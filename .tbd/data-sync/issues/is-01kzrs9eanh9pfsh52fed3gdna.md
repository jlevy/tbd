---
type: is
id: is-01kzrs9eanh9pfsh52fed3gdna
title: "Phase 4.3: add browser typecheck, IIFE build, and deterministic HTML stitch"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - build
  - packaging
  - web
dependencies:
  - type: blocks
    target: is-01kzrs9mb24gzv94d2mvexqnbd
parent_id: is-01kzrs6dd1abehychzed2yc1fk
created_at: 2026-08-11T16:08:03.667Z
updated_at: 2026-08-11T18:03:03.867Z
closed_at: 2026-08-11T18:03:03.867Z
close_reason: Production CLI/server/client implementation complete; lifecycle, security, race, build, browser, performance, and packaged-artifact evidence is green.
extensions:
  linear:
    id: 90cb1f73-b89d-4930-9721-0407747b0680
    linked_at: 2026-08-11T16:24:55.619Z
    key: TBD-146
    url: https://linear.app/finterm-ai/issue/TBD-146/phase-43-add-browser-typecheck-iife-build-and-deterministic-html
---
Add packages/tbd/tsconfig.web.json and exclude src/web from the Node project; run both projects in typecheck; extend tsdown.config.ts with a browser IIFE entry; add scripts/stitch-web.mjs to replace exact template markers with CSS/JS and fail on missing/duplicate markers; wire postbuild so dist/web/index.html is self-contained while intermediates are removed. Test stitch determinism and npm-pack inclusion.
