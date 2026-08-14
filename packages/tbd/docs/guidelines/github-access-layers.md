---
title: GitHub Access Layers
description: How GitHub access actually works for an agent in a sandboxed environment (Claude Code on the web, CI containers, and similar), and how to tell which of five independent layers is refusing a request. Use whenever `gh` fails, a token looks invalid, a push or release is rejected, GraphQL fails while REST works, or an agent is deciding between `gh`, the GitHub MCP tools, and raw `git`. Read this BEFORE reinstalling `gh`, rotating a token, or concluding that egress is blocked.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# GitHub Access Layers

An agent working in a sandboxed environment reaches GitHub through **five independent
layers**. Any one of them can refuse a request, and they refuse in ways that look alike
from inside a shell.
Nearly every GitHub misdiagnosis comes from fixing the wrong layer: reinstalling `gh`
when the network is fine, rotating a token that was never invalid, or asking for egress
to be opened when egress was never closed.

Work top to bottom. Each layer has a test that isolates it, and the tests are cheap.

| # | Layer | What it controls | Isolating test |
| --- | --- | --- | --- |
| 1 | DNS | Name resolution | `getent hosts api.github.com` |
| 2 | Route | Which proxy the traffic takes | `echo $HTTPS_PROXY $NO_PROXY` |
| 3 | TLS termination | Whether traffic is intercepted | certificate issuer (below) |
| 4 | Policy | Which hosts, paths, and operations are permitted | presence of `X-Github-Request-Id` |
| 5 | Credential | Which identity, with which permissions | `X-Oauth-Scopes` header |

## Layer 1: DNS

Confirm the hostname resolves to a real GitHub address.

```bash
getent hosts api.github.com     # expect a public GitHub IP
```

This layer is rarely the problem.
When it is, everything fails uniformly, which is itself a useful signal: **selective**
failure means the problem is layer 3, 4, or 5.

## Layer 2: Route

Two variables, and only two, decide where a request goes:

- `HTTPS_PROXY` — the proxy to send traffic through.
- `NO_PROXY` — the hosts that bypass it.

Note what is **not** here.
`GH_HOST` selects *which GitHub* (github.com versus an Enterprise host); it does not
select a network route, and setting it to `github.com` changes nothing, because that is
already the default.
There is no variable that configures REST and GraphQL separately — one token and one
host setting drive both.

Never unset `HTTPS_PROXY`, add hosts to `NO_PROXY` to dodge a refusal, or disable TLS
verification. Beyond being disallowed in most sandboxes, it usually does not even work:
environments commonly run a second enforcement point upstream of the container, so
bypassing the local hop still lands in the same policy.
You can detect that second point — see the note at the end of layer 3.

## Layer 3: TLS termination

This is the most informative test and the most often skipped.
Inspect who signed the certificate:

```bash
curl -sS -o /dev/null -v https://api.github.com/ 2>&1 | grep -i 'issuer:'
```

- Issuer is a public CA (DigiCert, Let’s Encrypt) → traffic reaches GitHub directly.
- Issuer is your platform’s CA → the connection is **intercepted**. TLS terminates at a
  proxy that decrypts, applies policy, and re-originates to GitHub.

Interception is normal and expected in sandboxes; it is how policy gets enforced.
It is not evidence of a fault.
What matters is knowing it is happening, because an intercepting proxy can answer a
request **without ever contacting GitHub** — which is layer 4.

Two refinements worth knowing:

- **Interception is per-host.** In the same session, `api.github.com` may present a
  proxy-signed certificate while `raw.githubusercontent.com` presents GitHub’s genuine
  one. Test the exact host you care about; do not generalize from one to another.
- **Two proxies may be in play.** If a host listed in `NO_PROXY` *still* returns a
  platform-signed certificate, there is an upstream gateway the container cannot opt out
  of. That is the definitive proof that editing `NO_PROXY` cannot reach GitHub directly.

## Layer 4: Policy

An intercepting proxy can allow one path and refuse another on the same host.
Distinguish “GitHub refused this” from “the proxy refused this without asking GitHub”:

```bash
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/OWNER/REPO
```

**Every genuine GitHub response carries `X-Github-Request-Id`** (and
`Server: github.com`).

