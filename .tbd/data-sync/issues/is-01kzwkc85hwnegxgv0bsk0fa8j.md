---
type: is
id: is-01kzwkc85hwnegxgv0bsk0fa8j
title: Normalize status-panel chrome to the body text scale
kind: bug
status: closed
priority: 2
version: 2
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:41:41.936Z
updated_at: 2026-08-13T04:06:22.927Z
closed_at: 2026-08-13T04:06:22.927Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
The status panel's sans-serif field labels and other chrome must use the standard body size, matching ordinary bead title/ID text. Literal values remain monospaced but use the same size. Update the co-located CSS design-system rule and tests; verify visually in light/dark-compatible tokenized styles.
