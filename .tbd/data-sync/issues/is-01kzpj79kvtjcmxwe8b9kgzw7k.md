---
type: is
id: is-01kzpj79kvtjcmxwe8b9kgzw7k
title: "PR #207 review R4: local wakes flash rows with stale remote change markers"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01kzpj754g9qh0be784sdkxdwr
created_at: 2026-08-10T19:26:04.410Z
updated_at: 2026-08-10T19:26:04.410Z
---
Local fs wakes bump dataVersion/movedIds but changedIds and lastReport remain from the last remote wake (bead-web.ts ~:1228). The ● dot (client 'changed' set) then marks old remote rows, and an expanded locally-edited bead can show a stale 'Changed in the latest wake' delta. Fix: derive changedIds from movedIds for every movement, stamp lastReport with the dataVersion it belongs to, and gate the delta panel on that stamp matching.
