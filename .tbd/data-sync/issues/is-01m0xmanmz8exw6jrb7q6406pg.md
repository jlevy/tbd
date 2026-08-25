---
type: is
id: is-01m0xmanmz8exw6jrb7q6406pg
title: Minimize test volume while preserving maximum useful coverage
kind: task
status: open
priority: 2
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m0xmaxpmqg92tzvnjjjhan2t
  - type: blocks
    target: is-01m0xmbnx9gzr1xxts9ckvzv78
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:15.039Z
updated_at: 2026-08-25T23:33:48.072Z
---
The testing guidance should not discourage reducing the volume of tests. It's very important to keep the volume of tests as low as possible while *simultaneously* keeping the coverage as high as possible. Excessive test fluff is a serious cost just as inadequate testing is.

State this as a simultaneous optimization, not "smaller is better" or "more coverage is better" in isolation. Give specific criteria for when a test is not earning its maintenance and execution cost.
