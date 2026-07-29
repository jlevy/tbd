---
type: is
id: is-01ky1faf8tjs4pj2mxahw7rsf6
title: "PR #196 review R4: hunks carry the entire field as context"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:37.882Z
updated_at: 2026-07-21T04:48:29.071Z
closed_at: 2026-07-21T04:48:29.070Z
close_reason: "Fixed in 52867bd: TEXT_HUNK_CONTEXT_LINES=3 bounds context around the changed span with adjusted hunk starts/counts; bounded-context test added; small-text hunks unchanged."
---
createTextHunks emits one hunk spanning the whole field — a 1-line append to a 500-line notes field emits ~500 context lines; reports feed agent prompts (50KB worst case). issue-changes.ts:143-186. Fix: bound context to a named-constant number of lines around the changed span, deterministic, unified-diff style.
