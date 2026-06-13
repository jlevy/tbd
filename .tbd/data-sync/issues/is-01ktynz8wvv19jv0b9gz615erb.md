---
type: is
id: is-01ktynz8wvv19jv0b9gz615erb
title: tbd misresolves its data dir under ambient GIT_DIR (e.g. run inside any git hook)
kind: bug
status: closed
priority: 2
version: 2
labels:
  - infra
dependencies: []
created_at: 2026-06-12T19:47:02.170Z
updated_at: 2026-06-12T23:56:19.293Z
closed_at: 2026-06-12T23:56:19.293Z
close_reason: "Fixed in b4369f4 on PR #169. Policy: tbd always operates on the repository containing cwd. New src/lib/git-env.ts (GIT_LOCATION_VARS + gitSafeEnv()) scrubs git location env vars at every git spawn site — git()/gitNoPrompt(), resolveGitCommonDir (the actual misresolution site, primary + fallback), fork-update merge/diff, doc-sync ls-remote, uninstall's six execSync calls — with a once-per-process stderr notice when an ambient GIT_DIR was ignored. tests/scrub-git-env.ts single-sources the var list from the product module. Verified red/green via git-env-isolation-e2e.test.ts: scrub disabled → isolation assertions fail; enabled → create lands in the cwd repo, the GIT_DIR repo stays byte-identical, warning fires exactly once. Full suite 1,313 green."
---
Follow-up to tbd-a1lc (the test-suite half is fixed in PR #169 commit 7f35ba8). The product issue remains: tbd resolves its repo root and git common dir via git discovery, which honors an inherited absolute GIT_DIR. Any user invoking tbd from inside a git hook (post-merge, post-checkout, pre-push wrappers) gets GIT_DIR exported by git; if cwd differs from the repo the hook belongs to (or with linked worktrees), tbd can read/write the WRONG repo's .tbd data and data-sync worktree (demonstrated: corrupted-data fixture wrote into the real ids.yml through tbd path resolution). Decide deliberately: (a) tbd ignores GIT_DIR and always discovers from cwd (predictable for a repo-local tool; breaks intentional GIT_DIR users), (b) tbd honors GIT_DIR only when it agrees with cwd discovery, warning otherwise, or (c) document hook usage and provide a sanctioned wrapper. Recommend (b). Needs a test running the built CLI with GIT_DIR pointed at a second repo.
