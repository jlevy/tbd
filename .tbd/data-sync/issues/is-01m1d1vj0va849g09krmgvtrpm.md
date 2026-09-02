---
type: is
id: is-01m1d1vj0va849g09krmgvtrpm
title: Bump pinned gh to 2.97.0 (four CVE fixes, gh skill support)
kind: bug
status: open
priority: 0
version: 2
labels: []
dependencies:
  - type: blocks
    target: is-01m1d1x86a96ak3rzd8w6ft7ej
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:18:16.343Z
updated_at: 2026-08-31T23:19:21.058Z
---
ensure-gh-cli.sh pins GH_VERSION=2.92.0. Bump to 2.97.0.

WHY (security, not housekeeping): 2.97.0 fixes four advisories, two of which hit paths tbd
shortcuts use constantly:
- GHSA-cg6r-mpgc-h9mm: 'gh auth status' without --show-token printed a portion of the token in
  plaintext for ghs_*, github_pat_*, ghu_* formats. ensure-gh-cli.sh and every PR shortcut run
  'gh auth status', and agents capture that output into context.
- GHSA-3m3g-3wcr-px46: escape-sequence injection - gh api, gh pr diff, gh gist view and others
  printed externally controlled content without neutralizing terminal escape sequences. Our
  review shortcuts pipe 'gh pr diff' and 'gh api' output directly.
- GHSA-4fjg-2h4q-fwg3: unescaped URL path components could address a different resource.
- GHSA-mm27-mwq9-fr5g: gh attestation verify signer-matcher bypass.

2.97.0 also carries the mature 'gh skill' command set needed by the sibling extension/skill bead.

WHY NOT 2.98.0: published 2026-08-20, which is 11 days old as of 2026-08-31 and fails the
14-day cool-off in SUPPLY-CHAIN-SECURITY.md. 2.97.0 (2026-07-31) is 31 days old and compliant.

VERIFIED CHECKSUMS from gh_2.97.0_checksums.txt:
  linux_amd64.tar.gz  a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112
  linux_arm64.tar.gz  73ea440ecad9c9e284429997ee6f93577bc6f7bc6fba357ef62c53ad8fb641a5
  macOS_amd64.zip     63298c998cc2a924c9e254c6af6a1caad6ece281122687a91f079bc0a462700e
  macOS_arm64.zip     a58b8fd77b417a38f47a0b54d1370c59b0fcdb324ccc9ca002b0998f7c4c999e

Update all three copies (packages/tbd/docs/install/ is the source; .claude/scripts/ and
.codex/ are generated copies that must stay byte-identical).
