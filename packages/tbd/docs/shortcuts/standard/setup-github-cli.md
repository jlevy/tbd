---
title: Setup GitHub CLI
description: Ensure GitHub CLI (gh) is installed and working
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
The GitHub CLI (`gh`) is required for PR and issue operations.

**In most cases, gh is already available** - tbd installs a SessionStart hook that
auto-installs gh on every session.

## Sanity Check (Do This First)

**Important:** Don’t assume gh works just because `command -v gh` succeeds.
On Claude Code Cloud, pre-installed gh may be outdated, broken, or incompatible.
Always verify:

```bash
# The real test: does gh actually work AND is it authenticated?
gh auth status
```

**Expected output:** Shows “Logged in to github.com” with your account.

If this fails, follow the steps below — but in a remote or cloud session where
`HTTPS_PROXY` is set, do not take the failure message at face value.
See [Proxied Remote Sessions](#proxied-remote-sessions) first.

## Corner Cases You May Encounter

1. **gh exists but is broken**: `gh --version` or `gh auth status` fails with errors
   - Solution: Reinstall via ensure script (installs fresh copy to ~/.local/bin)

2. **gh exists but wrong version**: Very old gh may lack required features
   - Solution: Reinstall via ensure script

3. **gh works but not authenticated**: `GH_TOKEN` not set or invalid
   - Solution: Set `GH_TOKEN` environment variable before starting session

4. **PATH issues**: gh installed but not in PATH
   - Solution: Ensure `~/.local/bin` is in PATH, or use full path

5. **`gh auth status` says “The token in GH_TOKEN is invalid” in a proxied remote
   session** (Claude Code Cloud and similar): the verdict may be manufactured by the
   session’s proxy, not by GitHub — the token is often perfectly valid.
   - Solution: See [Proxied Remote Sessions](#proxied-remote-sessions)

## Installation

1. **Run the ensure script:**
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh
   ```
   This script installs gh to `~/.local/bin` and checks authentication.
   If a session proxy blocks the download, it retries with a scoped `NO_PROXY` bypass
   automatically.

2. **If the script doesn’t exist:** Run `tbd setup --auto` to reinstall tbd hooks, which
   includes the gh CLI script.

3. **Manual installation (fallback):**
   ```bash
   # macOS
   brew install gh

   # Linux (Debian/Ubuntu)
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update && sudo apt install gh
   ```

## Authentication

Set `GH_TOKEN` environment variable with a GitHub personal access token **before**
starting the session.
Create a [Personal Access Token](https://github.com/settings/tokens?type=beta)
(fine-grained recommended) with **Contents** and **Pull requests** read/write
permissions, then export it (e.g. add `export GH_TOKEN=...` to your shell profile or set
it in your agent environment).

## Proxied Remote Sessions

Remote agent sessions (Claude Code Cloud and similar) usually route outbound HTTPS
through a policy proxy (`HTTPS_PROXY`). In such sessions “GitHub access” is not one
thing: it is several independent channels, and a failure on one says **nothing** about
the others.

1. **git fetch/push through a local credential broker.** The origin remote is rewritten
   to a local endpoint (e.g. `http://local_proxy@127.0.0.1:<port>/git/owner/repo`) that
   injects its own credentials.
   This channel works regardless of `GH_TOKEN`, but it is ref-scoped (verified in a
   Claude Code Cloud session):
   - Pushes to `refs/heads/*` (any branch name) succeed.
   - Pushes to `refs/tags/*` are refused with HTTP 403 at receive-pack.
   - **`git push --dry-run` passes for refs the broker later refuses** (dry-run stops at
     ref advertisement, before receive-pack), so a clean dry-run proves nothing.
   - Ref deletions can silently no-op: the push reports “Everything up-to-date” while
     the remote ref persists.
     Always confirm deletions with `git ls-remote`.
   - Remedy for all of these: do the ref operation on the direct channel instead, e.g.
     `gh api repos/{owner}/{repo}/git/refs -f ref=refs/tags/NAME -f sha=SHA` to create a
     tag and `gh api -X DELETE repos/{owner}/{repo}/git/refs/tags/NAME` to delete one
     (both verified).

2. **Proxied HTTPS to `api.github.com`.** The proxy may intercept GitHub and answer with
   its own 403s. Two intercept behaviors verified in Claude Code Cloud sessions:
   - *Path shaping*: only some REST paths pass through, and GraphQL may be limited to a
     pinned set of operations.
     `gh auth status` performs a GraphQL `viewer` query, so it can fail here — and gh
     then reports “The token in GH_TOKEN is invalid” **even when the token is valid**.
   - *Credential substitution*: the proxy replaces your `Authorization` header with its
     own session credential.
     Nothing observed through this channel tests *your* token: a bogus token can appear
     to work, and a valid one can appear invalid.

3. **GitHub MCP tools** (when the session provides them): a separate server-side
   channel, scoped to the session’s configured repositories.

4. **Direct egress, honoring `NO_PROXY`.** Governed by the environment’s network policy.
   When the environment allows GitHub egress, this channel carries your real `GH_TOKEN`
   untouched — and `gh` honors `NO_PROXY` natively, so no raw API calls are needed.

### Verified recipe

If `gh auth status` fails and `HTTPS_PROXY` is set, bypass the proxy **for GitHub hosts
only**. Keep `HTTPS_PROXY` exported for all other traffic, and never disable TLS
verification:

```bash
export NO_PROXY="api.github.com,github.com,release-assets.githubusercontent.com,objects.githubusercontent.com,codeload.github.com,raw.githubusercontent.com,uploads.github.com${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"
gh auth status    # now tests your real token against real GitHub
```

This recipe was verified end to end in an egress-enabled Claude Code Cloud session:
`gh auth status`, `gh pr list`, `gh release list`, tag creation and deletion via
`gh api .../git/refs`, and the pinned-checksum binary download all succeed on the direct
channel while the git broker or proxied channel refuses each of them.
(`release-assets.githubusercontent.com` is the current release-download host;
`objects.githubusercontent.com` is its predecessor, kept for compatibility.)

If direct connections **time out** instead, the environment’s network policy blocks
GitHub egress. Stop there: use the git broker and MCP channels for what they can do, and
report the limitation — do not attempt to tunnel around network policy.

### Diagnosing 403s

- **Read the body and headers.** A real GitHub response carries an `x-github-request-id`
  header. Proxy-manufactured responses carry the proxy’s own message (often with the
  provider’s `documentation_url`) and no GitHub request id.
- **Retest across channels** — with and without the `NO_PROXY` exports — before drawing
  conclusions. The same URL can 403 on one channel and succeed on another.
- **Never conclude from an unauthenticated probe.** Unauthenticated calls from shared
  cloud egress IPs can be rate-limited by GitHub itself, which mimics a policy block.
- **Distrust secondhand verdicts.** “Token invalid” from `gh auth status` in a proxied
  session is a channel symptom until proven on the direct channel.

## Quick Reference

| Problem | Solution |
| --- | --- |
| `gh: command not found` | Run ensure script or add ~/.local/bin to PATH |
| `gh --version` fails | gh is broken, reinstall via ensure script |
| `gh auth status` errors and `HTTPS_PROXY` is set | Proxied session: apply the NO_PROXY recipe above before trusting the error |
| `gh auth status` shows errors (no proxy) | GH_TOKEN not set or invalid |
| `Bad credentials` | Token expired or lacks permissions |
| `Resource not accessible` | Token lacks required scopes (need repo, workflow) |
| 403 with no `x-github-request-id` header | Proxy-manufactured response, not GitHub — see Proxied Remote Sessions |
| Tag push 403s but branch push works | Session git broker blocks `refs/tags` — create the tag on the direct channel via `gh api .../git/refs` |
| Ref delete reports “Everything up-to-date” but ref persists | Broker silently drops deletions — delete via `gh api -X DELETE .../git/refs/...` and confirm with `git ls-remote` |

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
