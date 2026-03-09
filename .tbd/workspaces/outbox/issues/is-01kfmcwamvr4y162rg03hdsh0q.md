---
close_reason: Implemented --refresh and --quiet flags for shortcut command. Generates shortcut directory from DocCache and writes to cache file.
closed_at: 2026-01-23T04:28:36.349Z
created_at: 2026-01-23T03:03:04.090Z
dependencies:
  - target: is-01kfmcwaweeaavmc1pv3pzp6j2
    type: blocks
  - target: is-01kfmcwb427bfjvrkcvpcp56s0
    type: blocks
  - target: is-01kfmcwbbhwt8x9b0acb0b24a6
    type: blocks
  - target: is-01kfmcwbjvfyawp149ayvzbmwx
    type: blocks
  - target: is-01kfmcwbsvmvwkwfgdb9r9bh8m
    type: blocks
  - target: is-01kfmev0atfwvykhv9yxqeqfhd
    type: blocks
  - target: is-01kfmev0k0hae8q3fv0r5ktcwv
    type: blocks
id: is-01kfmcwamvr4y162rg03hdsh0q
kind: task
labels: []
parent_id: is-01kfhvzn1vbsam9xckr0njfbqg
priority: 1
status: closed
title: Implement shortcuts refresh subcommand
type: is
updated_at: 2026-03-09T02:47:23.272Z
version: 14
---
Add --refresh and --quiet flags to existing shortcut command. Load shortcuts via DocCache, generate directory markdown, write to cache file, and update installed skill files with marker-based replacement.
