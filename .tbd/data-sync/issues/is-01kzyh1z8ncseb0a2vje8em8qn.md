---
type: is
id: is-01kzyh1z8ncseb0a2vje8em8qn
title: A description push relocates the managed block to the end of the Linear description
kind: task
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:36.852Z
updated_at: 2026-08-13T21:39:36.852Z
---
On a prose push, adapter.applyChanges writes externalPatch.description (prose with the managed block stripped), wiping the block; adapter.spliceDescription then re-fetches and appends it. A block a human had positioned mid-description therefore moves to the bottom on the first prose push, and each description change costs three API calls (update + fetch + update).

The design doc's claim that human prose on either side survives byte-for-byte is true of the PROSE, but the block's position is not preserved. Fix: have reconcile emit the already-spliced description so a single write does both, or document the relocation explicitly.
