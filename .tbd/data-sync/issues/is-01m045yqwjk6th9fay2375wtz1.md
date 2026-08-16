---
type: is
id: is-01m045yqwjk6th9fay2375wtz1
title: "Electrobun: research build, packaging, code signing, and update pipeline"
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m045yxzjgmzsxbqmv5nack0w
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:03.250Z
updated_at: 2026-08-16T02:40:59.443Z
closed_at: 2026-08-16T02:40:59.443Z
close_reason: "Researched and then verified the critical finding firsthand by cloning the repo: the updater applies updates with no signature verification and no payload digest check (the update.json hash is only a version-change sentinel; every SHA-256 site in Updater.ts and extractor/main.zig is naming/locking/bookkeeping). Also: no Windows code signing at all, macOS signing opaque inside the closed-source Hutch CLI with issue #515 exposing an Apple ID credential, Linux self-extracting tar only with no distro packages."
---
electrobun CLI build config, bundle layout per platform, self-extracting/bsdiff update system and its real constraints, macOS signing and notarization of a Bun-based binary, Windows signing and WebView2 runtime dependency, Linux packaging and the LD_PRELOAD launcher wrapper.
