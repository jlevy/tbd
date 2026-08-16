---
type: is
id: is-01kzyh1z8ncseb0a2vje8em8qn
title: A description push relocates the managed block to the end of the Linear description
kind: task
status: closed
priority: 3
version: 4
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T21:39:36.852Z
updated_at: 2026-08-13T23:03:20.730Z
closed_at: 2026-08-13T23:03:20.730Z
close_reason: "Fixed in dcc136dd; full local CI and all PR #212 hosted checks passed."
---
On a prose push, adapter.applyChanges writes externalPatch.description (prose with the managed block stripped), wiping the block; adapter.spliceDescription then re-fetches and appends it. A block a human had positioned mid-description therefore moves to the bottom on the first prose push, and each description change costs three API calls (update + fetch + update).

The design doc's claim that human prose on either side survives byte-for-byte is true of the PROSE, but the block's position is not preserved. Fix: have reconcile emit the already-spliced description so a single write does both, or document the relocation explicitly.

## Notes

Source: GitHub PR #212 formal review 4931891999. Address via fixed, rebutted, or deferred disposition map.
