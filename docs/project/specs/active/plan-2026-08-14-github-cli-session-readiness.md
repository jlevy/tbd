---
title: "GitHub CLI Session Readiness for Coding Agents"
description: Make gh work without repeated proxy prefixes in supported remote sessions while keeping routine local-agent context quiet
author: Joshua Levy (github.com/jlevy) with Codex assistance
---
# Feature: GitHub CLI Session Readiness for Coding Agents

**Date:** 2026-08-14

**Author:** Joshua Levy (github.com/jlevy) with Codex assistance

**Status:** Draft

## Overview

tbd installs and verifies `gh`, but a proxied agent session can still require every
command to repeat a scoped `NO_PROXY` prefix.
Agents forget that recipe after a few commands or a context compaction, then incorrectly
conclude that GitHub reporting, release, or ref operations are unavailable.

Make the generated session bootstrap configure a usable session when the platform
provides a supported environment-persistence mechanism.
Give remote agents one clear capability verdict, keep healthy local sessions silent, and
move proxy internals behind an on-demand troubleshooting reference.

This plan supersedes the proposed plan in PR #221. PRs #219 and #221 remain useful as
incident evidence, but their broader documentation and persistent-wrapper designs are
not the intended implementation.

## Goals

- Make ordinary, unprefixed `gh` commands work for the rest of an egress-open Claude
  Code Cloud session when the scoped proxy bypass is required.
- Tell a remote agent plainly when `gh` is authenticated and usable so it does not infer
  a limitation from generic platform guidance.
- Keep routine local Codex, Claude Code, and other non-proxied sessions free of GitHub
  setup commentary when no action was needed.
- Keep the normal recovery path short and route uncommon proxy, broker, and permission
  diagnosis to an optional reference.
- Preserve pinned, checksum-verified installation, TLS verification, and network-policy
  boundaries.

## Non-Goals

- Checking npm for newer tbd releases or changing repository upgrade behavior.
  PR #223 owns the current version-aware hook and setup-upgrade work.
- Installing tbd globally from a session hook.
- Installing a user-level `gh` wrapper, editing shell profiles, or maintaining an
  access-plane state file.
- Circumventing blocked direct egress or an agent harness permission decision.
- Replacing git credential brokers or GitHub connectors.

## Review of PR #221

| Proposal | Disposition | Reason |
| --- | --- | --- |
| Compare config `tbd_version` with the running CLI | Drop | It cannot discover the reported failure when both the repository pin and running CLI are equally old. Registry-backed release discovery is a separate policy decision. |
| Check `latest` during every session | Drop | It adds startup network work and conflicts with the reviewed-version cool-off unless update eligibility is defined separately. |
| Report setup version transitions and avoid stale local CLIs | Keep in PR #223 | That work is already scoped as repository-upgrade behavior. |
| Stamp generated scripts | Drop | Generated hooks already contain an exact package pin, and setup/doctor compare their content with the bundled source. Another stamp adds no new signal. |
| Globally install tbd from the fallback | Separate | A repository hook should not overwrite a user-global CLI version. The inaccurate availability message can be fixed independently if it remains after PR #223. |
| Install a `~/.local/bin/gh` proxy wrapper | Replace | A wrapper can shadow the real binary and outlive the session or repository that justified it. Use platform-owned session environment persistence instead. |
| Persist an access-plane state file | Drop | The result is session-dependent and cheap to re-probe; a durable file creates invalidation and trust problems. |
| Emit one truthful GitHub verdict | Keep | This directly addresses agent confusion, provided healthy local sessions remain silent. |

## Design

### Session Bootstrap

Keep `ensure-gh-cli.sh` as the single installer and readiness probe:

1. Preserve the existing pinned download and checksum verification when `gh` is missing.
2. Test `gh auth status` through the inherited environment.
3. If a configured HTTPS proxy appears to intercept GitHub, retry authentication with
   the existing scoped GitHub host list in `NO_PROXY` and `no_proxy`.
