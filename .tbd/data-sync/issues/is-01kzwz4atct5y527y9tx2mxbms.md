---
type: is
id: is-01kzwz4atct5y527y9tx2mxbms
title: "Web: preserve in-progress label search across live rerenders"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T07:07:05.416Z
updated_at: 2026-08-13T07:16:17.493Z
closed_at: 2026-08-13T07:16:17.493Z
close_reason: Fixed in 5f32e14f with focused TDD and full release-gate validation
---
PR #209 Bugbot thread PRRT_kwDOQ109P86Y1kU7. File/function scope: packages/tbd/src/web/client.ts renderLabelChooser/renderBoard and focused chooser tests. Preserve text typed ahead of the 120ms debounced store value during unrelated/live rerenders so the complete label vocabulary remains reachable.

## Notes

Fixed in 5f32e14f. renderLabelChooser now uses labelSearchValueForRender so a focused DOM draft wins over an older debounced store value during live/request rerenders, while unfocused controls still adopt canonical state. TDD regression in web-core.test.ts; design/manual/spec/changelog updated.
