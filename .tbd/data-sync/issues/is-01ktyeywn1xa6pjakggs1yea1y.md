---
type: is
id: is-01ktyeywn1xa6pjakggs1yea1y
title: Preserve URL fragments through docref normalization
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:29.601Z
updated_at: 2026-06-12T18:20:42.186Z
closed_at: 2026-06-12T18:20:42.186Z
close_reason: "Fixed in 6b6949e: optional fragment field on git refs, parsed from //path#frag and preserved through blob-URL normalization; tests cover parse, round-trip, and normalization."
---
PR #169 review sec 4. https://github.com/o/r/blob/main/f.md#sec normalizes to github:o/r@main//f.md, silently dropping #sec (gitRefFromUrl reads pathname only). Add an optional fragment to the git form, parse/format it (//path#frag), and carry it through URL normalization. Fragments matter for docs (tbd has --section).
