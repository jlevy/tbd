---
type: is
id: is-01m2k6rcmm43ac55gsnfp2v1ep
title: "PR #290 review R1: recover candidate-created Linear fixtures after early failure"
kind: bug
status: closed
priority: 2
version: 3
labels: []
dependencies: []
parent_id: is-01m2k6r6k1g36x6mtg58hppg93
created_at: 2026-09-15T18:55:03.827Z
updated_at: 2026-09-15T19:03:52.369Z
closed_at: 2026-09-15T19:03:52.367Z
close_reason: "Fixed in 664bf89a: token-scoped provider rediscovery, deduplicated archival, fail-loud cleanup, sanitized recovery context, failure-path tests, and live Linear verification; disposition published on PR #290."
resolution: null
duplicate_of: null
---
Astra follow-up review 5214509339, R1 Medium, packages/tbd/scripts/validate-linear-integration-live.ts:761-767. A first sync can create the blocked epic before failing, while fixture registration happens only after later assertions. Discover every active owned fixture by the run token within the configured team/project during final cleanup, deduplicate with known fixtures, retain safe recovery context on cleanup failure, and test the failure path.
