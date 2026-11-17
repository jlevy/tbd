---
type: is
id: is-01m6zg1dtgyfvx1dpa5bs31m9b
title: Verify published parser baselines with their own dependency trees
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-11-09T06:30:57.615Z
updated_at: 2026-11-09T06:30:57.615Z
---
The packed upgrade proof symlinks candidate node_modules into every published archive, so its unbundled library comparisons used Zod 4 for Zod 3 baselines. The same-format override also reaches a parser assertion hardcoded to the 0.7.0 link-field drop list, so 0.10.0 preserving those fields produces a false failure after its CLI upgrade, coexistence and config proofs pass. Isolate each historical library dependency tree and separate the oldest-f08 parser baseline from the same-format CLI override or select version-specific expectations. Keep the frozen/supply-chain rules and cover both published Zod versions. Discovered during the v0.11.0 release rehearsal (tbd-lv8i).
