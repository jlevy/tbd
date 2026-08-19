---
type: is
id: is-01m044p9c6bhvyb8bbryag33hz
title: Prove whether Linear bumps updatedAt when a comment is created
kind: task
status: closed
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:57.662Z
updated_at: 2026-08-16T02:33:51.020Z
closed_at: 2026-08-16T02:33:51.019Z
close_reason: "Proven live: creating a comment advances the issue's updatedAt, so the delta-gated comment fetch is sound. Comment sync verified end to end (commentsPulled: 1) and the mirror settles afterwards. Full evidence in the description."
extensions:
  linear:
    id: 19fa31e8-49b0-47be-891d-93f9c181b11c
    linked_at: 2026-08-16T02:11:52.720Z
    comments:
      - id: bf92ad2c-39ea-414e-948a-6ee19a4d851b
        at: 2026-08-16T02:30:58.550Z
        author: josh
        body: "Probe: does creating a comment advance the issue updatedAt? Written by the tbd live-sync verification."
---
PROVEN on 2026-08-16 against live Linear (issue OS-247, this bead's own mirror).

Creating a comment DOES advance the parent issue's updatedAt:

  before         updatedAt = 2026-08-16T02:11:54.766Z
  comment created           2026-08-16T02:30:58.550Z
  after          updatedAt = 2026-08-16T02:30:58.529Z

So the delta-gated comment fetch is sound: the watermark prefilter will surface
an issue whose only change is a new comment, and inbound comments are not missed.

Worth noting the 21ms inversion — the issue's updatedAt (…58.529Z) is marginally
EARLIER than the comment's createdAt (…58.550Z). Anything comparing the two
directly should not assume comment.createdAt <= issue.updatedAt. The watermark
logic already re-fetches behind itself by WATERMARK_OVERLAP_MS (10 minutes), so
this is far inside the existing tolerance.

End-to-end verified in the same run: `tbd integration sync` reported
commentsPulled: 1, and two further syncs settled to nothing. This was the last
path in the comment sync that no test or live run had exercised.
