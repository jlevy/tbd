---
type: is
id: is-01kzzfsjnxn4n5ta9x2dg7f5h3
title: Hotfix published 0.6.0 dirty embedded CLI version
kind: bug
status: closed
priority: 0
version: 2
labels:
  - release
  - regression
dependencies: []
parent_id: is-01kzz0cgt3p51mrh1rt5bg9ypq
created_at: 2026-08-14T06:36:47.675Z
updated_at: 2026-08-14T07:49:24.119Z
closed_at: 2026-08-14T07:49:24.109Z
close_reason: "Fixed by PR #217 and published as get-tbd@0.6.1. Exact tag/SHA CI, packed CLI version, registry hashes, and npm provenance were verified."
---
Published get-tbd@0.6.0 has correct package metadata but its compiled CLI reports 0.6.1-dev.0.fa42a70-dirty. Release QA ran the packed web command in the source checkout, migrated .tbd/config.yml f06 to f07, and made the prepack rebuild dirty. Isolate packed QA, force TBD_VERSION_OVERRIDE from the exact tag for all release builds, fail closed on packed CLI version, and publish the immutable correction as 0.6.1.
