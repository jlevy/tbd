---
type: is
id: is-01ktycs7ef2md3thzbqze2z098
title: "Review/S9+F7+F3: README prune w/ unrelated files; isLayoutUpgradeable accepts f01; layout gate not on doc cmds"
kind: bug
status: closed
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:26.895Z
updated_at: 2026-06-12T22:11:25.973Z
closed_at: 2026-06-12T22:11:25.973Z
close_reason: "Closed with verification, not code: F3 verified safe (readConfig gates newer formats on docs commands); S9 re-examined — keeping the fork dir when unrelated user files exist is correct (deleting user files would be worse); F7 intentionally permissive — the H3 doctor test pins older-known-format layouts as normal pending migration; an f04-floor tightening broke it and was reverted. Re-stamping derived metadata is safe for known compatible formats."
---
## Notes

Deferred (Tier 3), three low-risk items: S9 (README prune leaves dir when unrelated non-doc files present) is cosmetic; F7 (isLayoutUpgradeable accepts f01) is theoretical — no f01 repos exist in the wild; F3 (format/layout gate not enforced on docs subcommands) is the most substantive — worth confirming docs commands route through the data-context probe — but is not a regression from this feature. Left open for a follow-up pass.

## Notes

Deferred (Tier 3). Re-checked during the review pass:
- F3 (format/layout gate on docs subcommands): VERIFIED NOT A CORRECTNESS GAP. docs-fork.ts calls readConfig(), which runs checkFormatCompatibility() and throws IncompatibleFormatError on a newer-than-supported format (config.ts:115/55) — so the dangerous direction (newer repo, older client) IS gated on docs commands. The common-dir layout consistency check is not invoked, but docs operations don't touch the data-sync worktree (they use the fork-manifest lock dir), so it isn't needed there; an older (f04) repo migrates on the next issue command as designed.
- S9 (README prune leaves the dir when unrelated non-doc files are present): cosmetic, real but minor.
- F7 (isLayoutUpgradeable accepts f01): theoretical — no f01 repos exist.
Left open for a minor follow-up pass (S9 + optional F7 tightening); F3 needs no change.
