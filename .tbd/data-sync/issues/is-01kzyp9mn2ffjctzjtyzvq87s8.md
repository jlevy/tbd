---
type: is
id: is-01kzyp9mn2ffjctzjtyzvq87s8
title: Complete Linear onboarding and setup-linear guidance
kind: task
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T23:11:11.009Z
updated_at: 2026-08-13T23:44:28.096Z
closed_at: 2026-08-13T23:44:28.088Z
close_reason: "Completed in 6f588b5e: added the setup-linear shortcut, first-time and configured-repo onboarding paths, current credential safety and Linear permissions guidance, README/manual/welcome/setup discoverability, full and compact skill routing, generated surfaces, and regression coverage. Local CI passed 134 files / 1,982 tests; PR #212 hosted Ubuntu, macOS, Windows, Coverage & Lint, Benchmark, and secret checks all passed."
---
Audit and implement the end-to-end onboarding path for (1) initializing tbd and optionally configuring Linear for a repository, and (2) joining an existing tbd repository whose shared Linear config is present but whose personal credential is missing. Cover the official setup-linear shortcut, README/manual discoverability, welcome/setup output, full and compact generated skills, trigger metadata, and regression tests. Incorporate the useful companion-branch work without its generated config stamp, update it for PR #212 status behavior, and validate the shipped bundle.
