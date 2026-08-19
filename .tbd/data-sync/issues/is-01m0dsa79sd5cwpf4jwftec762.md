---
type: is
id: is-01m0dsa79sd5cwpf4jwftec762
title: Managed block renders the session line with freshness
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-19-agent-session-refs-and-runtimes.md
labels: []
dependencies: []
parent_id: is-01m0drveqd06azafyxnbqx0e4h
created_at: 2026-08-19T19:52:32.312Z
updated_at: 2026-08-19T23:49:44.818Z
extensions:
  linear:
    id: 30a583e2-c918-4c63-acf0-3fef93834da6
    linked_at: 2026-08-19T23:49:44.818Z
---
Render provider, status, age, and actor in the Linear managed block, linked where a URL exists. Status and updated_at must render as one unit; a status with no age is a liability. Coordinate with tbd-o6o6, which reworks the same renderer.
