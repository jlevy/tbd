---
type: is
id: is-01m2ypmhxmwevxm7r0rxakcjn2
title: Correct the documented Lefthook command-exclusion variable
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-20T06:04:14.130Z
updated_at: 2026-09-20T06:04:14.130Z
---
docs/development.md recommends SKIP=package-age, but Lefthook 2.1.4 does not honor SKIP for command exclusion. During PR #316 validation SKIP=test still launched the full pre-push suite. Official Lefthook exclude_tags documentation names LEFTHOOK_EXCLUDE for command names and tags. Replace the documented variable and verify the test step reports excluded while other gates remain active.
