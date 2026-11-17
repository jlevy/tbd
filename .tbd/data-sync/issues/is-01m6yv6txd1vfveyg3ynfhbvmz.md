---
type: is
id: is-01m6yv6txd1vfveyg3ynfhbvmz
title: Anchor generated Claude SessionStart/PreCompact/gh-cli commands at CLAUDE_PROJECT_DIR
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:54.764Z
updated_at: 2026-11-09T00:26:54.764Z
---
Follow-up named in PR #332's body and in reviews A2/B1: the generated Claude commands bash .claude/scripts/tbd-session.sh (--brief) and bash .claude/scripts/ensure-gh-cli.sh are still relative to the working directory, so PreCompact from a subdirectory exits 127 and from a nested checkout runs that checkout's script. Generating bash "$CLAUDE_PROJECT_DIR"/... would match the closing hook; it rewrites every project's settings.json once, so it needs an owner decision. Reviews: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820355604 https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820357750
