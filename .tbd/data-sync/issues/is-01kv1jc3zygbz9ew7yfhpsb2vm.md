---
type: is
id: is-01kv1jc3zygbz9ew7yfhpsb2vm
title: show --json returns null for notes on first write
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-06-13T22:41:52.126Z
updated_at: 2026-06-13T22:41:52.126Z
---
Pre-existing (independent of the body-input change): the first time an issue's working notes are set (issue had no prior notes body), tbd show --json returns notes:null even though notes ARE persisted to disk (## Notes body) and appear in text show. Subsequent notes updates DO surface in --json. Description surfaces on first write. Repro: create X; update X --notes A; show X --json|jq .notes => null; update X --notes B; show X --json|jq .notes => B. Hurts agent write-then-read-back via --json. Likely in readIssue/parser or show serialization, not the writer.
