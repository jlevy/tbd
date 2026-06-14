---
type: is
id: is-01kv199k01p0jmd2mh24v00aar
title: File and stdin bodies for --reason/--description/--notes
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
child_order_hints:
  - is-01kv1cyscrm9813s1536ww348z
created_at: 2026-06-13T20:03:12.001Z
updated_at: 2026-06-14T15:53:30.764Z
closed_at: 2026-06-14T15:53:30.764Z
close_reason: "Implemented on PR #176: shared resolveBodyInput (cli/lib/body-input.ts). --reason/--reason-file on close and reopen, -d/--file on create, --notes/--notes-file on update, all with the shared dash stdin convention and a single-stdin-per-command guard. Regression goldens tracked under tbd-xc4f."
---
Spec problem P6. Add --reason-file to close and reopen; add a shared dash convention so --reason -, -d -, and --notes - read the body from stdin. Removes the inline shell-quoting hazard for large multi-paragraph text.

## Notes

PR #176 review: one shared file/stdin body reader for --reason-file, --reason -, --description -, --notes -. Test shell-sensitive text: dollar-signs, backticks, quotes.
