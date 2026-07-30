---
type: is
id: is-01kyt2g3c1hhj27qn4p42vfabs
title: "PR #199 Bugbot: committed regen noise (dev-dirty config stamp, pin scripts) and unexplained whole-tree flowmark example"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01kyt0apw3p31j7nbqt9p5fnfn
created_at: 2026-07-30T17:52:31.615Z
updated_at: 2026-07-30T17:55:32.051Z
closed_at: 2026-07-30T17:55:32.051Z
close_reason: "Fixed in b0d9cbc on PR #199: .tbd/config.yml and the four pin scripts restored to main's state (dev-dirty stamp and unreleased 0.4.1 fallback pins were test-run regen noise swept in by git add -A), and the guideline's flowmark hook example now uses staged_files with a hook exclude filter, documenting the whole-tree .flowmarkignore variant as a deliberate exception. Replied on both Bugbot threads."
---
Round 1 on PR #199 (commit 7bd76c8). Finding 1: git add -A captured .tbd/config.yml re-stamped to 0.4.1-dev.301.c458c21-dirty during pnpm test, plus four agent hook pin scripts whose npx fallbacks now pin unreleased get-tbd@0.4.1; restore all five from origin/main. Finding 2: the new guideline's lefthook example runs flowmark on the whole tree while the surrounding prose requires staged-only autofix; document both production patterns (staged_files with a hook exclude filter as tbd does, or whole-tree with .flowmarkignore as kpress does because flowmark-rs resolves .flowmarkignore relative to its target) and make staged_files the primary example.
