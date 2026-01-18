## What’s Changed

### Features

- **Pretty list output**: New `--pretty` flag for tree view display with `--long`
  support
- **Sync summary tallies**: Detailed reporting of sync operations
- **Setup auto mode**: Improved migration workflow with `tbd setup auto`
- **Git version check**: Warns when Git 2.42+ is required

### Fixes

- Fixed exit codes to return non-zero on errors
- Fixed priority parsing consistency across CLI commands
- Fixed description width calculation in tree view for child nodes
- Fixed quiet flag handling for init and import commands
- Multiple CLI bug fixes for improved stability

### Refactoring

- **Command redesign**: Reorganized status/stats/doctor command hierarchy
- **Renamed closing command**: `close-protocol` renamed to `closing` for clarity
- CLI output design system utilities for consistent formatting

### Testing

- Added self-contained beads import test fixture
- Disabled commit signing in test repos for CI reliability

### Documentation

- Synchronized design documentation with implementation
- Fixed documentation inconsistencies and improved README

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.1...v0.1.2
