---
type: is
id: is-01m2nkwz82egyv7rt99cq0hy8s
title: Verify pinned gh-stack extension identity before use
kind: bug
status: closed
priority: 1
version: 12
delegate: codex@spud10
labels:
  - supply-chain
  - github
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:23:14.305Z
updated_at: 2026-09-16T18:10:53.979Z
started_at: 2026-09-16T17:23:37.498Z
closed_at: 2026-09-16T18:10:53.978Z
close_reason: "Fixed: verified isolated staging now uses a checked publication sentinel to detect mv nesting races, fails closed before execution, and has focused regression coverage."
resolution: null
duplicate_of: null
---
PR #301 review finding: generated ensure-gh-cli installers currently run 'gh extension install github/gh-stack --pin v0.1.0' and accept any extension listing that contains 'gh stack'. Determine the safest supported cross-platform verification mechanism, require exact github/gh-stack v0.1.0 identity and immutable artifact evidence where available, preserve optional/nonfatal setup behavior, regenerate managed surfaces, and cover success/tamper/platform cases with focused tests.

## Notes

Follow-up security reviews eliminated both the canonical-path crash window and the remaining publish-time nesting race. gh extension install runs only under an isolated XDG_DATA_HOME created by mktemp directly beneath the canonical data home, so staging and publication share a filesystem. The staged manifest identity/path is validated, the downloaded executable is replaced with pinned-digest bytes and signed/verified on macOS, and the manifest path is rewritten to the final executable before publication. Immediately before the one-directory rename, the installer creates a unique verified-content sentinel inside the staged directory. Publication succeeds only if that exact sentinel appears directly under the canonical directory; a concurrent canonical-directory creation that makes mv nest the staged tree therefore fails closed. The sentinel is content-checked and removed before canonical identity verification or any gh stack execution. Outer cleanup removes or quarantines every failed canonical registration. Regressions inject the competing-directory race, prove gh stack --version is never attempted, and prove no canonical extension remains dispatchable. Regenerated Claude/Codex surfaces. Validation: pnpm build; bash syntax; 100/100 focused tests; installer suite 34/34; format check; lint/typecheck/action pins; generated-template comparisons; git diff check.
