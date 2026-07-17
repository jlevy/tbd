---
title: Supply-Chain Hardening
description: Strongly recommended for EVERY repo—apply it if a repo has not been hardened yet. Cross-ecosystem policy for installing dependencies safely (the 14-day cool-off, disabled install scripts, lockfile discipline, untrusted-repo handling). Use whenever a user mentions hardening, security, supply chain, or setting up a new repo; before adding/upgrading dependencies; when auditing for compromised packages; or when reviewing install/build/run commands across npm/pnpm, PyPI, Cargo, or Go.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Supply-Chain Hardening

A concise, cross-ecosystem policy for reducing supply-chain risk when installing or
upgrading dependencies.
Open-source registries (npm, PyPI, crates.io, Go modules) are under sustained attack:
malicious package versions are published, exfiltrate credentials or install persistence,
and are usually yanked within minutes to days.

**Strongly recommended for every repo.** If a project has not been hardened yet, apply
this policy (and the per-ecosystem playbooks it links) as part of setup—it is especially
worth doing when standing up a new repo or whenever security comes up.

**This is the concise policy.** For the full playbooks (per-ecosystem ten-minute setups,
a zero-dependency audit script, a curated watch list of named incidents, CI/publish-side
hardening, and the threat-model research), see the **Supply Chain Hardening guidebook**:
<https://github.com/jlevy/supply-chain-hardening>. For monorepo-specific enforcement,
see `tbd guidelines bun-monorepo-patterns` or `tbd guidelines pnpm-monorepo-patterns`.

**When to use this guideline**: before adding or upgrading any dependency; when
hardening a workstation, repo, or CI pipeline; when assessing whether an installed
package is compromised; or when reviewing any `install` / `build` / `run`
command—especially in a freshly cloned third-party repo.

## The Default: A 14-Day Cool-Off

**Never install or upgrade to a package version less than 14 days old, unless a
documented exception applies.** This is the single most effective default.
It works because registries and researchers detect and yank malicious versions while
legitimate versions keep accruing age—so the only cost of waiting is slightly staler
dependencies.

**14 days is a floor, not a ceiling.** A 30/60/90-day window is strictly safer; machines
with publish tokens or production access should go higher.
Scope: applies to `dependencies`, `devDependencies` (historically *more* dangerous—build
tooling runs with full privileges), `peer`/`optionalDependencies`, new installs, and
upgrades. Pins resolved before adopting the policy are grandfathered until their next
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
| Cargo / Go | no native gate: commit the lockfile, pass `--locked` (Cargo) / keep `go.sum` and `-mod=readonly` (Go), and require human review before re-resolving; gate automated bumps with Renovate/Dependabot release-age policy |

At upgrade-decision time, `npm-check-updates --cooldown 14` (pin the `ncu` version)
gates which upgrades are even offered.
To check one version’s age: `npm view <pkg> time.<ver>`.

## The Other Install Rules

1. **Never install unthinkingly.** Before any `pnpm add` / `npm i` / `uv add` /
   `pip install` / `cargo install` / `go install`: confirm the package is needed, the
   name is spelled correctly (typosquats are common), and the version clears the
   cool-off (or is lockfile-pinned, or has a stated exception).
2. **Disable install/lifecycle scripts by default**—the primary exfiltration vector in
   worm-class attacks (`NPM_CONFIG_IGNORE_SCRIPTS=true`; pnpm `ignoreScripts: true` +
   `allowBuilds` allowlist; refuse PyPI sdist builds with
   `UV_NO_BUILD`/`PIP_ONLY_BINARY`).
3. **Commit lockfiles; install frozen.** `pnpm install --frozen-lockfile` / `npm ci` /
   `--locked`. Never auto-update without review.
4. **Audit after every install**—`pnpm audit` / `npm audit` / `pip-audit` /
   `cargo audit` / `govulncheck`; address findings before continuing.
5. **Don’t update for its own sake.** The safest update is the one you skip—each bump is
   fresh attack surface.
   Bump only for a concrete reason ("show me the commit we need"); prefer fewer,
   vendored/pinned dependencies; let audits and CVE monitoring tell you when a real
   update is warranted.
