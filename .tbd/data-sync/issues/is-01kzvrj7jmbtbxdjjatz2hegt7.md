---
type: is
id: is-01kzvrj7jmbtbxdjjatz2hegt7
title: Reject executable gray-matter front-matter engines
kind: bug
status: closed
priority: 0
version: 3
labels:
  - release
  - security
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
created_at: 2026-08-12T19:53:06.387Z
updated_at: 2026-08-12T23:38:10.912Z
closed_at: 2026-08-12T23:38:10.911Z
close_reason: "Implemented and verified in PR #209: all front matter is YAML-only before parser dispatch, the executable engine cannot run, and the missing-ID transcript is deterministic. Full local CI and pre-push suites passed all 1,602 tests."
---
gray-matter 4.0.3 merges custom engines with built-in json/javascript engines. Every current matter() call accepts an explicit ---javascript language marker, whose built-in parser uses eval. A malicious issue or doc arriving through repository content can therefore execute code when tbd parses it. Centralize all calls in src/utils/gray-matter.ts, inspect the explicit language marker before dispatch, allow only bare YAML/yaml/yml, reject all other languages with a stable error, migrate every production and test call site to the boundary, and add a regression proving a JavaScript block is rejected before evaluation. Update the design, YAML guideline, and Unreleased security notes.
