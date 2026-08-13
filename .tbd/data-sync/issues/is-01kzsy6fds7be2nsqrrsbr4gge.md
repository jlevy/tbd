---
type: is
id: is-01kzsy6fds7be2nsqrrsbr4gge
title: Reject unreadable ID mappings in strict web snapshots
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - storage
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T02:53:03.800Z
updated_at: 2026-08-12T04:38:51.115Z
closed_at: 2026-08-12T04:38:51.115Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The writer-fence audit found loadIdMapping catches every readFile failure and returns an empty mapping, although only ENOENT means an absent optional file. EACCES, EIO, EISDIR, and similar failures can therefore make tbd web publish a complete issue set under fabricated fallback display IDs, contradicting the strict-candidate design. Catch only ENOENT, propagate all other mapping reads, and add a regression proving unexpected read failures do not become an empty mapping.

## Notes

Audit expanded the same defect to saveIdMapping: its read/parse catch also treated corrupt or unreadable on-disk data as absent, bypassing the append-only guard and permitting overwrite. Both load and read-merge-write now ignore ENOENT only; all other failures propagate, with load and non-overwrite regressions.