6. **No unpinned zero-install runners.** Avoid `npx` / `pnpm dlx` / `bunx` / `uvx` /
   `go run <remote>` without an explicit `@version` pin and a review of the resolved
   `package@version`—they fetch and execute the latest code, bypassing the cool-off.
   (When a skill references a CLI via a runner, pin it—see
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

No exception is “trivial”—the rule exists because we don’t trust ourselves to eyeball
which fresh versions are safe.
**Agents never self-approve an exception**: prepare the record and a human signs off.

### Safe-override patterns (verify, then install surgically)

A release-age gate applies at **version resolution**, so `pkg@latest` (or a bare range)
silently resolves to the newest version *outside* the window—which can mean you get a
**stale** version without noticing.
(This is the dogfood case: an `~/.npmrc` `minimum-release-age` resolved
`npm i -g get-tbd@latest` to an older release because the newer one was still inside the
window.) When you genuinely need the fresh version, do not weaken the global
policy—override **surgically** for the one install, and **verify first**. The pattern is
always *verify the publisher, timestamp, and integrity → install by an exact,
resolution-bypassing reference → confirm afterwards.*

**1. Verify before fetching** (publisher identity, publish time, integrity hash):

| Ecosystem | Verify command |
| --- | --- |
| npm | `npm view <pkg>@<ver> _npmUser maintainers time.<ver> dist.integrity dist.tarball` |
| PyPI | `uv pip index versions <pkg>` and inspect the file hashes on `https://pypi.org/project/<pkg>/<ver>/#files` (or `pip download --no-deps --no-binary :all:` then check the hash) |
| Cargo | `cargo info <pkg>@<ver>` (owners, published-at); crates.io is immutable + checksummed in `Cargo.lock` |
| Go | `go list -m -json <module>@<ver>` (the proxy returns the checksum DB entry) |

For a package **you maintain** (the dogfood case), the strongest check is that the
published artifact matches the git tag—confirm the commit/tag and, where the registry
supports provenance/attestations (npm `--provenance`), that it was built from that
source.

**2. Install by an exact reference that bypasses version resolution**, so the gate does
not silently re-resolve:

```bash
# npm — direct tarball URL (verified in step 1); skips before/min-release-age resolution
npm install -g https://registry.npmjs.org/<pkg>/-/<pkg>-X.Y.Z.tgz

# npm — git ref (strongest for packages you maintain: the source is auditable)
npm install -g git+https://github.com/<org>/<repo>#vX.Y.Z

# uv / pip — pin exact, with the hash recorded; --exclude-newer override is per-invocation
uv pip install "<pkg>==X.Y.Z" --exclude-newer "$(date -u +%Y-%m-%d)"   # one-shot, not global

# cargo / go — pin exact in the manifest; the committed lockfile/sum carries the checksum
cargo add <pkg>@=X.Y.Z       # then `cargo build --locked`
go get <module>@vX.Y.Z       # then `go mod verify`
```

A tarball-URL or git-ref install is the cleanest npm override because it never consults
`before` / `minimum-release-age` at all (those apply only to range resolution), so you
do not touch global config or env.
The uv/cargo/go forms pin an exact version rather than bypassing a gate, since those
ecosystems gate at the lockfile rather than at resolution.

**3. Keep it surgical and on the record.** The override must affect **one install**, not
global `~/.npmrc` / env / CI config; carry the same commit/PR record as any exception
(reason, exact `pkg@version`, the verification output); and **confirm afterwards** that
the version was not subsequently yanked.
Never relax the global cool-off to get one fresh package—that re-exposes every install.

## Node / TypeScript Enforcement (npm, pnpm, Bun)

The hands-on controls for the rules above in the Node ecosystem.
Applies to **any** repo, not just new monorepos—drop these into an existing project.

**Lifecycle-script hygiene (the highest-value control).** Block install/build scripts by
default and allowlist only what you trust:

- **pnpm 11**: declare allowed packages in `pnpm-workspace.yaml`; keep
  `blockExoticSubdeps` on.
  Everything else installs with no `postinstall`/`preinstall`.
  ```yaml
  # pnpm-workspace.yaml
  minimumReleaseAge: 20160 # 14 days in minutes (pnpm 11 default is 1440 = 1 day)
  allowBuilds:
    - esbuild
    - sharp
  ```
- **Bun**: blocks lifecycle scripts by default via an internal allowlist; extend it with
  `trustedDependencies` in `package.json`. Bun has **no native release-age gate** yet,
  so enforce the cool-off at the upgrade-tool layer (below).
  ```json
  { "trustedDependencies": ["esbuild", "sharp"] }
  ```
- **npm**: `NPM_CONFIG_IGNORE_SCRIPTS=true` (or `.npmrc` `ignore-scripts=true`).

**Release-age gate** (resolution time): pnpm `minimumReleaseAge` (above); npm
`NPM_CONFIG_BEFORE` / `NPM_CONFIG_MIN_RELEASE_AGE` (npm 11.10+); Bun none.

**Upgrade-time check** (complements resolution-time gating): `npm-check-updates`
`--cooldown` works on npm/pnpm/Bun/yarn projects.
Pin the `ncu` version.

```bash
pnpm dlx npm-check-updates@<ver> --cooldown 14                 # or: bunx / npx
pnpm dlx npm-check-updates@<ver> --cooldown 14 --errorLevel 2  # CI: non-zero if fresh upgrades exist
npm view <pkg> time.<version>                                  # one version's publish time; if < 14d, wait
```

**Lockfile discipline**: always commit the lockfile (`pnpm-lock.yaml` / `bun.lock` /
`package-lock.json`); install frozen in CI (`pnpm install --frozen-lockfile` /
`bun install --frozen-lockfile` / `npm ci`); never `pnpm update` / `bun update` without
reviewing the lockfile diff like a code diff.
One root lockfile in a monorepo.

**Provenance**: prefer deps that publish
[npm provenance attestations](https://docs.npmjs.com/generating-provenance-statements)
(TypeScript, Vitest, Prettier, ESLint do).
Run `pnpm audit signatures` / `npm audit signatures` periodically.
A provenance badge is necessary, not sufficient—the @antv worm forged one.

**CI audit gate** (alongside lint/test):

```yaml
audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - run: pnpm install --frozen-lockfile # or: bun install --frozen-lockfile / npm ci
    - run: pnpm audit --audit-level=moderate # or: bun audit / npm audit
    - run: pnpm audit signatures # provenance check where supported
    - run: pnpm dlx npm-check-updates@<ver> --cooldown 14 --errorLevel 0
      # errorLevel 0 logs but doesn't fail — flip to 2 once the backlog is cleared
```

**Pre-push age guard**—a zero-dependency Node script wired into lefthook/husky:

```ts
#!/usr/bin/env tsx
// Fails if any direct dependency was published < 14 days ago.
import pkg from '../package.json' with { type: 'json' };
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const now = Date.now();
let violations = 0;
for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
  const version = String(spec).replace(/^[\^~=<>]+/, '');
  const meta = await (await fetch(`https://registry.npmjs.org/${name}`)).json();
  const publishedAt = meta.time?.[version];
  if (!publishedAt) continue;
  if (now - new Date(publishedAt).getTime() < COOLDOWN_MS) {
    console.error(`✗ ${name}@${version} is < 14 days old`);
    violations++;
  }
}
process.exit(violations > 0 ? 1 : 0);
```

**Exception bookkeeping**: when you pin a fresh version under the exception process,
leave a marker next to the pin (JSONC comment in `package.json`, or a `CHANGELOG.md`
note for strict JSON parsers):
`// Exception: CVE-2026-XXXX patch within 14d window. Reviewed <date>.`

## Untrusted Repos and Modes

- **Treat any freshly-cloned third-party repo as untrusted.** Do not run
  `install`/`build`/`test`/`run`/`npx`/`uvx`/`cargo run`/`go run <remote>` against it on
  a machine with ambient credentials until you’ve reviewed it—ideally in a container or
  namespace-isolated sandbox.
  (`build.rs`, proc-macros, `require()`-time payloads, and test files all execute code.)
- **Modes**: default to **Balanced** (the policy above).
  Enter **Strict** (no upgrade without reviewing the change set; build-script allowlist
  required; mandatory sandbox; CI scanners checksum-verified) when the repo declares it,
  when the repo is untrusted, or on a machine with publish tokens / production access.
  **Emergency Exception** is a single logged per-command bypass—never self-approved by
  an agent.

## What This Does and Doesn’t Cover

A cool-off plus disabled scripts neutralizes the dominant **fast-yanked-incident**
pattern. It does **not** stop: long-lived typosquats that survive past the window; a
lockfile that already captured a bad version; payloads that fire on import/build rather
than install; or **publish-pipeline compromises** (the May 2026 @antv worm shipped from
legitimate CI with a forged “verified” provenance badge—a green badge is not proof).
Those need lockfile review, typosquat checks, build-time controls, and—if you publish
packages—the publish-side controls in the guidebook’s `hardening-ci-cd.md` (OIDC trusted
publishing, staged publishing, SHA-pinned actions, runner egress limits, provenance
monitoring).

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

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
