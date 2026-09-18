---
type: is
id: is-01m2ttggrf25zhm7vepv8te36t
title: "github-merge becomes a four-value ladder: never, confirm-every, confirm-session, autonomous"
kind: feature
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-18T17:54:58.447Z
updated_at: 2026-09-18T19:44:35.542Z
closed_at: 2026-09-18T19:44:35.542Z
close_reason: "Landed on #309 across d2157660 (ladder), e079275c (discouraged field and notice removed, revoke returns to the ask-first default, Bugbot's quoted-line bound), and eca9187c (one canonical scope sentence in every document, changelog corrected). Recommended and grant value confirm-session; unanswered and revoke value confirm-every; never and autonomous need tbd policy set. Review H commissioned on the delta."
resolution: null
duplicate_of: null
---
User request 2026-09-18: github-merge should be multi-valued rather than yes/no. autonomous = the agent may decide to merge when the repo's review policies are met; confirm-session = merges autonomously but needs one confirmation in the session; confirm-every = asks before every merge; never = the agent does not merge. Recommended and grant value: confirm-session. Coordinator refinements: unanswered maps to confirm-every (today's not-granted behavior), so never means 'do not even ask'; pr-review-requirements applies to every value as an invariant rather than a property of autonomous; autonomous stays the discouraged value that prints a notice. Lands on #309 because the policy vocabulary is unreleased, so there is no migration. Needs a round-5 review of the delta since it changes a surface four rounds covered.
