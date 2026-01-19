## What’s Changed

### Fixes

- **Subdirectory support**: Fixed running `tbd` commands from any subdirectory within a
  git repository, not just the root
- **Atomic writes**: Enforced atomic file writes throughout the codebase for improved
  data integrity

### Refactoring

- Codebase cleanup with consistent kebab-case file naming convention
- Consolidated command context handling for better maintainability

### Documentation

- Added comprehensive relationship types documentation (§2.7 in design spec)
- Added design documentation for planned transactional mode feature

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.3...v0.1.4
