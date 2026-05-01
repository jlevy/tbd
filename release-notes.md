## What’s Changed

### Fixes

- **Invalid issue files**: `tbd list` and other commands now skip parse-invalid issue
  files with a readable warning instead of crashing or dumping raw validation errors.
- **Issue validation**: `tbd create` and `tbd update` now reject empty or overlong
  titles before writing issue files, with guidance to move long details into the body.
- **Doctor diagnostics**: `tbd doctor` now reports invalid issue files explicitly so
  users can repair or delete them.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.26...v0.1.27