4. When the direct retry succeeds and `CLAUDE_ENV_FILE` is available, append idempotent,
   additive exports to that file.
   Claude Code sources the file before later Bash commands, so subsequent `gh` calls
   need no prefix.
5. Do not write a wrapper, profile, repository file, or durable diagnosis state.
   If an agent platform lacks a documented session-environment channel, leave its
   environment unchanged and route the agent to the troubleshooting shortcut.

The implementation is capability-based: `CLAUDE_ENV_FILE` is the first supported adapter
because Claude Code documents it.
Add another adapter only when another target platform documents an equivalent
session-scoped mechanism.

### Output Contract

- Healthy local session, no remediation: no output.
- Remote or proxied session verified ready: one context line stating that `gh` is
  authenticated and should be used for GitHub work.
  This proves transport and authentication, not authorization for every repository
  operation.
- Authentication or network unresolved: one actionable line naming the result and
  routing to `tbd shortcut setup-github-cli`.
- Never label a token invalid solely from a proxy-mediated failure.

### Progressive Documentation

- Replace the resident proxy paragraph in the tbd skill with one short rule: before
  concluding that `gh` is unavailable, run `tbd shortcut setup-github-cli`.
- Reduce `setup-github-cli` to the operational decision path: verify, run the generated
  probe, use `gh` when ready, and report an actual policy or permission block.
- Move the channel model, broker variants, TLS inspection details, and manual prefix
  recipe to a directly linked reference loaded only when the operational path remains
  unresolved.
- Keep generated Claude and Codex scripts derived from the same bundled source, with
  platform-specific behavior gated by documented environment capabilities.

### Compatibility

There are no CLI, library, configuration-schema, server, database, or issue-file format
changes. Existing `settings.use_gh_cli` and `--no-gh-cli` behavior remains intact.
Running `tbd setup --auto` refreshes the generated scripts and skill copies as it does
today.

## Implementation Plan

### Phase 1: Session Readiness and Focused Guidance

- [ ] Make `ensure-gh-cli.sh` persist a verified scoped bypass through `CLAUDE_ENV_FILE`
  and emit the quiet, single-verdict output contract.
- [ ] Shorten the resident skill and `setup-github-cli`; move deep diagnostics to one
  on-demand reference.
- [ ] Update generated-surface, cache-drift, and setup tests for both Claude and Codex
  copies.
- [ ] Validate the packaged setup in local, egress-open proxied, and direct-egress-
  blocked fixtures.

## Testing Strategy

- Shell-level fixtures with fake `gh` and network probes cover normal auth, proxy
  interception with successful direct auth, invalid auth, blocked direct egress, absent
  environment persistence, and preservation of an existing `NO_PROXY` value.
- Source and generated-copy tests prove both agent surfaces receive the same script and
  that repeated setup is byte-identical.
- A Claude Code Cloud acceptance check proves a later, unprefixed `gh pr list` and
  `gh release list` succeed after the hook repairs the session.
- A local Codex or shell check proves the healthy path emits no GitHub guidance and
  changes no environment or user-level file.

## Rollout Plan

Ship as one setup-content change.
Existing repositories receive it through `tbd setup --auto`; no migration or manual
cleanup is required.
Close PR #221 as superseded when this plan is accepted, and keep any detailed evidence
from PR #219 in the on-demand reference rather than the routine shortcut.

## Open Questions

None. Additional agent platforms should be added only after their documented
session-environment contract is known.

## References

- [PR #221: agent session ergonomics](https://github.com/jlevy/tbd/pull/221)
- [PR #219: proxied-session evidence](https://github.com/jlevy/tbd/pull/219)
- [PR #223: repository upgrade behavior](https://github.com/jlevy/tbd/pull/223)
- [Claude Code hooks: persistent session environment](https://code.claude.com/docs/en/hooks#persist-environment-variables)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
