---
close_reason: Implemented --id and --force options for tbd create. Added tryscript tests. When using --force with an existing ID, the old issue gets reassigned a new unique short ID.
closed_at: 2026-01-29T04:06:36.368Z
created_at: 2026-01-29T03:50:05.536Z
dependencies: []
id: is-01kg3xyqz2j5pbgfqtkkcqv7d2
kind: feature
labels: []
priority: 1
status: closed
title: Add --id option to tbd create for specifying short IDs
type: is
updated_at: 2026-01-29T04:06:36.369Z
version: 2
---
Allow users to specify a custom short ID when creating issues, preserving IDs from specs.

## Requirements
- Add --id <short-id> option to tbd create
- Validate that the ID doesn't already exist (error by default)
- Add --force flag to allow updating existing issues
- Strip any prefix from the provided ID (e.g., 'mf-djfs' -> 'djfs')

## Implementation
- Modify CreateOptions interface to include id and force
- Update create logic to use provided ID instead of generating
- Add hasShortId validation

## Documentation
- Update tbd create --help
- Update tbd-design.md §4.4 Create
- Add example in getting started guide

## Testing
- Unit test: create with --id succeeds
- Unit test: create with existing --id fails without --force
- Unit test: create with existing --id and --force succeeds
- Golden test: help output includes --id option
