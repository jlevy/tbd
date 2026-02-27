## What’s Changed

### Features

- **Doctor history scanning**: New `--max-history` option for `tbd doctor` to control
  how far back mapping recovery scans (defaults to 50 commits for faster execution)

### Fixes

- **Concurrent create race condition**: Prevent `tbd create` from losing short ID
  mappings when multiple creates run simultaneously
- **Migration safety**: Prevent migration from destroying `ids.yml` mappings; remove
  source files after successful migration and add verbose doctor output
- **Lockfile reliability**: Tighten lockfile defaults and clarify locking behavior
- **Sync status reporting**: Make ahead/behind status informational instead of a
  warning, reducing noise during normal sync operations
- **Doctor input validation**: Validate `--max-history` input to prevent unbounded
  history scans

### Documentation

- **Research brief template**: Improved with optional sections and blockquote
  instructions

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.23...v0.1.24
