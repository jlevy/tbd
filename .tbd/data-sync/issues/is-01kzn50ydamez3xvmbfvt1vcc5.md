---
type: is
id: is-01kzn50ydamez3xvmbfvt1vcc5
title: "integrations/core/managed-block.ts: render and splice the tbd block"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:10.408Z
updated_at: 2026-08-10T17:35:53.895Z
closed_at: 2026-08-10T17:35:53.895Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
renderManagedBlock(bead, links): the generated summary (id, kind, status, priority, spec link, PR links, child/ready counts, tbd show command). spliceManagedBlock(description, block): rewrite ONLY between <!-- tbd:begin --> and <!-- tbd:end --> so human prose outside survives. Missing markers -> append. Malformed markers -> return { error: 'markers-malformed' } and the caller reports and skips, never guesses. Spec Component 5.
