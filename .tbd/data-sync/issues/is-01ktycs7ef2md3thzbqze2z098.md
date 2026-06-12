---
type: is
id: is-01ktycs7ef2md3thzbqze2z098
title: "Review/S9+F7+F3: README prune w/ unrelated files; isLayoutUpgradeable accepts f01; layout gate not on doc cmds"
kind: bug
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:26.895Z
updated_at: 2026-06-12T17:45:59.843Z
---

## Notes

Deferred (Tier 3), three low-risk items: S9 (README prune leaves dir when unrelated non-doc files present) is cosmetic; F7 (isLayoutUpgradeable accepts f01) is theoretical — no f01 repos exist in the wild; F3 (format/layout gate not enforced on docs subcommands) is the most substantive — worth confirming docs commands route through the data-context probe — but is not a regression from this feature. Left open for a follow-up pass.
