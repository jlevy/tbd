---
type: is
id: is-01kfxmskfqazn6nk9xmd7w0arc
title: Document gitignore pattern re-addition behavior as intentional design
kind: task
status: closed
priority: 4
version: 7
labels: []
dependencies: []
created_at: 2026-01-26T17:14:33.334Z
updated_at: 2026-03-09T16:12:32.937Z
closed_at: 2026-01-28T04:06:54.144Z
close_reason: "Documented: setup.ts:1388 has comment explaining intentional re-addition behavior"
---
If a user manually removes a pattern we manage (like docs/), we re-add it on next setup. This is intentional because: 1) docs/ is regenerated from npm package on every setup, 2) These are tool-managed files, not user-authored, 3) Tracking them would cause noise on every upgrade. Should add a comment in setup.ts explaining this design decision.
