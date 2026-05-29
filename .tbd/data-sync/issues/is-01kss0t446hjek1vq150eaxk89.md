---
type: is
id: is-01kss0t446hjek1vq150eaxk89
title: "[bug] tbd setup --auto pins dogfood scripts at dev-version strings that aren't on npm"
kind: bug
status: open
priority: 2
version: 2
spec_path: tests/qa/release-v0.2.0-upgrade.qa.md
labels:
  - v0.2.0
dependencies: []
parent_id: is-01ksrpb7b8cfwrzzd34ya9874q
created_at: 2026-05-29T04:45:19.365Z
updated_at: 2026-05-29T05:16:34.502Z
---
Observed during the v0.2.0 release: `tbd setup --auto` run from a dev checkout writes `npx --yes get-tbd@0.1.31-dev.34.cffb142-dirty` (or similar) into `.claude/scripts/tbd-session.sh`, `.codex/tbd-session.sh`, etc. Those versions are not published to npm, so anyone who relies on the npx fallback breaks. We worked around this manually for v0.2.0 by setting `TBD_VERSION_OVERRIDE=0.2.0` and regenerating before commit, but the next dev cycle will hit the same trap.

Proposed fix:
- Have setup.ts compute a separate 'pinned-fallback' version that is always the last released git tag (or the currently-published 'latest' on npm), not the build's reported version. Use it in the session-script template instead of `VERSION`.
- Implementation sketch: build-time inject `__TBD_LAST_RELEASE__` from `git describe --tags --abbrev=0 --match 'v*'` (alongside the existing `__TBD_VERSION__`) and expose it as `PINNED_RELEASE` from `cli/lib/version.ts`. Setup template uses `PINNED_RELEASE` for npx fallback and 'install with' line; user-facing `tbd --version` keeps reporting the full dev string.
- Add a build assertion: refuse to bake a dev-version into anything that gets committed, OR auto-fall-back to the last release.

Acceptance criteria:
- Run `pnpm build` from a between-releases checkout, run `tbd setup --auto` against the local install: the generated `.claude/scripts/tbd-session.sh` pins `get-tbd@<last-release>` (a real npm-published version), not the dev SHA.
- The pre-push hook can be tightened to reject any commit whose `.claude/scripts/tbd-session.sh` pins a dev-SHA version.
- The 'manual TBD_VERSION_OVERRIDE before commit' step in cut-release/publishing notes goes away.

User direction (during v0.2.0 release): 'Our listing dev version is not the version that will be released. You should make sure the process handles this correctly.'

## Notes

Release review follow-up (2026-05-29): confirmed this still happens when running local validation on the release branch. After `TBD_VERSION_OVERRIDE=0.2.0 pnpm build`, the root `.claude/scripts/tbd-session.sh` and `.codex/tbd-session.sh` can be regenerated with the dev build string (`0.1.31-dev...`) even though the PR head intentionally pins `get-tbd@0.2.0`. For v0.2.0, keep the branch files pinned to 0.2.0 and run an explicit `rg "0\\.1\\.31-dev|dev\\.[0-9]" .claude .codex` check before tagging. The generator fix remains for a follow-up release.
