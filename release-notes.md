## What’s Changed

### Fixes

- **ID mapping recovery after git merge**: `tbd` now automatically detects and
  reconciles missing ID mappings after git merges.
  When short IDs are lost due to merge conflicts in `ids.yml`, the doctor and sync
  commands recover the original short IDs from git history, preserving stable
  human-readable references.

- **Merge protection for ID mappings**: Added `.gitattributes` with `merge=union`
  strategy for `ids.yml`, preventing git merge conflicts from silently dropping ID
  mappings in the first place.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.21...v0.1.22
