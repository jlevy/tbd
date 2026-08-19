---
type: is
id: is-01kzrwpr7qb2a19j9jx48fmna5
title: "PR #207 review R3: dist/tbd runs web action twice"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - review
  - web
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T17:07:45.524Z
updated_at: 2026-08-11T18:03:03.514Z
closed_at: 2026-08-11T18:03:03.514Z
close_reason: Implemented with focused regressions; full Vitest (1496) and tryscript (1073) matrices, build, lint, and package proofs are green.
---
packages/tbd/scripts/copy-docs.mjs copies dist/bin.mjs byte-for-byte to dist/tbd. The lazily split web server chunk imports shared symbols from ./bin.mjs. When dist/tbd is the entry (as in tryscript/PATH use), loading that chunk evaluates bin.mjs as a second module and runs runCli() twice, duplicating the descriptor and attempting a second server. Write dist/tbd as a tiny executable launcher that imports canonical ./bin.mjs, and regress the single JSON descriptor through cli-web.tryscript.md.
