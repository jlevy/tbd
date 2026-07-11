---
type: is
id: is-01kx7aamb654kekkm7z73zn5tb
title: doc-references test dirties the working repo (setup --auto at monorepo root in beforeAll)
kind: bug
status: open
priority: 2
version: 1
labels:
  - tests
  - hygiene
dependencies: []
created_at: 2026-07-11T00:48:04.965Z
updated_at: 2026-07-11T00:48:04.965Z
---
`tests/doc-references.test.ts` has a `beforeAll` that runs `node dist/bin.mjs setup --auto` with `cwd: MONOREPO_ROOT` (the real repo checkout) to install the gitignored docs cache before validating doc references. Side effect: every `pnpm test` run mutates tracked files in the developer's working tree:

- `.agents/skills/tbd/SKILL.md` and `.claude/skills/tbd/SKILL.md` are regenerated from the current source docs (currently produces real diffs because the committed SKILL.md files are stale vs. the bundled shortcut docs — e.g. `address-pr-review` and `pr-review-workflows` are missing from the committed shortcut table)
- `.tbd/config.yml` gets stamped with the dev git-describe version (e.g. `0.3.0-dev.310.<sha>-dirty`) and a new `tbd_upgrades` entry

Verified: clean tree + `npx vitest run tests/doc-references.test.ts` → those three files modified. On CI this is invisible (checkout discarded), but locally it leaves the repo dirty after every full test run, which trips stop-hooks/pre-commit cleanliness checks and risks the churn being accidentally committed into unrelated PRs.

Possible fixes (pick one):
1. Make the beforeAll install docs without running full setup (e.g. a docs-cache-only code path, or `setup --auto --surfaces=` with a no-surface selector if/when supported), so no tracked files are touched.
2. Point the test at a temp tbd root that copies the repo docs, keeping the real checkout untouched.
3. At minimum, have the beforeAll snapshot+restore the tracked files it touches.

Separately: regenerate the committed SKILL.md mirrors on main so they match the current bundled docs (the stale diff exists independent of this test).

Found while working on tbd-zuk9 (PR #188).