- Response has those headers → GitHub answered.
  A 403 here is a real permissions result; look at layer 5.
- Response lacks them, and the body is JSON pointing at your platform’s documentation →
  the proxy synthesized it.
  The request never left.
  **No token, scope, or `gh` version changes this outcome.**

Policy typically restricts along four axes, independently:

1. **Repository scope** — the session is bound to specific repos; others return 403
   regardless of what the credential can do.
2. **API surface** — GraphQL may be restricted while REST is permitted (see the trap
   below).
3. **Operation class** — creating releases, deleting branches, or editing settings may
   be prohibited by session type even where reads succeed.
4. **Ref type** — pushing branches may be allowed while pushing **tags** is refused.

A synthesized 403 is a platform configuration fact.
Report it and switch to a supported path; do not retry it, and do not route around it.

## Layer 5: Credential

Identify what the token actually is:

```bash
curl -sSI -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user \
  | grep -iE 'x-oauth-scopes|token-expiration|x-ratelimit-limit'
```

- **Classic PAT** — `X-Oauth-Scopes` lists scopes (`repo`, `workflow`, …).
- **Fine-grained PAT** — empty scopes, with an expiration far in the future.
- **App installation token** — empty scopes, a **short** expiration (hours), and an
  elevated rate limit.
  Permissions come from the App installation, not from OAuth scopes, so there is nothing
  to widen from inside the session.

Empty `X-Oauth-Scopes` therefore does **not** mean “broken token.”
Read it together with the expiration and rate limit before drawing a conclusion.

## Traps that cause repeated misdiagnosis

- **`gh auth status` resolves identity over GraphQL.** Where GraphQL is restricted but
  REST is not, it reports *“The token in GH_TOKEN is invalid”* — a false negative about
  a perfectly good token.
  Confirm with `GH_DEBUG=api gh auth status 2>&1 | grep graphql`. **Use
  `gh api user --jq .login` as a health check instead**, and never make `gh auth status`
  the gate in a setup script.
- **`gh` subcommands quietly use GraphQL.** `gh repo view`, `gh release list`, and
  `gh pr list` are GraphQL-backed and fail where `gh api repos/{owner}/{repo}/...`
  (REST) succeeds. Reach for `gh api` with an explicit REST path when GraphQL is
  restricted.
- **`git push --dry-run` does not test authorization.** It can report success for a ref
  the server will refuse.
  Never conclude a push will work from a dry run.
- **Partial success does not generalize.** `gh api user` returning 200 says nothing
  about `/repos/*`. A successful branch push says nothing about tags.
  Test the specific operation.
- **A hook that runs a tool has not installed it.** `npx --yes <pkg> <cmd>` executes
  from a private cache and leaves no binary.
  A setup step that only primes should say so rather than report the tool as installed.

## Choosing a path for writes

When policy restricts `gh`, these usually remain available.
Prefer the first that works:

1. **Platform-provided GitHub tools (MCP or equivalent).** These reach the repository
   through a separate server-side path and often permit writes — creating PRs, merging,
   commenting — that `gh` is refused.
   In a brokered session this is the intended path.
2. **Plain `git` over HTTPS.** Branch pushes commonly succeed even where the API is
   restricted. Tag pushes commonly do not.
3. **`gh api` with explicit REST paths.** Works whenever policy permits the path, and
   avoids the GraphQL traps above.

If none is permitted, the operation must move to an environment configured for it.
Say so plainly, name the layer and the exact error, and stop — rather than retrying,
rotating credentials, or reinstalling tools that were never broken.

## Reporting a blocked operation

A useful report names the layer and quotes the evidence:

> `gh release create` returns 403 with
> `Creating, editing, or deleting releases is not permitted for this session type`. The
> response carries no `X-Github-Request-Id`, so it is synthesized by the proxy (layer 4)
> and never reached GitHub.
> `gh api user` succeeds, so the credential and network are fine.
> This needs an environment whose session type permits release creation.

That tells a human exactly what to change.
“gh isn’t working” does not.

## Related Guidelines

- For installing and authenticating the CLI, see `tbd shortcut setup-github-cli`.
- For dependency and install policy in sandboxed environments, see
  `tbd guidelines supply-chain-hardening`.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
