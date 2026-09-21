---
type: is
id: is-01m30p2f1q0shk6camavpdygdy
title: "Cleanup: dead setup handlers, duplicated ENOENT predicate, doctor cache reads, policy repair refspec"
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-09-21T00:32:50.230Z
updated_at: 2026-09-21T00:32:50.230Z
---
Deferred from PR #309 review N (N6, N9) and N23's CLI half. (1) SetupCodexHandler.run, checkCodexSetup, removeCodexSection, removetbdSection in packages/tbd/src/cli/commands/setup.ts have no caller ('tbd setup codex --remove' is an unknown option) yet carry lock, symlink and ENOENT handling; delete them. (2) Export one isErrorWithCode predicate instead of the eight pasted copies in setup.ts. (3) doctor.ts hasCompleteSkillDocCache reads ~105 files in full, twice per run, only to test existence; use access(). (4) scripts/validate-upgrade-package.mjs repeats its stamped-surface block in two scenarios; extract a helper. (5) The repair string printed by policy-grants.ts omits the leading '+' from the refspec, so following it fails after a non-fast-forward. All are behavior-neutral cleanups except (5), which fixes a user-facing instruction.
