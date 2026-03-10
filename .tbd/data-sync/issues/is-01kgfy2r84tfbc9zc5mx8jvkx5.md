---
type: is
id: is-01kgfy2r84tfbc9zc5mx8jvkx5
title: Add Zod schemas for id-mapping.ts and prefix-detection.ts
kind: task
status: closed
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-02-02-skill-md-comprehensive-update.md
labels: []
dependencies:
  - type: blocks
    target: is-01kgfy2s3b37y02tya2nmnn6mm
parent_id: is-01kgfy2a5tz9hx3b7twjg2est7
created_at: 2026-02-02T19:43:10.083Z
updated_at: 2026-03-09T16:12:33.730Z
closed_at: 2026-02-02T19:52:47.962Z
close_reason: Added IdMappingYamlSchema and Ulid schema to schemas.ts. Updated id-mapping.ts to validate parsed YAML with Zod. Updated ShortId regex to handle legacy dotted IDs from imports. Skipped prefix-detection schema - it only reads legacy .beads config for migration and handles errors gracefully.
---
Add IdMappingSchema and PrefixDetectionCacheSchema to schemas.ts for validating parsed YAML data.
