---
type: is
id: is-01kzwhjmqn2ze00p37sajpg061
title: Remove synthetic pretty-tree bars from wrapped title lines
kind: bug
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:10:14.260Z
updated_at: 2026-08-13T04:06:22.837Z
closed_at: 2026-08-13T04:06:22.836Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Superseded after live visual review: cross-platform CSS continuation bars are not consistently the same width/shape as the first-line Unicode box characters and look worse than a clean omission. Preserve the ordinary first-line Unicode prefix and the correct hanging indent, but remove all synthetic vertical bars from wrapped continuation lines. Remove dead continuation helper/render/CSS code and update tests plus the authoritative CSS design-system rule.

## Notes

The first implementation correctly modeled active ancestor columns, including terminal branch versus elbow, but browser-rendered CSS rules still did not match the font's Unicode bar geometry. User selected the simpler standard: no continuation bars on wrapped lines.
