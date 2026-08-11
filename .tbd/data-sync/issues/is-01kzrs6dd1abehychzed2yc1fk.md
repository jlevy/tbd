---
type: is
id: is-01kzrs6dd1abehychzed2yc1fk
title: "Phase 4: productize strict TypeScript web client and packaged artifact"
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - pr-207
dependencies:
  - type: blocks
    target: is-01kzrs6s3fn7gtzgt70wx9yzas
parent_id: is-01kzn5wbxkb6c0db6k19wj7yzj
child_order_hints:
  - is-01kzrs8yftzrvng3a16fs26hm1
  - is-01kzrs94ma78nxv4qyd4yx8hr5
  - is-01kzrs9eanh9pfsh52fed3gdna
  - is-01kzrs9mb24gzv94d2mvexqnbd
created_at: 2026-08-11T16:06:24.415Z
updated_at: 2026-08-11T16:08:09.825Z
---
Move the spike client into src/web/core.ts + client.ts with injected transport tests; move template/styles to source, add strict DOM typecheck and browser IIFE build, stitch dist/web/index.html, retarget CSS tests, and retire inline untyped client behavior.
