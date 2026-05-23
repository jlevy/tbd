---
title: Supply-Chain Hardening
description: Cross-ecosystem policy for installing dependencies safely (the 14-day cool-off, disabled install scripts, lockfile discipline, untrusted-repo handling). Use when adding/upgrading dependencies, hardening a repo or CI, auditing for compromised packages, or reviewing install/build commands across npm/pnpm, PyPI, Cargo, or Go.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Supply-Chain Hardening

A concise, cross-ecosystem policy for reducing supply-chain risk when installing or
upgrading dependencies.
Open-source registries (npm, PyPI, crates.io, Go modules) are under sustained attack:
malicious package versions are published, exfiltrate credentials or install persistence,
and are usually yanked within minutes to days.

**This is the concise policy.** For the full playbooks (per-ecosystem ten-minute setups,
a zero-dependency audit script, a curated watch list of named incidents, CI/publish-side
hardening, and the threat-model research), see the **Supply Chain Hardening guidebook**:
<https://github.com/jlevy/supply-chain-hardening>. For monorepo-specific enforcement,
see `tbd guidelines bun-monorepo-patterns` or `tbd guidelines pnpm-monorepo-patterns`.

**When to use this guideline**: before adding or upgrading any dependency; when
hardening a workstation, repo, or CI pipeline; when assessing whether an installed
package is compromised; or when reviewing any `install` / `build` / `run` command —
especially in a freshly cloned third-party repo.

## The Default: a 14-Day Cool-Off

**Never install or upgrade to a package version less than 14 days old, unless a
documented exception applies.** This is the single most effective default.
It works because registries and researchers detect and yank malicious versions while
legitimate versions keep accruing age — so the only cost of waiting is slightly staler
dependencies.

**14 days is a floor, not a ceiling.** A 30/60/90-day window is strictly safer; machines
with publish tokens or production access should go higher.
Scope: applies to `dependencies`, `devDependencies` (historically *more* dangerous —
build tooling runs with full privileges), `peer`/`optionalDependencies`, new installs,
and upgrades.
Pins resolved before adopting the policy are grandfathered until their next
planned upgrade.

### Per-ecosystem control

| Tool | 14-day control |
| --- | --- |
| npm (any) | `NPM_CONFIG_BEFORE=<now-14d>` (absolute ISO date) |
| npm 11.10+ | `NPM_CONFIG_MIN_RELEASE_AGE=14` (days) |
| pnpm 10.16–10.x | `NPM_CONFIG_MINIMUM_RELEASE_AGE=20160` (minutes) |
| pnpm 11+ | `minimumReleaseAge: 20160` in `pnpm-workspace.yaml` (pnpm 11 ignores `NPM_CONFIG_*`; env prefix is `PNPM_CONFIG_*`) |
| uv | `UV_EXCLUDE_NEWER="14 days"` |
| pip 26.1+ | `PIP_UPLOADED_PRIOR_TO="P14D"` |
| Cargo / Go | no native gate: commit the lockfile, pass `--locked` (Cargo) / keep `go.sum` + `-mod=readonly` (Go), and require human review before re-resolving; gate automated bumps with Renovate/Dependabot release-age policy |

At upgrade-decision time, `npm-check-updates --cooldown 14` (pin the `ncu` version)
gates which upgrades are even offered.
To check one version’s age: `npm view <pkg> time.<ver>`.

## The Other Install Rules

1. **Never install unthinkingly.** Before any `pnpm add` / `npm i` / `uv add` /
   `pip install` / `cargo install` / `go install`: confirm the package is needed, the
   name is spelled correctly (typosquats are common), and the version clears the
   cool-off (or is lockfile-pinned, or has a stated exception).
2. **Disable install/lifecycle scripts by default** — the primary exfiltration vector in
   worm-class attacks (`NPM_CONFIG_IGNORE_SCRIPTS=true`; pnpm `ignoreScripts: true` +
   `allowBuilds` allowlist; refuse PyPI sdist builds with
   `UV_NO_BUILD`/`PIP_ONLY_BINARY`).
3. **Commit lockfiles; install frozen.** `pnpm install --frozen-lockfile` / `npm ci` /
   `--locked`. Never auto-update without review.
