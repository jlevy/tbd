---
type: is
id: is-01m7khcz77pc6k75erekrh33f0
title: "PR #332 D3: Decide how setup pins tbd_fallback_version inside the 14-day cool-off"
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-11-17T01:19:33.095Z
updated_at: 2026-11-17T01:19:33.095Z
---
Review D (Medium), owner decision. setup.ts:2326-2330 stamps tbd_fallback_version with the running release; the hardened launcher runs it under --before=now-14d, so a pin younger than 14 days fails (ETARGET) until it ages. Options: keep the previous pin while the running release is in the cool-off, or keep stamping and print when the pin becomes installable. Also give the missing-npx hint (setup.ts:541) the TBD_COOL_OFF_NOTE. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560
