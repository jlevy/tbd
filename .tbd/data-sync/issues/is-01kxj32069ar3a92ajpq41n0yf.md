---
type: is
id: is-01kxj32069ar3a92ajpq41n0yf
title: Validate the refreshed skill guidance and bundled documentation
kind: task
status: closed
priority: 2
version: 3
labels:
  - testing
  - documentation
  - agent-skills
dependencies:
  - type: blocks
    target: is-01kxj32xtn7978fy1cw6f61qca
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:12:40.905Z
updated_at: 2026-07-15T05:59:13.209Z
closed_at: 2026-07-15T05:59:13.208Z
close_reason: Flowmark stable on second pass; links 200; local docs routes and generated mirrors verified; pnpm run ci (90 files/1373 tests) and publint pass.
---
Run end-to-end validation after the structural and content tasks land.

Acceptance criteria:
- Flowmark-format all changed Markdown and confirm a second format pass is a no-op.
- Verify every internal section link, relative bundle link, and cited primary-source URL.
- Build the package and use the local build to sync/install docs as required by docs/development.md.
- Exercise tbd guidelines cli-agent-skill-patterns and every new tbd docs show reference route.
- Run focused doc/integration/drift tests plus the repository quality gates appropriate to the final diff.
- Verify the concise core stays within its agreed size target and contains no hard-coded ecosystem counts intended to remain current.
- Confirm generated .agents, .claude, and skills/tbd artifacts agree with their canonical sources.
- Record the final validation evidence in the parent epic before closure.
