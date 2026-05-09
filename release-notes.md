## What’s Changed

### Fixes

- **Multi-worktree sync support**: `tbd setup`, `tbd sync`, and `tbd doctor --fix` no
  longer fail with `fatal: 'tbd-sync' is already used by worktree at ...` when run from
  a sibling working tree of the same repo (e.g. user’s primary checkout plus a Codex /
  agent worktree). The hidden `.tbd/data-sync-worktree/` is now created on detached HEAD;
  `tbd-sync` is advanced via `git update-ref` compare-and-swap with merge-and-retry on
  race. Legacy attached worktrees from previous versions are silently detached in place
  by the next sync or doctor run (no data movement).
  See `tbd guidelines tbd-sync-troubleshooting`.
- **Invalid issue files**: `tbd list` and other commands now skip parse-invalid issue
  files with a readable warning instead of crashing or dumping raw validation errors.
- **Issue validation**: `tbd create` and `tbd update` now reject empty or overlong
  titles before writing issue files, with guidance to move long details into the body.
- **Doctor diagnostics**: `tbd doctor` now reports invalid issue files explicitly so
  users can repair or delete them.

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.1.26...v0.1.27
