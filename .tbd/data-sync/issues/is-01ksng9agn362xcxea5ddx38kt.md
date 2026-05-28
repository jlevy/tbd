---
type: is
id: is-01ksng9agn362xcxea5ddx38kt
title: "H3: Implement tbd doctor --fix for layout.yml/config mismatch + surface future-format config error"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01ksnga2my9rmrq6sre0c57p3j
parent_id: is-01ksng8cqv1885jwvg3fagcfph
created_at: 2026-05-27T19:58:48.341Z
updated_at: 2026-05-28T04:02:23.238Z
closed_at: 2026-05-28T04:02:23.237Z
close_reason: null
---
CONTRACT GAP (both reviews). validateCommonDirLayout() at packages/tbd/src/file/common-dir-layout.ts:57-64 and :68-75 tells users to manually 'rm $(git rev-parse --git-common-dir)/tbd/layout.yml', but the spec's recovery contract (spec Format And Layout Versioning + Compatibility) routes repair through tbd doctor --fix. doctor.ts has NO layout.yml awareness (no readCommonDirLayout/writeCommonDirLayout/withSharedDataSyncLock).

Fix:
1. Add a layout.yml diagnostic to packages/tbd/src/cli/commands/doctor.ts: read via readCommonDirLayout(sharedPaths.sharedLayoutPath), validate against config. Report mismatch / future-format clearly.
2. Under --fix: acquire withSharedDataSyncLock; when layout.tbd_format is compatible with config, rewrite layout.yml from config via writeCommonDirLayout(sharedPaths, config, existing); when it is a future/unknown format, surface formatUpgradeMessage instead of attempting repair.
3. Update the two mismatch error messages (common-dir-layout.ts:58-63, :69-74) so 'tbd doctor --fix' is the PRIMARY remediation and the manual rm is a secondary hint.
4. Also surface the future-format CONFIG upgrade message in doctor (residual review item) instead of hiding it behind a generic 'Invalid config file' error — doctor is where users land during broken upgrades.
Acceptance: doctor diagnoses mismatch; doctor --fix repairs compatible mismatches under lock and reports upgrade for future formats; messages match the spec contract.
