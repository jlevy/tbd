---
type: is
id: is-01m069bv4jzhxfw5q0hj1hff6b
title: "Release: get-tbd 0.7.0 (f08 format bump + Linear integration)"
kind: task
status: closed
priority: 0
version: 2
labels: []
dependencies: []
created_at: 2026-08-16T21:59:07.147Z
updated_at: 2026-08-16T23:07:39.259Z
closed_at: 2026-08-16T23:07:39.258Z
close_reason: get-tbd 0.7.0 published to npm with SLSA provenance (2026-08-16T22:42:43Z), verified by installing the published artifact. GitHub Release body is the CHANGELOG section. All three dogfood repos upgraded and stamped at fallback 0.7.0; tbd and metaproc doctor-clean, metabrowser clean except the known pinned-skill conflict tracked as tbd-351n.
---
The one release train for 0.7.0, per docs/publishing.md Step 0.

Scope frozen at: the f08 format bump (beads preserve unknown keys, docs/refs lists, integrations config regrouped) and the Linear integration, which is NEW in this release — v0.6.5 contains the adapter but never wires it into the CLI.

Gates: packed upgrade proof (4 scenarios), live integration QA playbook, main CI green on the exact tagged commit.

Post-publish: upgrade the global install, run setup --auto in tbd/metaproc/metabrowser, flip the two goldens this release un-breaks (tbd-62a5).
