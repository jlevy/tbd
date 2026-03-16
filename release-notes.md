## What’s Changed

### Fixes

- **Concurrent create short-ID mapping**: Prevent short-ID mapping loss when multiple
  `tbd create` commands run simultaneously
- **Doctor check ordering**: Reorder doctor checks so ID mapping repair runs after data
  migration, preventing false failures
- **Windows CI stability**: Resolve test flakiness across Windows CI environments
  including fd limit issues and timing-dependent tests
- **Migration test resilience**: Make migration tryscript test resilient to multiple
  migration commits

### Chores

- **Outbox cleanup**: Clear outbox after successful sync
- **Prefix instructions**: Clarify that `--prefix` is a short alphabetic issue ID prefix

### Documentation

- **Orchestration research**: Comprehensive research on Claude Code orchestration
  interfaces, UIs, and multi-agent tools (cmux, Symphony, Multiclaude)
- **Knowledge architecture research**: Research brief on agent knowledge-on-demand
  architecture with context conservation principles
- **Nightshift research**: Research brief for marcus/nightshift repo
- **External docs workflow**: Support for merging external documentation via URL

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.24...v0.1.25
