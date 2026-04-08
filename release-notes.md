## What’s Changed

### Fixes

- **ids.yml merge conflict resolution**: Auto-resolve trivial merge conflicts in
  `ids.yml` during `tbd sync` and `tbd doctor --fix`, preventing sync failures caused by
  concurrent ID mapping updates
- **Worktree merge strategy**: Add `merge=union` gitattributes inside the worktree for
  `ids.yml` so Git automatically merges concurrent additions without conflict
- **CI badge**: Scope coverage report action to PR events only to fix CI badge status

### Refactoring

- Remove dead code and consolidate duplicate constants

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.25...v0.1.26
