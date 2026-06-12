---
type: is
id: is-01ktyh25qat65bg1epys3p2m2b
title: pre-push hook test run corrupts the repository (tests inherit hook git env)
kind: bug
status: open
priority: 1
version: 1
labels:
  - infra
dependencies: []
created_at: 2026-06-12T18:21:14.346Z
updated_at: 2026-06-12T18:21:14.346Z
---
Reproduced 2026-06-12 in a worktree of this repo: 'git push' triggered the lefthook pre-push test suite, and git-using tests then operated on the REAL repository instead of their temp fixtures. Damage observed: local main rewritten to fixture commits ('base', 'theirs appends B'); the checked-out branch advanced onto fixture commits ('Initial commit' + 'Add .tbd/.gitattributes'), which a subsequent push briefly published to the PR branch (force-fixed); core.bare flipped to true; fixture branches feature/ours/theirs created; the shared common-dir layout.yml stamped f05 by PR-branch test code; and the data-sync worktree's ids.yml overwritten with the 'this: is: not: valid: yaml:' corruption fixture (1030 mappings lost; restored from git + reconstruction). Running the identical suite directly (npx vitest run / tryscript) is safe; only the hook-context run is destructive — consistent with git hooks exporting GIT_DIR/GIT_INDEX_FILE/GIT_WORK_TREE, which child git processes spawned by tests inherit, retargeting their 'git init/commit/branch' at the real repo. Fix candidates: (1) scrub GIT_* env in lefthook pre-push commands (env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE); (2) defense in depth: test helpers that spawn git should pass a sanitized env. Workaround until fixed: run tests manually and push with --no-verify or SKIP=test. Affects any contributor pushing from a linked worktree (and possibly the main checkout).
