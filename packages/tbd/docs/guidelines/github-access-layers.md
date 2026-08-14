---
title: GitHub Access Layers (Claude Code Cloud)
description: Factual reference for how GitHub access is wired in Claude Code Cloud sandboxes — the proxy chain, the injected environment variables, the api.github.com broker, the session credential, and which git and API operations are actually permitted. Includes a re-verification command per claim. Use whenever `gh` fails, a token looks invalid, a push or release is rejected, GraphQL fails while REST works, or an agent is choosing between `gh`, the GitHub MCP tools, and raw `git`. Read this BEFORE reinstalling `gh`, rotating a token, or concluding that egress is blocked.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# GitHub Access Layers (Claude Code Cloud)

GitHub access from a Claude Code Cloud sandbox passes through **five independent
layers**. Any one can refuse a request, and from inside a shell the refusals look alike.
Most misdiagnosis comes from fixing the wrong layer: reinstalling `gh` when the network
is fine, rotating a token that was never invalid, or asking for egress to be opened when
egress was never closed.

**Provenance.** Every fact below was measured in a Claude Code Cloud session on
**2026-08-14**, in a session launched through the GitHub App integration.
Each claim carries the command that re-verifies it.
Some values are **session-specific** and are labeled as such — re-run the command rather
than trusting the value.
The architecture and the diagnostic methods are stable; the permissions are not.

| # | Layer | Controls | Isolating test |
| --- | --- | --- | --- |
| 1 | DNS | Name resolution | `getent hosts api.github.com` |
| 2 | Route | Which proxy traffic takes | `echo $HTTPS_PROXY $NO_PROXY` |
| 3 | TLS termination | Whether traffic is intercepted | certificate issuer |
| 4 | Policy | Permitted hosts, paths, operations | presence of `X-Github-Request-Id` |
| 5 | Credential | Identity and its permissions | `X-Oauth-Scopes` header |

## The proxy chain

Outbound HTTPS traverses up to three Anthropic-operated tiers.
All six CAs ship in one bundle, in staging and production variants:

```bash
grep -c "BEGIN CERTIFICATE" /root/.ccr/ca-bundle.crt   # 154 total CAs
```

| Role | CA common name |
| --- | --- |
| Local agent proxy | `CCR agent-proxy interception CA (production)`, `CCR Upstream Proxy CA (staging)` |
| Egress gateway | `sandbox-egress-gateway-production Egress Gateway CA`, `…-staging …` |
| TLS inspection | `sandbox-egress-production TLS Inspection CA`, `…-staging …` |

Both tiers of each role are trusted, so **the CA that actually signs a connection tells
you which tier that session was provisioned against**. Check it:

```bash
curl -sS -o /dev/null -v https://api.github.com/ 2>&1 | grep -i 'issuer:'
```

Sessions differ here, and it is worth checking before assuming two sessions behave
alike.

## Layer 2: Route — the environment variables

These are the only variables that affect routing:

| Variable | Observed value | Effect |
| --- | --- | --- |
| `HTTPS_PROXY` | `127.0.0.1:<port>` (port varies per session) | Sends traffic to the local agent proxy |
| `NO_PROXY` | see below | Hosts that bypass the local proxy |
| `GIT_SSL_CAINFO` | `/root/.ccr/ca-bundle.crt` | Makes git trust the interception CAs |
| `GIT_ASKPASS` | set | Supplies git’s GitHub credential; no credential helper or stored token |
| `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_*` | 3 keys | Injects `credential.interactive=false` and two `url.https://github.com/.insteadOf` rewrites (SSH → HTTPS) |

`NO_PROXY` as observed includes `registry.npmjs.org`, `pypi.org`,
`files.pythonhosted.org`, `index.crates.io`, `proxy.golang.org`, plus loopback and
private ranges. **GitHub is not in it**, so all GitHub traffic transits the local proxy.

Two things are *not* routing controls, and confusing them wastes time:

- **`GH_HOST`** selects *which GitHub* (github.com versus Enterprise).
  It does not select a route.
  Setting it to `github.com` changes nothing, since that is already the default.
- **There is no variable configuring REST and GraphQL separately.** One token and one
  host setting drive both, per `gh help environment`.

Never unset `HTTPS_PROXY`, add hosts to `NO_PROXY` to dodge a refusal, or disable TLS
verification. Besides being disallowed, it does not work: hosts *in* `NO_PROXY` still
return an Anthropic **egress gateway** certificate, proving a second enforcement point
upstream that the container cannot opt out of.

## Layer 3: TLS termination is per-host

Interception is selected per hostname, not per session.
Measured the same session:

| Host | Certificate issuer | Meaning |
| --- | --- | --- |
| `api.github.com` | Anthropic CA (leaf `CN=api.github.com`) | Intercepted |
| `github.com` | Anthropic CA | Intercepted |
| `raw.githubusercontent.com` | `Let's Encrypt` | **Not** intercepted — genuine GitHub cert |

Interception is normal and is how policy is enforced; it is not a fault.
What matters is that an intercepting proxy **can answer without ever contacting
GitHub**. That is layer 4. Test the exact host you care about; never generalize from one
GitHub host to another.

