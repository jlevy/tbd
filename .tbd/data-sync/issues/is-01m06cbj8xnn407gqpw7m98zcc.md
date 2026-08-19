---
type: is
id: is-01m06cbj8xnn407gqpw7m98zcc
title: tbd setup --auto overwrites pinned get-tbd version in generated skill docs
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-16T22:51:23.794Z
updated_at: 2026-08-16T22:51:23.794Z
---
`tbd setup --auto` regenerates the agent skill surfaces (.agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md) with a hardcoded `npm install -g get-tbd@latest`, overwriting whatever was there. A repository whose supply-chain policy requires explicit version pins cannot express that preference, and setup silently reverts its customization on every run.

Found by dogfooding: metabrowser pins `get-tbd@0.4.2` in those files on purpose and enforces it with a test asserting the pin is present and `@latest` is absent (tests/test_public_hygiene.py::test_agent_tbd_skills_use_repository_version_pin). Running `tbd setup --auto` there overwrote both files and turned that test red, which then blocked pushing the branch — the repository's own pre-push gate correctly refusing content that violates its policy.

This is not metabrowser-specific. Any repository with a cool-off or pinning policy hits it, and npm has no per-package cool-off exclusion, so pinning is the normal way to comply.

Worth deciding:
- a config knob (e.g. settings.skill_version_pin: latest | <version> | repo-pinned) that setup honors when rendering the install line, or
- treating the install line as customizable content that setup preserves rather than overwrites, or
- at minimum, setup reporting that it changed a file whose content differs from what it would generate, rather than silently rewriting it.

The general shape matters more than this one line: setup regenerates several managed files, and a downstream repository currently has no supported way to hold any of them steady.
