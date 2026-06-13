---
type: is
id: is-01ktyesqrj67qgwjvcg8mggkcg
title: "DocRef v0.1 hardening (PR #169 review sec 4)"
kind: epic
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
child_order_hints:
  - is-01ktyeyq1dtcf43nhztp4jqg4v
  - is-01ktyeyrwn2d23gwbkdng2qsx4
  - is-01ktyeytscc0dbr88j72e043ww
  - is-01ktyeywn1xa6pjakggs1yea1y
  - is-01ktyeyyk5jjm8yq7hkmdxayn8
created_at: 2026-06-12T17:41:40.754Z
updated_at: 2026-06-12T20:26:00.179Z
closed_at: 2026-06-12T20:26:00.179Z
close_reason: "All 5 children closed: git: scheme dropped (future-protocols note), strict anchored locals, drive letters, fragment preservation, reference doc + manifest-source enforcement. docref v0.1 is now spec'd, strict, and enforced."
---
Make the docref grammar minimal, strict, and portable before anything depends on it. Decision: drop the git: scheme for now (unresolvable, mis-parses hosts); keep a note that additional protocols may be added in the future. Strict local paths, Windows drive letters, fragment preservation, then spec it in references/docref-format.md.
