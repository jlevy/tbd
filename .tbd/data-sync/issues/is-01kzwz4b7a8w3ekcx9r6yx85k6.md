---
type: is
id: is-01kzwz4b7a8w3ekcx9r6yx85k6
title: "Web: preserve Home/End editing keys in label search"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T07:07:05.833Z
updated_at: 2026-08-13T07:16:17.498Z
closed_at: 2026-08-13T07:16:17.498Z
close_reason: Fixed in 5f32e14f with focused TDD and full release-gate validation
---
PR #209 Bugbot thread PRRT_kwDOQ109P86Y1kVB. File/function scope: packages/tbd/src/web/client.ts label menu keydown handler and focused keyboard behavior tests. Home/End must retain native caret semantics while the search input owns focus and only navigate choices elsewhere in the menu.

## Notes

Fixed in 5f32e14f. The delegated label-menu key handler now preserves native Home/End behavior when the search input owns focus and retains menu navigation elsewhere, via preserveLabelSearchEditingKey. TDD regression in web-core.test.ts; design/manual/spec/changelog updated.
