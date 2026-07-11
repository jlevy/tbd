---
type: is
id: is-01kx7bbd9f88x70hhy3kgbgw1f
title: Resolve js-yaml <3.15.0 moderate DoS advisory (GHSA-h67p-54hq-rp68) via gray-matter
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-11T01:05:59.087Z
updated_at: 2026-07-11T01:05:59.087Z
---
Found during the v0.4.0 release supply-chain review (pnpm audit --prod). Quadratic-complexity DoS in js-yaml merge-key handling via repeated aliases; path packages/tbd > gray-matter > js-yaml (^3.13.1). No patched 3.x release exists on npm yet and js-yaml 4.x is a breaking major, so an override was not safe to rush into the release. Exposure is limited: tbd parses YAML front matter of repo-local issue files, so an attacker needs write access to the repo, and impact is slow parsing (DoS), not code execution. Fix options when available: (a) override js-yaml to a patched 3.x once published (respect 14-day cool-off), (b) bump gray-matter if it moves to js-yaml 4, or (c) replace gray-matter with the yaml package already used elsewhere. Documented in the 0.4.0 release notes Security section.
