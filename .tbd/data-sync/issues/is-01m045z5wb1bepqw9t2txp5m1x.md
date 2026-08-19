---
type: is
id: is-01m045z5wb1bepqw9t2txp5m1x
title: "Tauri: deep survey of exemplary open-source Tauri projects"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m045z7zhg7tte2shyz23dast
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:17.579Z
updated_at: 2026-08-16T04:31:10.503Z
closed_at: 2026-08-16T04:31:10.503Z
close_reason: "Surveyed 14 real Tauri apps by reading their tauri.conf.json, capabilities, Cargo.toml, and CI. Strongest consensus: official updater with minisign pubkey (10 apps, universal). Most useful honest finding: CSP practice diverges sharply from docs — 5 apps disable it outright, only Wealthfolio uses script hashes. Capability scoping is a spectrum with Modrinth and Spacedrive exemplary and v1 auto-migration the main source of overly broad grants. Sidecars common (5/14). Real size data: Hoppscotch 165MB Electron to 8MB Tauri. CI pins ubuntu-22.04 for WebKit deps. Verified Jan, Kubetui, Noor are not Tauri."
---
Search GitHub carefully for high-quality open-source Tauri apps and study their actual configuration: tauri.conf.json, capabilities files, Cargo.toml, CI workflows, updater setup, and sidecar usage. Extract patterns that appear across multiple serious apps versus one-off choices.
