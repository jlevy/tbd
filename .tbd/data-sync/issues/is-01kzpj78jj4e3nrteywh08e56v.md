---
type: is
id: is-01kzpj78jj4e3nrteywh08e56v
title: "PR #207 review R3: ancestor context rows contradict commandExact"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01kzpj754g9qh0be784sdkxdwr
created_at: 2026-08-10T19:26:03.345Z
updated_at: 2026-08-10T19:26:03.345Z
---
withAncestors injects dimmed parent rows that did not pass filters; tbd list --pretty builds the tree only from the filtered set (unmatched parents make children roots). The behavior is deliberate and disclosed in the UI (context dimming, matched count), but commandExact stays true, so the equivalent-command bar overclaims. Fix: report contextIds presence as an inexactness caveat; keep the feature.
