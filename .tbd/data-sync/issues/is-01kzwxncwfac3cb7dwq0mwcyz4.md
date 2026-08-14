---
type: is
id: is-01kzwxncwfac3cb7dwq0mwcyz4
title: "Web: accept an explicit repository base directory"
kind: feature
status: closed
priority: 1
version: 3
labels:
  - review
  - web
dependencies: []
parent_id: is-01kzwv4rgyczfrw9dbxfw9f7x2
created_at: 2026-08-13T06:41:27.438Z
updated_at: 2026-08-13T07:16:17.487Z
closed_at: 2026-08-13T07:16:17.487Z
close_reason: Fixed in 5f32e14f with focused TDD and full release-gate validation
---
File/function scope: packages/tbd/src/cli/commands/web.ts command declaration and WebHandler.run; CLI/docs/spec/help acceptance. Add a documented explicit path contract so tbd web can be launched from an arbitrary cwd, resolve a supplied repo or subdirectory to the tbd root, and report the resolved root in its descriptor.

## Notes

Implementation complete pending final gates: packages/tbd/src/cli/commands/web.ts adds [path] and resolves repository/subdirectory inputs from arbitrary cwd; cli-web tests prove canonical root discovery. Help goldens, README, CLI manual, design/spec, changelog, development guide, source skill tiers, welcome shortcut, and portable skill contract are updated.
