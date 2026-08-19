---
type: is
id: is-01kzz36z7kstw5nxa1me86ek86
title: Stamp this repo to tbd_format f07 after v0.6.0 publishes
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
created_at: 2026-08-14T02:56:55.027Z
updated_at: 2026-08-16T19:06:49.992Z
closed_at: 2026-08-16T19:06:49.991Z
close_reason: "Obsolete: superseded by the f08 bump. This repo is stamped tbd_format f08 and 0.6.0 is long published; the f07 stamp it describes never needs doing."
extensions:
  linear:
    id: 4ea92f00-17d9-43f5-a4dd-898d1d71175a
    linked_at: 2026-08-16T00:13:24.686Z
---
Post-release follow-up for the f07 bump. After get-tbd 0.6.0 is live on npm: npm install -g get-tbd@latest, run tbd setup --auto here, and commit the resulting .tbd/config.yml + agent-surface diff. Deliberately NOT done in the release PR: stamping before publish locks out every agent session that installs get-tbd@latest at startup (0.5.0 fails closed on f07) with an upgrade that does not exist yet. See docs/publishing.md Step 4 and docs/tbd-format-versioning.md (Release sequencing).
