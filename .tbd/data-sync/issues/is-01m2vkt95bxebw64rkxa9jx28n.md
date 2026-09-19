---
type: is
id: is-01m2vkt95bxebw64rkxa9jx28n
title: "PR #309: Review F has no published artifact; Bugbot unmarked review has no disposition reply"
kind: task
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2vpkmcvs4h8a0b2a9hwgpyq
parent_id: is-01m2vpkdg97d38s5hqjf79yt20
created_at: 2026-09-19T01:17:12.746Z
updated_at: 2026-09-19T02:07:43.125Z
---
Found by the 2026-09-19 verification of stack 312 against pr-review-workflows.

1. Security review F (round 4, head 0f26a4bc) is referenced by dispositions (https://github.com/jlevy/tbd/pull/309#issuecomment-5733632431), parent bead tbd-6u4c (closed), and the plan Outcome Notes, but no GitHub review or issue comment carries `<!-- tbd:review v=1 id=F`. E/G/C-on-310 all have comment URLs in the Outcome Notes; F does not. Findings F1–F8 are dispositioned (F5/F7 deferred as tbd-tli6 / tbd-tchx). Recover the body from the reviewer transcript if an audit trail is wanted; do not re-open the findings.

2. Unmarked Bugbot formal review https://github.com/jlevy/tbd/pull/309#pullrequestreview-5251296910 (inline https://github.com/jlevy/tbd/pull/309#discussion_r4049623785, commit d2157660) has no reply that names that URL and gives the finding a disposition. Review H dispositions note the hidden-grant raw-line interpolation was fixed in the H span and pinned by the malformed-block control-character test. Post an unmarked disposition reply on #309 when github-editing allows (ManagePullRequest post_comment; this token has no ManagePullRequest and gh comment is 403).

## Notes

Bodies drafted 2026-09-19. Parent must post:
1. /opt/cursor/artifacts/comment-309-review-F.md (recovered F; marker id=F at 0f26a4bc; do not re-open findings)
2. /opt/cursor/artifacts/comment-309-bugbot-dispositions.md (unmarked; heading names pullrequestreview-5251296910)
See /opt/cursor/artifacts/POSTING-INSTRUCTIONS-309-comments.md. Close this bead and tbd-jozo after both comment URLs exist.
