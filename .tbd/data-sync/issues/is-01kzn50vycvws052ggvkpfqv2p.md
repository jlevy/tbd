---
type: is
id: is-01kzn50vycvws052ggvkpfqv2p
title: "lib/schemas.ts: LinkedEntrySchema, linked and last_actor fields, format gate"
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50wa5k1s8m5xy4mr5tvtb
  - type: blocks
    target: is-01kzn50xevpfmk7wqkag9f8bfx
  - type: blocks
    target: is-01kzn5121n6gc6xk9w710631cf
parent_id: is-01kzn2w9gdhb0xt2hztn7v0aha
created_at: 2026-08-10T06:16:07.883Z
updated_at: 2026-08-10T06:16:14.132Z
---
LinkedEntrySchema { provider, id (provider UUID, canonical), key (display), url, linked_at }. linked: optional array on IssueSchema; last_actor: optional string set from TBD_ACTOR by mutating commands. UUID is canonical because Linear identifiers move between teams. Zod strip mode discards unknown frontmatter on write, so an older CLI would silently drop these: bump tbd_format to gate. Spec Component 3.