## Layer 4: Policy — the api.github.com broker

In GitHub-App-brokered sessions, `api.github.com` is allowlisted **per path**. Compare:

```bash
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/OWNER/REPO
```

**Every genuine GitHub response carries `X-Github-Request-Id`** and
`Server: github.com`.

- Headers present → GitHub answered.
  A 403 here is a real permissions result (layer 5).
- Headers absent, body is JSON citing `docs.anthropic.com` → **the proxy synthesized it
  and the request never left the network.** No token, scope, or `gh` version changes
  this.

Observed denial messages, each a distinct policy axis:

| Message | Axis |
| --- | --- |
| `GitHub access is not enabled for this session. An org admin must connect the Claude GitHub App…` | Repository scope |
| `This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served.` | API surface |
| `Creating, editing, or deleting releases is not permitted for this session type.` | Operation class |
| `sessions are bound to their configured repositories` (on `/user/repos`) | Repository scope |

## Layer 5: Credential

```bash
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user \
  | grep -iE 'x-oauth-scopes|token-expiration|x-ratelimit-limit'
```

Observed: `X-Oauth-Scopes` **empty**, `Github-Authentication-Token-Expiration` roughly
**8 hours out**, `X-Ratelimit-Limit: 15000`. That signature is a **GitHub App
installation token**, minted per session — not a PAT. Its reach comes from App
installation permissions, so **there are no OAuth scopes to widen from inside the
session**.

Read the three headers together:

- **Classic PAT** — scopes listed.
- **Fine-grained PAT** — empty scopes, distant expiration.
- **App installation token** — empty scopes, short expiration, elevated rate limit.

Empty `X-Oauth-Scopes` alone does **not** mean a broken token.

## Measured capability matrix

From one GitHub-App-brokered session on 2026-08-14. **Session-specific** — re-verify.

| Operation | Path | Result |
| --- | --- | --- |
| `gh api user` | REST | ✅ |
| `gh api repos/{owner}/{repo}` | REST | ❌ 403 (synthesized) |
| `gh api graphql` | GraphQL | ❌ 403 (synthesized) |
| `gh auth status` | GraphQL | ❌ false “token invalid” |
| `gh release create` | REST | ❌ 403 (synthesized) |
| `git fetch` | git | ✅ |
| `git push` (branch ref) | git | ✅ |
| `git push` (tag ref) | git | ❌ HTTP 403 |
| Create/merge PR, comment, read repo | GitHub MCP tools | ✅ |
| Create release or tag | GitHub MCP tools | ❌ no such tool exists |

The pattern worth internalizing: **reads and branch writes work; tags, releases, and
GraphQL do not.** A release therefore cannot be cut from such a session by any route —
the MCP toolset has no create-release operation, and both `gh` and tag push are refused.

## Choosing a write path

Prefer the first that works:

1. **GitHub MCP tools.** They reach the repository over a separate server-side path and
   permit writes `gh` is refused — creating PRs, merging, commenting.
   In a brokered session this is the intended path.
2. **Plain `git` over HTTPS.** Branch pushes succeed; tag pushes do not.
3. **`gh api` with explicit REST paths.** Works wherever policy permits the path, and
   sidesteps the GraphQL traps below.

## Traps that cause repeated misdiagnosis

- **`gh auth status` resolves identity over GraphQL.** Where GraphQL is restricted and
  REST is not, it reports *“The token in GH_TOKEN is invalid”* about a perfectly good
  token. Confirm with `GH_DEBUG=api gh auth status 2>&1 | grep graphql`. **Health-check
  with `gh api user --jq .login` instead**, and never gate a setup script on
  `gh auth status`.
- **`gh` subcommands quietly use GraphQL.** `gh repo view`, `gh release list`, and
  `gh pr list` fail where the equivalent `gh api repos/{owner}/{repo}/…` REST call
  succeeds.
- **`git push --dry-run` does not test authorization.** It reports `[new tag]` for a ref
  the server then refuses with 403. Never conclude a push will work from a dry run.
- **Partial success does not generalize.** `gh api user` returning 200 says nothing
  about `/repos/*`; a successful branch push says nothing about tags.
- **An empty `recentRelayFailures` does not mean nothing was blocked.** Synthesized 403s
  are not relay failures — the relay never happened.
  Check `curl -sS "$HTTPS_PROXY/__agentproxy/status"` for proxy state, but do not read
  an empty list as proof of unrestricted access.
- **A hook that runs a tool has not installed it.** `npx --yes <pkg> <cmd>` executes
  from a private cache and leaves no binary on `PATH`.

## Reporting a blocked operation

Name the layer and quote the evidence:

> `gh release create` returns 403 with
> `Creating, editing, or deleting releases is not permitted for this session type`. The
> response carries no `X-Github-Request-Id`, so the proxy synthesized it (layer 4) and
> it never reached GitHub.
> `gh api user` succeeds, so credential and network are fine.
> This needs a session type permitting release creation.

That tells a human exactly what to change.
“gh isn’t working” does not.

## Related Guidelines

- For installing and authenticating the CLI, see `tbd shortcut setup-github-cli`.
- For dependency policy in sandboxed environments, see
  `tbd guidelines supply-chain-hardening`.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
