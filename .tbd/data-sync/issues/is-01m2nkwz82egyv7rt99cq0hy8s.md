---
type: is
id: is-01m2nkwz82egyv7rt99cq0hy8s
title: Verify pinned gh-stack extension identity before use
kind: bug
status: closed
priority: 1
version: 4
delegate: codex@spud10
labels:
  - supply-chain
  - github
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T17:23:14.305Z
updated_at: 2026-09-16T17:43:41.565Z
started_at: 2026-09-16T17:23:37.498Z
closed_at: 2026-09-16T17:43:41.562Z
close_reason: "Resolved PR #301 High finding with exact extension identity, artifact-integrity verification, and fail-closed regression coverage."
resolution: null
duplicate_of: null
---
PR #301 review finding: generated ensure-gh-cli installers currently run 'gh extension install github/gh-stack --pin v0.1.0' and accept any extension listing that contains 'gh stack'. Determine the safest supported cross-platform verification mechanism, require exact github/gh-stack v0.1.0 identity and immutable artifact evidence where available, preserve optional/nonfatal setup behavior, regenerate managed surfaces, and cover success/tamper/platform cases with focused tests.

## Notes

Implemented pinned SHA-256 verification for gh-stack v0.1.0 assets on Darwin/Linux amd64/arm64; exact gh extension list and manifest identity checks; bounded downloads; pre-download removal/quarantine of any existing gh stack command; atomic replacement of gh's unchecked download; macOS ad-hoc signing only after digest verification; post-registration fail-closed cleanup; and gating of agent-skill installation on a verified extension. Regenerated Claude and Codex installer surfaces. Validation: bash syntax; pnpm build; 100 focused tests across ensure-gh-cli-script, setup-flows, integration-files; focused installer suite 34/34; pnpm format:check; pnpm lint:check; git diff --check; generated-template byte comparisons. Official GitHub release API digests were checked directly for all four supported assets.
