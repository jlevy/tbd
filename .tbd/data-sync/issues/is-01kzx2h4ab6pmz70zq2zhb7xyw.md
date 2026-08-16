---
type: is
id: is-01kzx2h4ab6pmz70zq2zhb7xyw
title: Verify v0.5.0 publication end to end
kind: task
status: closed
priority: 1
version: 3
labels:
  - release
dependencies: []
parent_id: is-01kzx2gsbxgxck3kfswkb3gn3m
created_at: 2026-08-13T08:06:30.474Z
updated_at: 2026-08-13T08:53:31.241Z
closed_at: 2026-08-13T08:53:31.241Z
close_reason: Verified GitHub Release, npm latest metadata, registry signatures and SLSA provenance, isolated install, CLI version/help, clear uninitialized and invalid-path failures, initialized empty repository, explicit subdirectory resolution, packaged web page/API, live local update, and graceful shutdown.
---
Watch the tag-triggered release workflow, verify the GitHub Release notes and provenance-bearing npm publication, then install the exact npm artifact in isolation and smoke-test version, help, initialization errors, empty repositories, explicit repository paths, and the packaged web viewer.
