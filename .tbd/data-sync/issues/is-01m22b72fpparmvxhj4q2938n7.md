---
type: is
id: is-01m22b72fpparmvxhj4q2938n7
title: Freeze the f09 native-comment format from Phase 2 evidence
kind: task
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-native-comment-format-gate
labels: []
dependencies:
  - type: blocks
    target: is-01m220j40yd8fcw9n3yf4412dv
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
created_at: 2026-09-09T05:45:53.909Z
updated_at: 2026-09-10T21:47:27.942Z
---
Run and record the Phase 2 subset of tbd-q2w2 before f09 activation: compare independent immutable records with the repaired embedded-comment baseline; exercise equal retries, same-ID divergence, collision and publication failure, preservation recovery, directory distribution, bounded cold and warm reads, and Git growth. Record the selected representation, canonical-byte and shard decisions, measured default limits, and any rejected alternatives in the architecture decision. This task is the narrow format-freeze gate; the broader cross-phase coordination experiment remains open.

## Notes

PR #282 review follow-up:
https://github.com/jlevy/tbd/pull/282#issuecomment-5612012547

Before this format-freeze gate closes and before `tbd-x6eo` can expose a public
writer, its recorded evidence must include both deferred review suggestions:

- **S282-01 - create-only storage failure contract:** exercise the remaining
  `open`, write/close, `link`, cleanup `close`/`unlink`, and aggregate-error
  branches through a small injectable filesystem seam or equivalent deterministic
  failure injection. Include cleanup failure after a successful final link and
  simultaneous primary-plus-cleanup failure. At each boundary, assert final-path
  visibility, temporary/candidate retention or cleanup, complete error context,
  and the exact retry outcome on supported platforms.
- **S282-02 - durable agent-ID grammar:** before f09 is frozen, choose and record
  whether stored agent IDs are lowercase-canonical and whether their suffix must
  be a canonical Crockford ULID. Centralize one validator/schema used by
  `isAgentId()`, `NativeCommentSchema`, parsers, and generators, with acceptance,
  rejection, and case/canonicalization tests so these boundaries cannot drift.

These are activation/freeze criteria, not changes required in the unreachable
foundation layer shipped by PR #282.

PR #283 Astra review scale evidence:
https://github.com/jlevy/tbd/pull/283#issuecomment-5625831806

- **ASTRA-283-01 - transition-classification scaling:** the pre-fix classifier
  took 4,943 ms for 20,000 valid comments and 32,954 ms for 50,000 comments.
  PR #283 now indexes invalid entries once per source inventory and includes a
  50,000-record benchmark. Carry that benchmark and its accepted limit into the
  f09 format evidence before activation.
