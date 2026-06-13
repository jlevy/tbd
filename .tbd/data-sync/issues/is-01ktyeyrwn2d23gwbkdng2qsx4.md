---
type: is
id: is-01ktyeyrwn2d23gwbkdng2qsx4
title: Strict local-path grammar; reject home-relative paths with a clear error
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesqrj67qgwjvcg8mggkcg
created_at: 2026-06-12T17:44:25.749Z
updated_at: 2026-06-12T18:20:38.546Z
closed_at: 2026-06-12T18:20:38.546Z
close_reason: "Fixed in 6b6949e: local paths must be anchored (./ ../ / or drive letter); bare strings and ~ rejected with actionable errors; consumers may coerce at their boundary. Spec-mirror tests updated."
---
PR #169 review sec 4. parseDocRef accepts almost any string as a local path, making validation toothless. Require local paths to start with ./ ../ or / (or a Windows drive letter); reject bare strings and ~/ with actionable errors. Consumers may coerce bare strings by prepending ./ at their own boundary; document the decision in docref-format.md.
