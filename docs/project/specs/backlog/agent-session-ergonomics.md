# Plan Spec: Agent Session Ergonomics — Upgrade Discovery and gh CLI Streamlining

**Status:** Backlog

**Date:** 2026-08-14

**Author:** Claude, from a Claude Code Cloud session on tbd 0.6.1

## Background

A Claude Code Cloud session cutting a release for a downstream repo (jlevy/softschema)
lost several hours to tbd-adjacent problems before completing.
The investigation produced doc fixes (tbd PR #219) and a downstream upgrade (softschema
#35), but three classes of issue are **code or design changes**, not documentation, and
remain open in 0.6.1.

Everything below was verified against **tbd 0.6.1 installed globally**, by running the
CLI rather than reading source.
Items already fixed in 0.6.1 are deliberately excluded — most notably the proxy-aware
`ensure-gh-cli.sh` rewrite and the `setup-github-cli` “Proxied Remote Sessions” section,
both of which are current and correct.

The root cause of the lost time was **not** any single defect.
It was that the downstream repo ran tbd 0.3.0 while its docs described 0.6.1 behavior,
and nothing anywhere surfaced the mismatch.

## Summary of Task

Three groups, roughly in value order.

### Group 1: Upgrade discovery

Nothing in tbd signals that an upgrade is available or needed.
Verified on 0.6.1:

| Probe | Result |
| --- | --- |
| `tbd doctor` version-drift checks | 0 — reported “Repository is healthy” while the repo was pinned three minors back |
| `tbd status` update notices | 0 |
| `tbd upgrade` command | none (`update` operates on issues) |

The situation is self-perpetuating: `tbd-session.sh` runs `npx --yes get-tbd@<pinned>`,
so a repo set up on 0.3.0 keeps running 0.3.0 indefinitely and cannot notice otherwise.
The pin is a deliberate supply-chain and consistency control and should stay; what is
missing is a signal alongside it.

Proposed, in value order:

1. **`doctor` compares `.tbd/config.yml:tbd_version` against the running CLI** and
   reports drift as a finding.
   Highest value item in this spec: it alone would have collapsed the investigation into
   one line.
2. **The session hook prints a notice when the pinned version trails latest** — still
   executing the pin, e.g.
   `[tbd] pinned 0.3.0, latest 0.6.1 — run 'tbd setup --auto' to upgrade`.
3. **`setup --auto` reports the version transition.** It currently prints
   `tbd_format f06 → f07` but never `tbd 0.3.0 → 0.6.1`, which is the more consequential
   fact.
4. **Point at the changelog after a multi-minor jump**, since generated *behavior* can
   change materially (the gh diagnosis rewrite did) with nothing prompting a re-read.
5. **Distinguish tracked from cached changes in `setup --auto` output.** The upgrade
   touched 11 committed files plus 45 gitignored cache docs; it flagged the config for
   committing but not the scripts, leaving the agent to run `git status` to find out.
6. **Stamp generated scripts with the tbd version that wrote them**, making drift
   visible in the file and giving item 1 something cheap to compare against.

### Group 2: `tbd-session.sh` leaves no CLI on PATH

Verified unchanged in 0.6.1. The fallback runs `npx --yes get-tbd@<pinned> prime`, which
executes from a private npx cache and discards it.
The banner still reads `✓ tbd installed (v0.6.1)`, so an agent believes `tbd` is
available when it is not — and on an ephemeral container it never is.
Confirmed by finding the package in `~/.npm/_npx/<hash>/` with nothing in global
`node_modules`.

Proposed: the fallback runs `npm install -g get-tbd@<pinned>` (pin preserved, so the
supply-chain property holds), then primes.
If the install is refused — read-only prefix, no permissions — fall back to npx priming
*with a warning* that the CLI will not persist.
The current silence is the defect, more than the missing install.

### Group 3: gh recipe requires manual per-command prefixing

`setup-github-cli` documents a verified `NO_PROXY` recipe for reaching GitHub on the
direct channel, and concedes that agent harnesses reset shell state between tool calls,
so every `gh` invocation must be prefixed with two long assignments.
Verified on 0.6.1:

| Probe | Result |
| --- | --- |
| Does `ensure-gh-cli.sh` apply the recipe? | No — 0 `export`/`eval` of `NO_PROXY`; it prints instructions |
| Does it write machine-readable state? | No |
| Does the shortcut still require manual prefixing? | Yes, in 2 places |

Printing instructions is correct advice that fails in practice.
An agent makes dozens of `gh` calls across a session and will not reliably prefix every
one, especially after a context compaction drops the instruction.
In this session the recipe was rediscovered late, long after the relevant guidance had
scrolled away.

Proposed:

1. **Install a wrapper when — and only when — the probe proves the direct channel
   works.** Write `~/.local/bin/gh` as a shim that `exec`s the real binary with
   `NO_PROXY` preset. Every `gh` call then works with nothing to remember and no
   per-command state. Brokered environments, where the probe fails, are unaffected.

2. **Record the resolved access plane once, in a machine-readable file** both agents and
   later scripts can read, rather than re-deriving it per command:

   ```
   GH_ACCESS_PLANE=direct | direct-via-noproxy | brokered | unauthenticated
   GH_LOGIN=<login>
   GH_DIRECT_HOSTS=<list>      # only when plane is direct-via-noproxy
   ```

3. **Emit exactly one verdict line** matching that state.
   Today the two SessionStart hooks have different output contracts — `ensure-gh-cli.sh`
   installs, verifies, and fails loudly, while `tbd-session.sh` primes and exits 0
   regardless — and a `WARNING` for a working token trains readers to ignore warnings.

## Design Notes

- **Keep every version pin.** Groups 1 and 2 both preserve pinning; the ask is a
  *signal* next to the pin, not the removal of it.
- **The wrapper must be conditional.** Installing it unconditionally would mask a
  genuinely brokered session and produce confusing failures.
  Gate it on the documented egress probe.
- **Generated files are regenerated.** `.claude/scripts/*` and `.codex/*` come from
  templates in `setup.ts` / `docs/install/`, so downstream edits are overwritten by
  `tbd setup --auto`. All of this must land upstream.

## Out of Scope

Already correct in 0.6.1 and requiring no change:

- The proxy-aware `ensure-gh-cli.sh` (pinned + checksummed install, scoped-`NO_PROXY`
  download retry, direct-channel auth retest, three-way diagnosis).
- The `setup-github-cli` “Proxied Remote Sessions” section, including the egress
  decision rule, the channel breakdown, the verified recipe, and 403 diagnosis.
- The documentation gaps closed by PR #219 (git-broker implementations, per-host TLS
  interception and tier identification, the agent-harness refusal layer).

## Validation

Each group should be exercised the way it fails in practice, not only unit tested:

1. **Group 1** — set a repo’s `tbd_version` behind the installed CLI and confirm
   `doctor` reports drift and the hook prints the notice.
2. **Group 2** — run the session hook on a container with no global tbd and confirm
   `tbd` is callable afterward, or that the warning fires when the install is refused.
3. **Group 3** — run in both an egress-open and a brokered session; confirm the wrapper
   is installed only in the former, that `gh` works unprefixed there, and that the state
   file and single verdict line match reality in both.
