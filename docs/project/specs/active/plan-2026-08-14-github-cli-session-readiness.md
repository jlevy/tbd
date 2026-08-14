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

This plan supersedes the GitHub/session proposals in PRs #219 and #221. Merged PR #223
is the baseline for repository upgrades, and merged PR #220 supplies the compatibility
decision procedure. Their incident evidence remains useful input, but their broad
resident documentation, global-install, wrapper, and durable-state proposals are not the
intended implementation.

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
  Merged PR #223 already owns the version-aware hook and setup-upgrade path.
- Installing tbd globally from a session hook.
- Installing a user-level `gh` wrapper, editing shell profiles, or maintaining an
  access-plane state file.
- Circumventing blocked direct egress or an agent harness permission decision.
- Replacing git credential brokers or GitHub connectors.

## Disposition of Related Work

| Proposal | Disposition | Reason |
| --- | --- | --- |
| Keep the proxy-channel, broker, TLS, and harness findings from PR #219 | Keep on demand | They help diagnose a failed normal path but dilute routine session context. Move them to one reference rather than the resident skill or operational shortcut. |
| Compare config `tbd_version` with the running CLI | Drop | It cannot discover the reported failure when both the repository pin and running CLI are equally old. Registry-backed release discovery is a separate policy decision. |
| Check `latest` during every session | Drop | It adds startup network work and conflicts with the reviewed-version cool-off unless update eligibility is defined separately. |
| Report setup version transitions and avoid stale local CLIs | Landed in PR #223 | The merged upgrade path is now the implementation baseline, not work for this plan. |
| Stamp generated scripts | Drop | Generated hooks already contain an exact package pin, and setup/doctor compare their content with the bundled source. Another stamp adds no new signal. |
| Globally install tbd from the fallback | Drop | Merged PR #223 deliberately chooses a compatible local CLI or the repository-pinned zero-install fallback. A repository hook should not mutate a user-global install. |
| Install a `~/.local/bin/gh` proxy wrapper | Replace | A wrapper can shadow the real binary and outlive the session or repository that justified it. Use platform-owned session environment persistence instead. |
| Persist an access-plane state file | Drop | The result is session-dependent and cheap to re-probe; a durable file creates invalidation and trust problems. |
| Emit one truthful GitHub verdict | Keep | This directly addresses agent confusion, provided healthy local sessions remain silent. |

## Design

### Session Bootstrap

Keep `ensure-gh-cli.sh` as the single installer and readiness probe:

1. Preserve the existing pinned download and checksum verification when `gh` is missing.
2. In an ordinary local session, verify `gh auth status` through the inherited
   environment and remain silent when it succeeds.
3. In a recognized mediated remote session—initially `CLAUDE_CODE_REMOTE=true`—or after
   inherited authentication fails with an HTTPS proxy, do not use the proxied result as
   the verdict. The proxy may reject a valid token or substitute a different credential
   and accept an invalid one.
   Run a bounded direct-egress probe to `api.github.com` with the existing scoped
   `NO_PROXY` and `no_proxy` host list, and require an `x-github-request-id` response
   header.
4. When the direct channel reaches GitHub, verify `gh auth status` on that channel.
   When it succeeds and `CLAUDE_ENV_FILE` is available, append idempotent, additive
   exports to that file.
   Claude Code sources the file before later Bash commands, so subsequent `gh` calls
   need no prefix.
5. Do not write a wrapper, profile, repository file, or durable diagnosis state.
6. If direct egress is closed, direct authentication fails, or the platform lacks a
   documented session-environment channel, leave its environment unchanged and route the
   agent to the troubleshooting shortcut without calling the token invalid from a
   proxied result.

The implementation is capability-based: `CLAUDE_ENV_FILE` is the first supported adapter
because Claude Code documents it.
Add another adapter only when another target platform documents an equivalent
session-scoped mechanism.

### Output Contract

- Healthy local session, no remediation: no output.
- Remote or proxied session whose direct channel is verified and persisted: one context
  line stating that `gh` is authenticated and should be used for GitHub work.
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
- Move the channel model, broker variants, per-host TLS inspection, harness-refusal
  diagnosis, response-origin checks, and manual prefix recipe to the managed reference
  loaded by `tbd docs show github-access-channels`, only when the operational path
  remains unresolved.
- Keep generated Claude and Codex scripts derived from the same bundled source, with
  platform-specific behavior gated by documented environment capabilities.

### Compatibility

| Area | Response | Why |
| --- | --- | --- |
| Internal code | DO NOT MAINTAIN | The bundled script, generated copies, docs, and tests update together; setup replaces old generated copies. |
| Library APIs | N/A | No library API changes. |
| Server APIs | N/A | No server API changes. |
| Plugin and extension APIs | N/A | No plugin or extension API changes. |
| File formats | N/A | No repository, issue, or generated-file format changes. |
| Persisted client state | N/A | `CLAUDE_ENV_FILE` is a platform-owned session channel, not tbd-owned persisted state. |
| Database schemas | N/A | tbd has no database-schema change in this work. |

Existing `settings.use_gh_cli` and `--no-gh-cli` behavior remains intact.
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

- Shell-level fixtures with fake `gh` and network probes cover silent local auth,
  successful local proxy auth, mediated-remote false failure and false success,
  successful direct auth, invalid direct auth, blocked direct egress, absent environment
  persistence, and preservation of an existing `NO_PROXY` value.
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
Close PRs #219 and #221 as superseded when this plan is accepted, preserving their
useful evidence in the on-demand reference rather than the routine shortcut.

## Open Questions

None. Additional agent platforms should be added only after their documented
session-environment contract is known.

## References

- [PR #221: agent session ergonomics](https://github.com/jlevy/tbd/pull/221)
- [PR #219: proxied-session evidence](https://github.com/jlevy/tbd/pull/219)
- [PR #223: repository upgrade behavior](https://github.com/jlevy/tbd/pull/223)
- [PR #220: backward-compatibility decision procedure](https://github.com/jlevy/tbd/pull/220)
- [metabrowser PR #43: downstream application of the compatibility template](https://github.com/jlevy/metabrowser/pull/43)
- [Claude Code hooks: persistent session environment](https://code.claude.com/docs/en/hooks#persist-environment-variables)
- [Claude Code cloud-session detection](https://code.claude.com/docs/en/env-vars#environment-variables)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
