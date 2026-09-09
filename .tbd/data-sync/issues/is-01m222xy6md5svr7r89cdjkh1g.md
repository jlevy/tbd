---
type: is
id: is-01m222xy6md5svr7r89cdjkh1g
title: Build native-comment inventory and immutable transition engine
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-inventory
labels: []
dependencies:
  - type: blocks
    target: is-01m222ys2fv17vvxnr67rxhwq9
parent_id: is-01m220htdx8tv5k1mpjavfpsca
created_at: 2026-09-09T03:21:06.003Z
updated_at: 2026-09-09T08:07:56.873Z
closed_at: 2026-09-09T08:07:56.872Z
close_reason: "Native-comment inventory and immutable transition layer is implemented, reviewed, fixed, documented, tested across platforms, and published as PR #283. Later Git guards, recovery, diagnostics, and activation remain tracked in the phase stack."
resolution: null
duplicate_of: null
---
Implement one bounded DataSyncInventory for comments and one deterministic immutable-transition engine. Validate exact sharded paths, fatal UTF-8, file modes, filename/embedded identity, canonical bytes, record and aggregate limits, and Git blob/index inputs. Accept only absent-to-valid-add or byte-identical existing records. Classify mutation, deletion, reparenting, invalid paths, and same-ID divergence; preserve raw alternatives with content-addressed provenance manifests. No public writer and no Git mutation integration in this layer.

## Notes

Completed on codex/native-comment-inventory in commits 18e1cdd4, 8c7bcdb8, and 64fb55a8; PR https://github.com/jlevy/tbd/pull/283 stacked on #282. Delivered bounded filesystem/Git-ref/index inventories, deterministic immutable transition classification, content-addressed quarantine evidence, shared bounded-file primitives, Git replacement-ref isolation, raw path handling, f08-compatible empty-root behavior, and fail-closed data-sync root validation. Fable senior review: https://github.com/jlevy/tbd/pull/283#issuecomment-5597942066; finding fixed and disposition posted at https://github.com/jlevy/tbd/pull/283#issuecomment-5598438633. Focused suite: 100 passed, 1 platform skip. Full local gate: 2,584 passed, 1 skipped, with one unrelated timeout passing its isolated 2-test rerun. All seven GitHub checks green.
