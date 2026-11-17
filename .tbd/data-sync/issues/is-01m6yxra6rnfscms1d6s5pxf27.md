---
type: is
id: is-01m6yxra6rnfscms1d6s5pxf27
title: "PR #333 A2: gh backup makes the replacement non-atomic"
kind: bug
status: closed
priority: 3
version: 2
labels: []
dependencies: []
parent_id: is-01m6yxr8a28rgdwct1s2h4atm9
created_at: 2026-11-09T01:11:24.632Z
updated_at: 2026-11-09T01:12:14.505Z
closed_at: 2026-11-09T01:12:14.505Z
close_reason: "Fixed on PR #333 (e63cfed3/49e71c77); disposition reply posted"
resolution: null
duplicate_of: null
---
Low. ensure-gh-cli.sh backup_existing_local_gh then mv -f leaves a window with no ~/.local/bin/gh. Review A on https://github.com/jlevy/tbd/pull/333
