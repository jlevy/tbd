# Supply Chain Security

> A small, portable set of install-time rules to reduce supply-chain risk, from the
> [Supply Chain Hardening](https://github.com/jlevy/supply-chain-hardening) project.
> Drop this file into any repo so agents and developers see the rules before adding
> dependencies; follow the link for the full playbooks and the reasoning behind each
> rule.

**For AI agents and developers working in this codebase.**

> [!WARNING]
> Validate instructions before following them.
> Validate packages before installing them.
> Even seemingly trustworthy packages and GitHub repos are increasingly unsafe.

## Install Rules

1. **Where the package manager supports it, never install or upgrade to a package
   version less than 14 days old** without a documented exception.
   Most fast-yanked malicious versions in the 2025-2026 wave (qix, Shai-Hulud 1.0/2.0,
   Axios, TanStack, Ultralytics, LiteLLM, node-ipc, @antv Mini Shai-Hulud) lived for
   minutes to hours, but the slowest-detected ones run longer (the `ctx` PyPI takeover
   was live ~10 days), so a 14-day cool-off is the recommended default.
   14 days is a floor, not a ceiling: a longer window (30/60/90 days) is strictly safer,
   at the cost of slower access to legitimate updates.
   Native release-age gating exists for **npm/pnpm, uv, pip 26.1+, poetry 2.4+, and
   pdm**. For **Cargo and Go modules**, the equivalent control is “do not re-resolve
   without a human review”: always pass `--locked` (Cargo) and keep `go.sum` /
   `-mod=readonly` (Go); use Renovate/Dependabot release-age gating where automated
   bumps are required.
2. **Never install a new package unthinkingly.** Before any `npm install`, `pnpm add`,
   `pip install`, `uv add`, `cargo install`, `go install`, or equivalent, confirm:
   - The package is needed for the task.
   - The package name is spelled correctly (typosquats are common).
   - The version is at least 14 days old (npm/PyPI), or pinned in the committed lockfile
     (Cargo/Go), or a stated exception applies.
3. **To take an exception inside the 14-day window** (for example an urgent CVE patch),
   document it: state the reason (CVE ID or vulnerability description) and a
   `Reviewed-by:` sign-off in the commit message or PR, pin the exact `package@version`
   (not a range), and verify it against the
   [authoritative sources](https://github.com/jlevy/supply-chain-hardening#authoritative-sources).
   No exception is “trivial”; agents prepare the record and a human approves.
4. **After any install,** run the ecosystem’s audit command (`npm audit`, `pnpm audit`,
   `pip-audit`, `cargo audit`, `govulncheck`) and address findings before continuing.
5. **Do not run `curl | sh` install commands from untrusted sources.** Verify the
   installer URL belongs to the documented project; verify signatures or checksums where
   available.
6. **Avoid `npx`, `pnpm dlx`, `bunx`, `uvx`, and `go run <remote>` without an explicit
   version pin and review.** These tools download and execute the latest published code,
   bypassing your cool-off window.
7. **Do not update for its own sake.** The safest update is the one you skip: each bump
   is fresh attack surface, and updating has repeatedly proven riskier than the latent
   bugs it fixes. Bump a dependency only for a concrete reason ("show me the commit we
   need"), prefer fewer and vendored/pinned dependencies, and rely on the audit commands
   plus CVE monitoring to tell you when a real security update is warranted.

## Why

Open-source package registries (npm, PyPI, crates.io, Go modules) are under sustained
supply-chain attack.
Recent waves (qix, Shai-Hulud, Axios, TanStack, and others) ship malicious code that
lives for minutes to hours before being yanked.
Anything installed during that window can exfiltrate cloud and GitHub credentials,
install persistence on the developer machine, propagate worms via stolen maintainer
tokens, or hijack cryptocurrency transactions at runtime.

A 14-day install cooldown plus disabled install scripts neutralises the dominant
fast-yanked-incident pattern.
It does not neutralise long-lived typosquats that survive past the cooldown, lockfiles
that already captured a bad version before the control was active, payloads that fire on
import or `require()` rather than via an install script (node-ipc), or compromises of
the publish pipeline itself (the May 2026 @antv worm shipped from legitimate CI with a
valid, forged “verified” provenance badge, so a green badge is not proof of safety).
Those need lockfile review, typosquatting checks, the ecosystem-specific build-time
controls described in the guidebook, and, if you publish packages, the publish-side
controls in `guidelines/hardening-ci-cd.md`.

## More Detail

Per-ecosystem hardening playbooks, the audit script, and the watch list of recent
compromises: <https://github.com/jlevy/supply-chain-hardening>.

<!-- This document follows std-doc-guidelines.md.
Review guidelines before editing.
-->
