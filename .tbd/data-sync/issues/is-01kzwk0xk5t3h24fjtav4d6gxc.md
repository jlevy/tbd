---
type: is
id: is-01kzwk0xk5t3h24fjtav4d6gxc
title: Keep aggregate facet tallies out of closed chooser labels
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:35:30.660Z
updated_at: 2026-08-13T04:06:22.907Z
closed_at: 2026-08-13T04:06:22.907Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
File/function detail:\n- packages/tbd/src/web/client.ts: renderCategoricalFacets/setFacetOption must preserve contextual counts on every option in the open native chooser, including aggregate Any/Active choices, while the currently selected aggregate choice renders without its redundant count in the closed select control.\n- Use a standard select-compatible mechanism that does not remove menu counts or change filtering semantics.\n- packages/tbd/tests/bead-web-css.test.ts and browser validation must cover Status, Type, and Priority.\nAcceptance: aggregate counts remain visible when a chooser is opened; a selected aggregate choice reads only status: active, any (incl. closed), type: any, or priority: any when closed; selected concrete choices may retain their useful count.

## Notes

Live validation: native selected option text retained contextual totals (for example status: active · 263, type: any · 263, priority: any · 263), while each closed visual face showed only status: active, type: any, and priority: any.
