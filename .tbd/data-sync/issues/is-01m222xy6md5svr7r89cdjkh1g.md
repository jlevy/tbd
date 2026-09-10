---
type: is
id: is-01m222xy6md5svr7r89cdjkh1g
title: Build native-comment inventory and immutable transition engine
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-inventory
labels: []
dependencies:
  - type: blocks
    target: is-01m222ys2fv17vvxnr67rxhwq9
parent_id: is-01m220htdx8tv5k1mpjavfpsca
created_at: 2026-09-09T03:21:06.003Z
updated_at: 2026-09-10T15:57:52.733Z
closed_at: 2026-09-09T08:07:56.872Z
close_reason: "Native-comment inventory and immutable transition layer is implemented, reviewed, fixed, documented, tested across platforms, and published as PR #283. Later Git guards, recovery, diagnostics, and activation remain tracked in the phase stack."
resolution: null
duplicate_of: null
---
Implement one bounded DataSyncInventory for comments and one deterministic immutable-transition engine. Validate exact sharded paths, fatal UTF-8, file modes, filename/embedded identity, canonical bytes, record and aggregate limits, and Git blob/index inputs. Accept only absent-to-valid-add or byte-identical existing records. Classify mutation, deletion, reparenting, invalid paths, and same-ID divergence; preserve raw alternatives with content-addressed provenance manifests. No public writer and no Git mutation integration in this layer.

## Notes

Completed in PR #283 and restacked onto final PR #282 head be81594396c3e136700e9cac84cf85404ac3cfbd. Original commits 18e1cdd4, 8c7bcdb8, and 64fb55a8 map exactly to 22bb558f, 406d814f, and fd54dc39. Their ten source/test paths retain binary diff SHA-256 76ea9b87fea4bb01b54419d0a4b0a0f4ec3100fbe328f1f7e82f83e9a5a13c42, with all three path-scoped range-diff entries equal. The layer delivers bounded filesystem/Git-ref/index inventories, pure immutable-transition classification, content-addressed quarantine evidence, shared bounded-file primitives, replacement-ref isolation, raw-path retention, and fail-closed data-sync root validation. It remains internal and dormant on f08 with no CLI, public export, active runtime caller, sync/workspace/provider integration, scaffold, or activation behavior.

Prior Fable review: https://github.com/jlevy/tbd/pull/283#issuecomment-5597942066. FABLE-283-01 was fixed by old 64fb55a8, now fd54dc39; disposition: https://github.com/jlevy/tbd/pull/283#issuecomment-5598438633. The nine-doc landing reconciliation is 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c; FABLE-DOC-01 through FABLE-DOC-04 are resolved and final-head re-review reports no findings. Focused suite: 100 passed, 1 platform skip. Full single-worker suite: 171 files, 2,590 passed, 1 skipped. Release/package QA passes, and same-version package comparison proves all executable, web, and type artifacts equal to #282; only the two intentional packaged design-doc corrections differ. Exact-head CI remains pending until the lease-protected force-push.

Final exact-head publication: PR #283 points to 9794b8b0d4fad7d9d42c0e9f61a033d24f30339c, is mergeable, and passed all seven GitHub checks. Independent final review: https://github.com/jlevy/tbd/pull/283#issuecomment-5621476642. Per-finding disposition: https://github.com/jlevy/tbd/pull/283#issuecomment-5621551927.
