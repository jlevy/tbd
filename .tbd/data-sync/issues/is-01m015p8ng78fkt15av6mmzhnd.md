---
type: is
id: is-01m015p8ng78fkt15av6mmzhnd
title: Preserve hardened GitHub CLI installer during setup upgrades
kind: bug
status: in_progress
priority: 1
version: 2
labels: []
dependencies: []
created_at: 2026-08-14T22:18:42.223Z
updated_at: 2026-08-14T22:32:51.323Z
---
A fresh tryscript 0.4.2 to tbd 0.6.4 setup overwrites its hardened ensure-gh-cli.sh (unique temp directory, cleanup trap, atomic destination staging) with an older fixed-/tmp template and labels the Codex copy as Claude Code. Update the bundled generator, add regression assertions, release the next patch, and rerun the exact downstream upgrade before opening its PR.
