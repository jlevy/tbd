---
title: f08 Release Rollout
description: How the f08 format upgrade ships as get-tbd 0.7.0, what it breaks for whom, and the order of operations that keeps agent sessions working through the cut
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Release Rollout: f08 (get-tbd 0.7.0)

**Date:** 2026-08-15

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Proposed.
Phase 1 and Phase 2 of
[plan-2026-08-14-external-sync-and-traceability.md](./plan-2026-08-14-external-sync-and-traceability.md)
are implemented; this plans the cut.

**Governs:** the release described by [docs/publishing.md](../../publishing.md), which
owns the mechanics.
This document owns only what is specific to shipping a *format* bump.

## Why this needs its own plan

Most releases are a version number.
This one changes a number that every client in the world compares against before it will
touch the repository, and the file carrying that number is **committed**. So the blast
radius is not “users who upgrade” — it is “everyone sharing a repository with the first
person who upgrades.”

That is the intended design.
`f08` exists because the bead schema parsed in strip mode, which meant an older client
silently deleted metadata from every bead it touched.
Failing closed is strictly better than that.
But it makes the release a coordination event, and the ordering below is what keeps it
from stranding anyone.

## What ships

| Area | Change | User-visible |
| --- | --- | --- |
| Bead schema | Unknown keys preserved through parse, merge, and change detection | No, until something writes one |
| Bead schema | `docs` and `refs` lists | `tbd doc add\|rm`, `tbd ref add\|rm` |
| Merge | `union_by_key` on `docs`.`path` and `refs`.`url` | Concurrent adds both survive |
| Config | Provider block regrouped into `target` / `policy` / `labels` / `identity` | Config file changes shape on first run |
| Config | `select` and the flat provider keys retire into their groups | Old spellings still read |
| Format | `f07` → `f08` | **Pre-0.7.0 clients refuse the repository** |
| Doctor | Warns when the launcher’s fallback pin cannot read the repo format | New warning |

Not in this release, by design: Phase 3 (Linear projection — `repoUrl`/`prUrls` wiring,
managed-block roll-up, origin labels, inbound selectors) and Phase 4 (enforcement
gates). Those are additive to `f08` and need no further format work, which is the whole
point of doing the schema bump once.

## Version

**0.6.5 → 0.7.0**, minor.

`docs/publishing.md` reserves minor for “new CLI capabilities or behavior users program
against”. Four new commands and a format gate qualify.
It also matches the `introduced: '0.7.0'` stamp already recorded in
`FORMAT_HISTORY.f08`, which is not decoration — `supportedFormatForVersion` derives the
compatibility table from those stamps, so the published version must equal the stamp or
the doctor check misreports.

## The one genuine trap, and the fix

**A format bump does not refresh `tbd_fallback_version`.** Only `tbd setup` does.

The generated launcher (`.claude/scripts/tbd-session.sh`) prefers a local tbd, and when
that local CLI cannot read the repository’s format it installs the exact
`tbd_fallback_version` recorded in config.
After an f08 migration that pin still names a pre-f08 version — in this repository,
`0.6.3`. The fallback would therefore *deterministically install a CLI that refuses the
repository*, which is precisely the job it exists to prevent.
Measured here after migrating:

```
⚠ Launcher fallback - tbd_fallback_version 0.6.3 cannot read format f08
    Run: tbd setup --auto
```

It fails closed rather than corrupting anything, and the message names the remedy, so
this is a warning and not a blocker.
But it would hit every agent session in a repository whose humans upgraded and whose CI
or containers did not.

**Consequence for the release: `tbd setup --auto` is a required upgrade step, not an
optional one.** It must appear in the release notes above the fold, not in a footnote.

## Order of operations

1. **Publish 0.7.0 first, upgrade repositories second.** The reverse strands anyone
   whose launcher needs the registry fallback, because the version their config points
   at does not exist yet.
2. **Upgrade this repository last among the ones you own.** It is the most
   agent-trafficked and the easiest to observe.
3. In each repository, after upgrading: `tbd setup --auto`, then `tbd doctor`. The
   launcher-fallback warning is the check that the pin caught up.
4. Commit `.tbd/config.yml` promptly.
   A migrated-but-uncommitted config means every teammate re-runs the migration locally
   and sees a dirty file.

## Rollback

Per the `f08` migration entry, and unchanged from `f05`/`f07`:

```bash
git checkout .tbd/config.yml
rm "$(git rev-parse --git-common-dir)/tbd/layout.yml"   # regenerates from config
```

No issue file is rewritten by the migration, so there is nothing to undo on the bead
side. That is deliberate: the bump exists to stop old clients touching beads, not to
change them.

The one thing rollback cannot undo is a bead that has since gained a `docs` or `refs`
entry.
A pre-f08 client would strip those — which is the original bug, and the reason the
gate is there.

## Release checklist

Beyond the standard steps in `docs/publishing.md`:

- [ ] Open the release bead for 0.7.0 (publishing.md Step 0 requires one train, one
  bead)
- [ ] `pnpm precommit` green on the merge commit — **and `pnpm test:coverage`**, which
  is the only thing that runs the `tryscript` golden CLI tests.
  `precommit` is vitest-only, so a change to any CLI output passes locally and fails in
  the Coverage & Lint job.
  This bit once already: the f08 bump moved ten golden cases across six files
- [ ] Update the two goldens that this release *un*-breaks.
  Once the tagged version supports f08, `tbd_fallback_version` names a build that can
  read the repository, so the doctor’s `Launcher fallback` warning disappears from
  `cli-orientation-golden.tryscript.md`. In the same way, `validate-upgrade-package.mjs`
  regains a genuine same-format baseline: add 0.7.0 as the `expectOldClientToWork: true`
  scenario, which no published version can be today
- [ ] Confirm `FORMAT_HISTORY.f08.introduced` equals the version being tagged
- [ ] Migrate a scratch clone from `f07` and confirm: config regroups with no key left
  in both spellings, `tbd doctor` warns about the fallback pin, `tbd setup --auto`
  clears it
- [ ] Confirm a 0.6.x client refuses an f08 repository with the upgrade message
- [ ] Release notes lead with the two operational facts: pre-0.7.0 clients stop working
  against upgraded repositories, and `tbd setup --auto` is required after upgrading
- [ ] Release notes state that the config file changes shape and that the change is
  mechanical, lossless, and idempotent

## Known behavior worth stating in the notes

**The migrated config is more verbose.** Folding `select` into `policy.outbound` creates
an explicit `policy`, and the schema then materializes `inbound` and `field_sync` with
their defaults. The file gains roughly twenty lines and now states its effective policy
outright.

This is a real trade.
The upside is that the policy is legible and editable where it was previously implicit.
The downside is that those defaults are now frozen in the file, so a future change to a
default will not reach this repository.
That is worth one line in the notes so nobody discovers it by surprise, and it is the
argument for keeping preset names (`policy: default`) rather than inline definitions
where a repository has no strong opinion.
