---
type: is
id: is-01m2nqjj72y0s3wk8bn14wwzn6
title: "PR #301 final review D2: clarify shortcut scope versus official gh-stack reference"
kind: bug
status: closed
priority: 3
version: 3
delegate: final-stack-audit
labels: []
dependencies: []
parent_id: is-01m2nqj2g2yvyrcxt8wrgqwxeb
hold: null
hold_until: null
created_at: 2026-09-16T18:27:27.585Z
updated_at: 2026-09-16T18:36:00.211Z
started_at: 2026-09-16T18:27:54.043Z
closed_at: 2026-09-16T18:36:00.211Z
close_reason: Implemented canonical and generated stack-discoverability guidance, clarified the shortcut scope, and added focused portable and compact-tier regression coverage.
resolution: null
duplicate_of: null
---
Low finding: stacked-prs.md claims it deliberately does not document gh stack commands but then records critical commands and postconditions. Rephrase to say it does not replace the official command reference and intentionally captures critical noninteractive commands/postconditions.
