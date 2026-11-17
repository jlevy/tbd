---
type: is
id: is-01m7khczytda9r9yjeeffa87mq
title: "PR #332 D9: A node_modules/get-tbd at the pinned version bypasses the fallback's npx flags"
kind: bug
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-11-17T01:19:33.850Z
updated_at: 2026-11-17T01:19:33.850Z
---
Review D (Low), deferred with B2 under tbd-cnki. npx checks the project's own tree before the registry, so a node_modules/get-tbd at the pinned version runs with none of --before, --ignore-scripts or the dedicated cache applying. Option to evaluate: pass --prefix=<empty tbd-owned dir>. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
