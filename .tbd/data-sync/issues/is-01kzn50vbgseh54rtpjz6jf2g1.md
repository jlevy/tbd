---
type: is
id: is-01kzn50vbgseh54rtpjz6jf2g1
title: "integrations/linear/adapter.ts: LinearAdapter + ensureMeta cache"
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
  - type: blocks
    target: is-01kzn510qqbk3ax3pbw447xw8y
  - type: blocks
    target: is-01kzn5132f7f1gntqbg68wg2hv
  - type: blocks
    target: is-01kzn514mxmazhwq9fn1qpcpvt
parent_id: is-01kzn2w8x0c038fhk1c859248r
created_at: 2026-08-10T06:16:07.279Z
updated_at: 2026-08-10T06:16:16.797Z
---
LinearAdapter implements TrackerAdapter. ensureMeta(force?) fetches team workflow states (UUID by type) and labels into .tbd/data-sync/bridge/linear/meta.yml; refreshed on unknown state/label during push and on status --refresh. Mutating status requires the target state UUID, so map on type and never on name. Spec Components 8 and 11.
