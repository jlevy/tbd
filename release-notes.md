## What’s Changed

### Features

- **Parent context for child beads**: `tbd show` now automatically displays parent
  context when viewing a child bead, making it easier to understand where a bead fits
  within a larger feature or epic.

### Fixes

- **Workspace gitignore protection**: Fixed an issue where agents could inadvertently
  add `.tbd/workspaces/` to `.gitignore`, which would prevent the outbox (used for sync
  failure recovery) from being committed.
  The warning is now generalized beyond Claude Code to cover all agents.

- **Setup verbose output**: Fixed a missed verbose block in `setup.ts` that could
  produce unexpected output during setup.

### Documentation

- **Writing style guidelines**: Added new `writing-style-guidelines` guideline for
  consistent documentation style.

- **QA playbook**: Added QA playbook shortcut and template for structured testing
  workflows.

- **Sub-agent research**: Added research brief on Claude Code sub-agents and
  orchestration patterns, including bead-managed loops, self-managed compaction, and
  custom sub-agent frameworks.

- **.tbd/ layout docs**: Restructured documentation to clearly separate committed vs
  gitignored sections of the `.tbd/` directory.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.19...v0.1.20
