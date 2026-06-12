---
type: is
id: is-01ktyh25qat65bg1epys3p2m2b
title: pre-push hook test run corrupts the repository (tests inherit hook git env)
kind: bug
status: closed
priority: 0
version: 3
labels:
  - infra
dependencies: []
created_at: 2026-06-12T18:21:14.346Z
updated_at: 2026-06-12T19:47:00.688Z
closed_at: 2026-06-12T19:47:00.688Z
close_reason: "Fixed in 7f35ba8 on PR #169 branch, two independent layers: (1) tests/scrub-git-env.ts via vitest setupFiles deletes GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/etc. in every worker, making all ~60 {...process.env} spawn sites safe; (2) scripts/scrub-git-env.mjs wraps every lefthook pre-push command. Root cause confirmed empirically (git exports GIT_DIR to pre-push hooks when pushing from a linked worktree; absolute GIT_DIR overrides cwd discovery in spawned git/tbd). Verified red/green against a sacrificial victim repo with the real suite (merge-refs/corrupted-data tests mutate victim pre-fix, byte-identical post-fix), then end-to-end: hooked push from the worktree ran the full suite with zero ref changes in either repo. Product-level follow-up filed separately."
---
Reproduced 2026-06-12 in a worktree of this repo: 'git push' triggered the lefthook pre-push test suite, and git-using tests then operated on the REAL repository instead of their temp fixtures. Damage observed: local main rewritten to fixture commits ('base', 'theirs appends B'); the checked-out branch advanced onto fixture commits ('Initial commit' + 'Add .tbd/.gitattributes'), which a subsequent push briefly published to the PR branch (force-fixed); core.bare flipped to true; fixture branches feature/ours/theirs created; the shared common-dir layout.yml stamped f05 by PR-branch test code; and the data-sync worktree's ids.yml overwritten with the 'this: is: not: valid: yaml:' corruption fixture (1030 mappings lost; restored from git + reconstruction). Running the identical suite directly (npx vitest run / tryscript) is safe; only the hook-context run is destructive — consistent with git hooks exporting GIT_DIR/GIT_INDEX_FILE/GIT_WORK_TREE, which child git processes spawned by tests inherit, retargeting their 'git init/commit/branch' at the real repo. Fix candidates: (1) scrub GIT_* env in lefthook pre-push commands (env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE); (2) defense in depth: test helpers that spawn git should pass a sanitized env. Workaround until fixed: run tests manually and push with --no-verify or SKIP=test. Affects any contributor pushing from a linked worktree (and possibly the main checkout).
