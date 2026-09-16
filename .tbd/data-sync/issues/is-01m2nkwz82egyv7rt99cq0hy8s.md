---
type: is
id: is-01m2nkwz82egyv7rt99cq0hy8s
title: Verify pinned gh-stack extension identity before use
kind: bug
status: in_progress
priority: 1
version: 10
delegate: codex@spud10
labels:
  - supply-chain
  - github
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:23:14.305Z
updated_at: 2026-09-16T18:05:28.443Z
started_at: 2026-09-16T17:23:37.498Z
closed_at: null
close_reason: null
resolution: null
duplicate_of: null
---
PR #301 review finding: generated ensure-gh-cli installers currently run 'gh extension install github/gh-stack --pin v0.1.0' and accept any extension listing that contains 'gh stack'. Determine the safest supported cross-platform verification mechanism, require exact github/gh-stack v0.1.0 identity and immutable artifact evidence where available, preserve optional/nonfatal setup behavior, regenerate managed surfaces, and cover success/tamper/platform cases with focused tests.

## Notes

Follow-up independent security review eliminated the canonical-path crash window. gh extension install now runs only under an isolated XDG_DATA_HOME created by mktemp directly beneath the canonical data home, so staging and publication share a filesystem. The staged manifest identity/path is validated, the downloaded executable is replaced with pinned-digest bytes and signed/verified on macOS, the manifest path is atomically rewritten to the final executable, and the fully verified extension directory is published by one directory rename. The source disappearance, canonical directory, canonical gh identity, manifest path, and executable integrity are verified before the first gh stack --version execution. SIGKILL or power loss before publication can leave only a non-dispatchable isolated staging directory; after publication it can leave only the fully verified directory. Failure after publication removes or quarantines the canonical registration. Regressions prove isolated XDG registration under canonical data home, ordering of digest/signature/manifest checks before publication, exact post-publish verification before execution, and fail-closed cleanup. Regenerated Claude/Codex surfaces. Validation: pnpm build; bash syntax; 100/100 focused tests; installer suite 34/34; format check; lint/typecheck/action pins; generated-template comparisons; git diff check.
