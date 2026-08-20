---
type: is
id: is-01m0g6g66y8gyhy0ra6jz55w44
title: "PR #248 review R4: isDirOnPath does not handle quoted Windows PATH entries"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m0g6fe52d2fr6vftwvzssgqj
created_at: 2026-08-20T18:21:28.157Z
updated_at: 2026-08-20T20:29:46.394Z
closed_at: 2026-08-20T20:29:46.394Z
close_reason: "Fixed on PR #248 head a0e3dbf by a parallel session, and independently verified here: 20 unit tests pass (incl. npmPrefixCommand for win32 and the quoted-PATH cases), the doctor golden passes both on a healthy host and under npm_config_prefix=/tmp/off-path-prefix, both SKILL.md files list agent-session-bootstrap, and .tbd/config.yml carries no dev-build version churn. Live doctor is silent when healthy and warns with the full suggestion when off PATH."
resolution: null
duplicate_of: null
---
packages/tbd/src/lib/npm-global-bin.ts:60-72 — Windows PATH entries with spaces are commonly quoted, e.g. "C:\Program Files\nodejs". win32.resolve keeps the quotes so the entry never matches, and doctor emits a spurious warning telling the user to add a directory that is already on PATH. A false positive is worse than a miss here because the suggestion is actively wrong.

Fix: strip surrounding double quotes from each entry before resolving; pin with a test alongside the existing Windows cases.
