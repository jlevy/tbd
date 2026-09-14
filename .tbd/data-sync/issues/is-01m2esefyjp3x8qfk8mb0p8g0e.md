---
type: is
id: is-01m2esefyjp3x8qfk8mb0p8g0e
title: "PR #279 test gaps: sync and merge-refs paths with differing link lineage, conflict destination, third-party namespace"
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erphvafq7s0t4fa4q7enpa
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:30.321Z
updated_at: 2026-09-14T14:27:48.636Z
---
Test gaps in PR #279 (tbd-8rnq), found in the release-compatibility review: the four mergeIssues unit tests (tests/integrations-comments.test.ts:190-291) and the workspace/outbox tests cover the postcondition directly, but nothing exercises it through the paths users run:
- mergeBeadAcrossRefs / `tbd sync` with provider comments and differing link lineage (tests/merge-refs.test.ts and rescue-*.test.ts have no comment cases);
- where a sync conflict's losing namespace ends up (depends on tbd sync attic decision);
- a third-party namespace with a comments array (see the scoping bug).
Add a two-clone e2e: clone A relinks X to Y, clone B adds a pending comment on X, both sync; assert the comment is not delivered to Y and the loser is recoverable where the docs say.

## Notes

Two of the three gaps closed on the branch for PR #287 (tests/merge-refs.test.ts, 'provider comments across refs'):

1. mergeBeadAcrossRefs with differing link lineage — ours keeps issue-X with a pending (unpushed) comment, theirs relinks to issue-Y with a delivered one. Asserts the two logs are never merged whichever lineage wins, so a comment queued against issue-X cannot surface under issue-Y, and that the discarded lineage is reported as an extensions.linear conflict rather than dropped.
2. A third-party namespace with a comments array through the same ref-merge path. Verified genuinely red by reverting PR #287's isCommentLog gate in place: 'expected [] to deeply equal ArrayContaining ["a","b"]' — the array was emptied through the path users run, not just through mergeIssues.

Still open, and why this bead stays open: gap 3, where a sync conflict's losing namespace ends up, cannot be tested until tbd-ajq2 decides and implements it — today tbd sync collects conflicts, prints 'preserved in attic', and writes no attic entry, so there is no destination to assert against. tbd-ajq2 is itself blocked by tbd-9fpp (f08 contract T4). Close this bead once tbd-ajq2 lands and the recoverability assertion can be written.

The two-clone e2e the description asks for is also not done: what is added here is the ref-level merge, not two real clones through the CLI. Worth doing with gap 3 in the same pass.
