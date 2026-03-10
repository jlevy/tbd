---
type: is
id: is-01kgfy2s3b37y02tya2nmnn6mm
title: Add Zod validation to id-mapping, attic, search, prefix-detection, doc-cache
kind: task
status: closed
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-02-02-skill-md-comprehensive-update.md
labels: []
dependencies:
  - type: blocks
    target: is-01kgfy2v1yk7hvffqs7sbshjh6
parent_id: is-01kgfy2a5tz9hx3b7twjg2est7
created_at: 2026-02-02T19:43:10.954Z
updated_at: 2026-03-09T16:12:33.735Z
closed_at: 2026-02-02T19:55:28.074Z
close_reason: Added Zod validation (AtticEntrySchema) to attic.ts for synced attic entries. id-mapping.ts was updated in tbd-xllh. search.ts/config.ts read local-only files. doc-cache.ts has manual type checking.
---
Update files to use Zod schemas for runtime validation: id-mapping.ts, attic.ts (use AtticEntrySchema), search.ts (use LocalStateSchema), prefix-detection.ts, doc-cache.ts.
