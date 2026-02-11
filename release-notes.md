## What’s Changed

### Fixes

- **`.tbd` root detection in subdirectories**: Fixed a bug where tbd could find a
  spurious `.tbd/` directory inside subdirectories (e.g., `node_modules/` or nested
  projects), causing it to operate against the wrong project root.
  Root detection now correctly walks up to find the actual project root.

- **Path functions require explicit `baseDir`**: Internal path resolution functions now
  require an explicit `baseDir` parameter instead of inferring it, preventing a class of
  bugs where operations could target the wrong directory when run from subdirectories.

- **Relative paths in uninstall preview**: `tbd setup --uninstall` preview output now
  shows relative paths instead of absolute paths, making the output cleaner and easier
  to read.

### Documentation

- **CLI agent skill patterns**: Updated guidelines for building CLI tools that function
  as agent skills, with new sections on file management and composition patterns.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.18...v0.1.19
