## What’s Changed

### Features

- **Deterministic YAML field ordering**: Issue fields are now written in a canonical
  order (type, id, title, kind, status, priority, version first), making diffs cleaner
  and issue files more readable.

### Fixes

- **Outbox sync noise reduction**: Bulk outbox saves no longer trigger on trivial
  version or timestamp-only changes, reducing unnecessary sync churn.

- **Stable list sort order**: Issue list ordering now uses monotonic ULIDs, eliminating
  flaky ordering when issues are created in rapid succession.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.20...v0.1.21
