---
type: is
id: is-01kzq966qbeaz0wz8argmzb551
title: "PR #207 senior review R3: spike Origin check is not same-origin; remove write surface"
kind: bug
status: closed
priority: 2
version: 2
labels:
  - viewer
dependencies: []
created_at: 2026-08-11T02:07:25.929Z
updated_at: 2026-08-11T04:42:43.375Z
closed_at: 2026-08-11T04:42:43.374Z
close_reason: Fixed in 6edccb89; full gate green; threads replied and resolved on PR 207
---
Senior review R3 (HIGH): bead-web.ts accepts any loopback-hostname Origin regardless of port/protocol, and /api/update parses JSON without a content-type requirement, so a hostile page on another localhost port can POST mutations. Plan already says v1 read-only with the route removed, not hidden. Fix: delete /api/update, --allow-write/--read-only flags, allowWrite plumbing; update dev docs claim.
