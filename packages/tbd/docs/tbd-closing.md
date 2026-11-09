# Session Closing Protocol

The commit, push, and CI steps apply when the project workflow publishes code or a PR.
Update the beads for every session.
Run remote bead sync when separate clones exchange state or project policy requires
publication; explicit project requirements remain authoritative.
Local collaborators in one clone see accepted changes immediately, and local-only or
offline work needs no remote exchange unless policy requires it.

**CRITICAL**: Before saying “done” or “complete”, you MUST run this checklist:

```
[ ] 1. Stage and commit: git add + git commit
[ ] 2. Push to remote: git push
[ ] 3. Start CI watch (BLOCKS until done): gh pr checks <PR> --watch 2>&1
[ ] 4. While CI runs: tbd close <id1> <id2> ... --reason "..." — one bulk call per group sharing a reason (never a per-ID loop)
[ ] 5. While CI runs: tbd sync when replicas exchange state or policy requires it
[ ] 6. Return to step 3 and CONFIRM CI passed
[ ] 7. If CI failed: fix, re-push, restart from step 3
```

## NON-NEGOTIABLE Requirements

### CI: Wait for `--watch` to finish

The `--watch` flag blocks until ALL checks complete.
Do NOT see “passing” in early output and move on—wait for the **final summary** showing
all checks passed.

### tbd: Update issues and sync

Every session must end with tbd in a clean state:
- Close/update **every issue** you worked on — group the IDs that share a reason (or the
  same field changes) and make one bulk `tbd close`/`tbd update` call per group, never a
  per-ID loop
- When replicas exchange state or project policy requires publication, run `tbd sync`
  and confirm it completed

**Publishing work is not done until pushed, CI passes, and every project-required sync
completes.**

> **Tip**: Run `tbd closing` anytime for this checklist.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
