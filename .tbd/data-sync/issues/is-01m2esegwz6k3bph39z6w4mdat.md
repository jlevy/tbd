---
type: is
id: is-01m2esegwz6k3bph39z6w4mdat
title: "Independent re-review of PR #279's fix for review finding PR279-R1 (c9c65169)"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erphvafq7s0t4fa4q7enpa
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:45:31.294Z
updated_at: 2026-09-15T21:27:00.787Z
closed_at: 2026-09-15T21:27:00.786Z
close_reason: |
  Independent re-review of the PR279-R1 fix as it exists on main @ 1238038e (2026-09-15): the lineage rule is correct. Namespaces merge comment arrays only for equal non-empty ids or when both sides omit id; everything else is last-writer-wins with the losing namespace archived. Both union sites share one shape gate (commentLogsUnionable, comment-union.ts ~:57-95; git.ts ~:830, ~:878); duplicate conflicts are removed (git.ts ~:1098-1128); a0f4d629 removed bogus fallback entries; no tbd writer moves a pending comment to a different issue (manual integration link refuses an already-linked bead, integration.ts ~:649-654). An earlier verdict was posted on PR #288 (issuecomment-5671648186) rather than #279. Remaining gaps filed as tbd-yqq7 (issues/.gitattributes never reaches existing repos, so the rule is only guaranteed on fresh repos) and tbd-v67e (uncontested relinks record spurious conflicts).
resolution: null
duplicate_of: null
---
PR279-R1 (High: comments moved across provider-link identities) was fixed in c9c65169 with an author disposition only; no independent re-review is recorded on the PR, unlike #282 and #283. Re-review the lineage rule at the current head (0b09e169, tree-identical) together with the scoping fix for third-party namespaces, and post the verdict on the PR.
