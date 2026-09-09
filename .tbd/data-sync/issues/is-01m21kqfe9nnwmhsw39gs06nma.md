---
type: is
id: is-01m21kqfe9nnwmhsw39gs06nma
title: Patch js-yaml 3.x and 4.x overrides for CVE-2026-84375
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-supply-chain-audit
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
deferred_until: null
created_at: 2026-09-08T22:55:25.640Z
updated_at: 2026-09-09T02:02:47.753Z
closed_at: 2026-09-09T02:02:47.751Z
close_reason: Patched both installed js-yaml major lines with reviewed exact overrides; production audit, provenance checks, parser regression checks, and full test suite pass.
resolution: null
duplicate_of: null
---
Update the exact root overrides from js-yaml 3.15.1 and 4.3.1 to patched 3.15.2 and 4.3.2 for GHSA-2883-xcg3-v3hh / CVE-2026-84375. Both releases were published 2026-08-26 and remain inside the repository's 14-day floor. Human maintainer approved a documented exception after source review on 2026-09-08. Keep this as an isolated security PR; update only package.json and pnpm-lock.yaml, then validate registry signatures and integrity, production audit, package age with the recorded exception, parser compatibility, build, and full tests.

## Notes

Supply-chain review completed 2026-09-08 for the human-approved early security exception. GHSA-2883-xcg3-v3hh / CVE-2026-84375 is a high-severity uncontrolled-CPU vulnerability in YAML merge handling; js-yaml <3.15.2 and <4.3.2 are affected. Exact overrides are pinned to js-yaml@3.15.2 and js-yaml@4.3.2.

Both packages were published 2026-08-26 and were about 13.2 days old at review, just inside the 14-day floor. Registry checks found the same npm publisher and maintainers as the prior versions, unchanged dependencies/package scripts/files/bin, no install lifecycle scripts, registry signatures under the same npm signing key, and tarball SHA-1/SHA-512 values matching npm metadata. The 3.15.2 tarball matches the GitHub tag byte-for-byte. The 4.3.2 source files match its tag byte-for-byte; its six additional files are generated dist bundles/maps, and every embedded source-map source matches the tag. Upstream PR #797 was maintainer-merged with a GitHub-verified merge commit. The backport/release commits themselves are unsigned and no Sigstore attestations exist; exact source correspondence and verified registry signatures mitigate that residual risk.

Exploit-shaped inputs accepted by 3.15.1/4.3.1 are rejected by 3.15.2/4.3.2, while normal merge behavior is unchanged. The patch intentionally caps merge sequences at 100 entries even with unlimited total-merge configuration. tbd's production frontmatter wrapper supplies the separate yaml engine to gray-matter, so js-yaml 3.x remains shipped and audit-visible but is not invoked by that runtime path; js-yaml 4.x is used through development tooling.

Validation: pnpm audit --prod reports no known vulnerabilities; npm audit signatures verified the isolated 3.x and 4.x dependency trees; installed package contents match reviewed tarballs; focused YAML/frontmatter tests pass (4 files, 111 tests); lint, typecheck, formatting, action-pin checks, build, and parser regression checks pass; full suite passes with VITEST_MAX_WORKERS=2 (165 files, 2,480 tests). A prior four-worker run had two unrelated 5-second Git test timeouts; that file passed alone and in the full two-worker run. Filed tbd-jntc because check-package-age currently omits pnpm.overrides and therefore cannot enforce this exception automatically.
