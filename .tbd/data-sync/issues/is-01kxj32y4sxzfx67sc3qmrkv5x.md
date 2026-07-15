---
type: is
id: is-01kxj32y4sxzfx67sc3qmrkv5x
title: Defer redundant surface marker cleanup to the next real format migration
kind: task
status: open
priority: 3
version: 1
labels:
  - agent-skills
  - external-followup
  - github-190
dependencies: []
created_at: 2026-07-15T05:13:11.576Z
updated_at: 2026-07-15T05:13:11.576Z
---
Non-blocking follow-up from GitHub #190. tbd and Flowmark still emit redundant surface=agents-md attributes even though artifact location identifies the surface.

At the next genuine managed-surface format migration:
- remove surface= from newly generated tbd and Flowmark markers;
- continue recognizing existing markers with or without the attribute;
- preserve forward-format guards and duplicate-block collapse;
- update generator/golden tests in each owning repository.

Do not trigger a standalone format bump or cross-repository churn solely for this cosmetic field. Track the Flowmark portion in its owning repository before closing this bead. This bead is intentionally not a blocker for tbd-va8i.
