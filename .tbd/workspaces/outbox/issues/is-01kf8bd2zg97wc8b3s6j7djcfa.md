---
close_reason: Already completed - state file changed from state.json to state.yml. See paths.ts:38 STATE_FILE = join(TBD_DIR, 'state.yml')
closed_at: 2026-01-26T17:17:26.906Z
created_at: 2026-01-18T10:46:22.944Z
dependencies: []
id: is-01kf8bd2zg97wc8b3s6j7djcfa
kind: task
labels: []
priority: 3
status: closed
title: Change local state file from state.json to state.yml for consistency
type: is
updated_at: 2026-03-09T16:12:31.986Z
version: 7
---
The local state file at .tbd/cache/state.json should be .tbd/cache/state.yml for consistency with other tbd config files (config.yml, meta.yml). Currently uses JSON with last_sync_at field. Change to YAML format. Files to update: packages/tbd/src/cli/commands/search.ts (STATE_FILE constant and read/write logic).