4. **Audit after every install** — `pnpm audit` / `npm audit` / `pip-audit` /
   `cargo audit` / `govulncheck`; address findings before continuing.
5. **Don’t update for its own sake.** The safest update is the one you skip — each bump
   is fresh attack surface.
   Bump only for a concrete reason ("show me the commit we need"); prefer fewer,
   vendored/pinned dependencies; let audits + CVE monitoring tell you when a real update
   is warranted.
6. **No unpinned zero-install runners.** Avoid `npx` / `pnpm dlx` / `bunx` / `uvx` /
   `go run <remote>` without an explicit `@version` pin and a review of the resolved
   `package@version` — they fetch and execute the latest code, bypassing the cool-off.
   (When a skill references a CLI via a runner, pin it — see
   `tbd guidelines cli-agent-skill-patterns` §6.7.)
7. **No `curl | sh` from untrusted sources.** Verify the installer URL belongs to the
   documented project; check signatures/checksums where available.

## The Exception Process

When a version inside the 14-day window is genuinely needed (e.g. a CVE patch published
yesterday), take the exception **explicitly and on the record**:

- State the reason in the commit/PR: the CVE ID (or vulnerability description) and a
  `Reviewed-by:` sign-off.
- Pin the exact `package@version` (not a range); verify it against the authoritative
  sources (OSV, GHSA, maintainer postmortem).
- Log it, with a follow-up to confirm the version was not yanked afterward.

No exception is “trivial” — the rule exists because we don’t trust ourselves to eyeball
which fresh versions are safe.
**Agents never self-approve an exception**: prepare the record and a human signs off.

## Untrusted Repos & Modes

- **Treat any freshly-cloned third-party repo as untrusted.** Do not run
  `install`/`build`/`test`/`run`/`npx`/`uvx`/`cargo run`/`go run <remote>` against it on
  a machine with ambient credentials until you’ve reviewed it — ideally in a container
  or namespace-isolated sandbox.
  (`build.rs`, proc-macros, `require()`-time payloads, and test files all execute code.)
- **Modes**: default to **Balanced** (the policy above).
  Enter **Strict** (no upgrade without reviewing the change set; build-script allowlist
  required; mandatory sandbox; CI scanners checksum-verified) when the repo declares it,
  when the repo is untrusted, or on a machine with publish tokens / production access.
  **Emergency Exception** is a single logged per-command bypass — never self-approved by
  an agent.

## What This Does and Doesn’t Cover

A cool-off + disabled scripts neutralizes the dominant **fast-yanked-incident** pattern.
It does **not** stop: long-lived typosquats that survive past the window; a lockfile
that already captured a bad version; payloads that fire on import/build rather than
install; or **publish-pipeline compromises** (the May 2026 @antv worm shipped from
legitimate CI with a forged “verified” provenance badge — a green badge is not proof).
Those need lockfile review, typosquat checks, build-time controls, and — if you publish
packages — the publish-side controls in the guidebook’s `hardening-ci-cd.md` (OIDC
trusted publishing, staged publishing, SHA-pinned actions, runner egress limits,
provenance monitoring).

## Apply It Here (tbd)

- The repo root carries `SUPPLY-CHAIN-SECURITY.md` (the portable flag file) referenced
  from `AGENTS.md`/`CLAUDE.md`, so any agent sees the install rules before adding deps.
- tbd is a pnpm project: the 14-day rule, `ncu --cooldown 14`, and the
  `scripts/check-package-age.mjs` pre-push guard are covered in
  `tbd guidelines pnpm-monorepo-patterns` → Supply-Chain Mitigation.

## References

- **Supply Chain Hardening guidebook** (full playbooks, audit script, watch list,
  CI/publish hardening, research): <https://github.com/jlevy/supply-chain-hardening>
- Authoritative sources: [OSV.dev](https://osv.dev), GitHub Advisory DB, `npm audit` /
  `pip-audit` / `cargo audit` / `govulncheck`; incident feeds (Aikido Intel,
  StepSecurity, Socket, Unit 42).
- Monorepo enforcement: `tbd guidelines pnpm-monorepo-patterns`,
  `tbd guidelines bun-monorepo-patterns`.
