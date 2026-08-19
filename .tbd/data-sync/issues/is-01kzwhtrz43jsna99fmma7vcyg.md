---
type: is
id: is-01kzwhtrz43jsna99fmma7vcyg
title: Cap composed sorting at two keys and add an explicit reset
kind: feature
status: closed
priority: 1
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:14:40.737Z
updated_at: 2026-08-13T04:06:22.863Z
closed_at: 2026-08-13T04:06:22.863Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Limit the sortable board to at most two composed keys: the newly clicked key becomes primary, the previous primary becomes secondary, and any older key is evicted. Add a compact accessible Reset sort action that is shown only when ordering differs from the default Updated-desc/Priority-asc flat view; activation restores exactly that default and exits Pretty. Cover direction reversal, two-key eviction, reset visibility/action, canonical URL state, and live-refresh persistence.
