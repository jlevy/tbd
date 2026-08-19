---
type: is
id: is-01m045zdsxka8ty06fzp1sn84v
title: Cross-doc consistency and correctness review of the desktop guideline set
kind: task
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:25.693Z
updated_at: 2026-08-16T04:45:46.787Z
closed_at: 2026-08-16T04:45:46.787Z
close_reason: "Cross-doc review done. Reciprocal claims verified consistent: the Electrobun doc says Tauri's updater requires a key you hold, the Tauri doc says Electrobun's verifies nothing — both match my source reading. Content is layered rather than duplicated (python-build-standalone deep in Electron, referenced from Tauri, absent from Electrobun). Restored the Tauri cross-references removed earlier and added reciprocal links in all three. Replaced a stale note in the Electron doc that claimed the alternatives comparison was 'tracked as separate research' with pointers to the two new guidelines."
---
Verify the three docs share structure without duplicating content, cross-reference each other correctly, do not contradict each other on shared facts (webview behavior, signing, sidecars, update mechanics), and that the when-not-to-use sections are mutually consistent. Verify every code example is internally coherent, as in the Electron review pass.
