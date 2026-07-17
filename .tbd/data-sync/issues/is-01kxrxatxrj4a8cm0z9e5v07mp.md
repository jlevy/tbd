---
type: is
id: is-01kxrxatxrj4a8cm0z9e5v07mp
title: Update flowmark/flowmark-rs skill generators to current allowed-tools guidance (space-separated; drop Bash(uvx:*) wildcard)
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-17T20:47:19.990Z
updated_at: 2026-07-17T20:47:19.990Z
---
PR #191 guidance: allowed-tools should be the space-separated spec form and must not pre-approve package-runner wildcards. flowmark's shipped SKILL.md currently uses 'Bash(flowmark:*), Bash(uvx:*), Read, Write' (comma-separated + uvx wildcard). Fix in jlevy/flowmark and jlevy/flowmark-rs skill generation, per agent-skill-distribution reference.
