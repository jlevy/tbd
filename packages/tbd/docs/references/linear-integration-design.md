---
title: Linear Integration Design
description: How tbd's model maps onto Linear's, and why each design decision follows from a specific Linear behavior—identity, labels, the managed block, import dates, the archive lifecycle, and what a sync costs
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Linear Integration Design

This is the *why*. For connecting a repository, see the `setup-linear` shortcut; for the
config keys, see the schema.
This document exists because the same class of bug kept reaching a live workspace: every
one of them came from a Linear behavior that was known to whoever hit it and written
down nowhere a reader would find it.

Every rule below is paired with the Linear behavior that forces it.
A rule without that pairing is one somebody will “clean up” later.

## The governing idea

**The bead is the system of record.
Linear is a projection.**

Everything else follows.
A projection may be rebuilt, may lag, and may be edited by a human on the far side—but
it must never become the only place a fact lives, and it must never rewrite the history
it is projecting.

The corollary that keeps costing money if forgotten: a projection has to reach a
**steady size**. A quiet sync costs roughly `2 + N` requests for `N` mirrored pairs, so
if pairs accumulate forever, sync cost grows without bound.
Every “retire a settled pair” mechanism here is really about that.

## Identity: the UUID, never the identifier

Linear gives every issue two names: an immutable UUID, and a human identifier like
`OS-77` that is **team-scoped and mutable**. Renaming a team rewrites the identifier of
every issue in it. Moving an issue between teams renumbers it.

So the bead stores the UUID and nothing else that Linear can invalidate:

```yaml
extensions:
  linear:
    id: f53df50f-cbd8-4069-bb90-8d27b86cc51e   # the link
    linked_at: 2026-08-10T19:35:26.513Z
```

The human identifier and URL live on the **bridge record**, which every sync rewrites
and which therefore repairs itself.
They were once stored on the bead; renaming this workspace’s team from `TBD` to `OS`
left every bead carrying a stale `TBD-nnn` in a file committed to git.
The links themselves survived untouched, which is the whole argument for keeping
identity and display in different tiers.

**Rule:** anything Linear can change without tbd’s involvement belongs on the bridge
record, not the bead.

## Labels: a flat namespace with no scoping

The single most surprising Linear behavior in this integration:

> **Label names must be unique across an entire team, and a label group does not scope
> them.**

A grouped label stores only its leaf in `name`, with the group in `parent`. So
`repo/tbd` and a root label named `tbd` are a genuine collision, and Linear rejects the
second with `duplicate label name`.

That collision is why the **repository** labels carry a prefix: `repo:tbd`,
`repo:metaproc`. Repository segments are sanitized to `[a-z0-9._-]` and can never
contain a colon, so a prefixed name cannot equal a bare one—collision-proof **by
construction** rather than by luck.

Prefixing the repository side rather than the marker is deliberate.
The marker is the single most-seen label in the workspace and the one the documented
filter names, so it stays plain `tbd`; the prefix goes on the supporting detail.
An earlier shape did the reverse (`tbd` beside a `repo` group) and read worse for no
benefit.

The cost is Linear’s one-label-per-group guarantee, which the group form gave free.
It is small: tbd asserts exactly one repository label per item, so the invariant already
holds from this side, and “show me everything from any tbd repository” is what the `tbd`
marker is for.

The scheme:

| Label | Purpose |
| --- | --- |
| `tbd` | Every mirrored item. `label is not tbd` gives a human their board back |
| `repo:<name>` | Which repository, for a team several report into |
| `tbd:*` | tbd’s occasional purposeful carriers (`tbd:blocked`, `tbd:deferred`, and mirrored labels under `mirror: prefixed`) — deliberately uncommon, unlike the marker |

tbd sets a color when it *creates* one of its own labels—dark olive green for the
marker, slate for repository labels, red and amber for the blocked and deferred
carriers—and never on update.
Colour is presentation, and once a label exists it belongs to the workspace.

**Rule:** the marker is bare; everything else tbd creates is prefixed, `tbd:` for its
own carriers and `repo:` for repository identity.
No prefixed name can collide with a bare one, so none of the three can collide with each
other or with a name a human chose.

## The managed block, and markdown round-tripping

tbd owns a delimited region of each issue description and leaves the rest to humans.

The trap: **Linear rewrites markdown when it stores it.** A link written as
`[name](url)` is read back as `[name](<url>)`. CommonMark renders those identically, so
it is invisible to a person and lethal to a string comparison—the block differed from
itself on every sync, rewriting 109 of 205 issues forever.

The base description hash could never have caught it, because hashing strips the managed
block first: that region had no check at all.

Known rewrites, all normalized before any comparison:

- link destinations wrapped in angle brackets
- bare URLs and emails auto-linkified (`a@b.com` → `[a@b.com](mailto:a@b.com)`),
  including inside fenced code blocks
- list bullets normalized (`-` → `*`)
- leading indentation of one to three spaces dropped (insignificant per CommonMark; four
  or more open a code block and are preserved)
- blank-line runs collapsed, tight lists loosened

**Rule:** never compare tracker prose as a raw string.
Normalize both sides.
When a normalization changes, bump `DESCRIPTION_HASH_PREFIX` so stale hashes read as “no
recorded base” rather than faking a both-sides-changed conflict.

## Import semantics: dates belong to the bead

Linear accepts `createdAt` and `completedAt` on issue **create**—self-described as “e.g.
if importing from another system,” which is exactly what a mirror is—and accepts neither
on **update**.

That asymmetry is the correct shape, not a limitation to route around.
In steady state a bead closes and the next sync pushes the transition within minutes, so
a provider-stamped time is already honest.
The distortion is an **onboarding artifact**: backfilling an existing repository mirrors
months of history in one afternoon, and onboarding goes through create.

Getting this wrong is not cosmetic.
Linear’s auto-archive counts from `completedAt`, so a backfilled repository stamped
“today” keeps years of closed work in the active view—and, on a capped plan, in the
issue quota—for the entire archive period.
Observed live: 99 issues stamped completed within one week, including beads genuinely
closed seven months earlier.

Linear enforces three rules, and violating any fails the **whole create** rather than
dropping the field, so tbd clamps rather than trusts:

1. Both must be in the past.
   Clock skew is enough to make “now” land in the future, so anything at or after now is
   dropped.
2. `completedAt` must be after `createdAt`. A bead opened and closed in the same
   second—routine for scripted work—is nudged forward a millisecond.
3. `completedAt` requires a completed-type state.
   Only tbd’s `closed` maps to one, so any other status omits it even when the bead
   carries a `closed_at`.

**Rule:** the projection carries the bead’s dates, never the sync’s.

## The archive lifecycle, and who owns it

Archiving is how a settled pair stops costing anything: an archived issue leaves the
active view, leaves the issue quota, and stays searchable and restorable.

But **archiving is a filing decision**—it governs what a human sees in their own
views—and a repository’s automation is a poor judge of when someone is finished looking
at something. So ownership is a policy, and the default gives it to the human:

```yaml
policy:
  archive: manual    # default
```

**`manual`** — tbd never archives or unarchives.
An archived item is treated as a settled pair and the sync goes quiet on it.
A bead reopened under an archived item is **reported with the remedy**, not acted on and
not silently ignored.
Linear’s own team-level `autoArchivePeriod` keeps working underneath, which is exactly
where that policy belongs.

**`on_close`** — tbd owns the lifecycle: closing a bead archives its item, reopening
restores it. Both halves together on purpose, because an integration that archived but
never restored would strand reopened work in a tracker nobody is looking at.
Archiving runs **last** among a pair’s writes, since Linear rejects edits to an archived
issue.

Two behaviors hold under either policy:

- An archived item is **never re-created**. The bead keeps its link, so the pair is
  quiescent rather than duplicated.
- A **trashed** item is never revived.
  Linear purges trash after 30 days, so reviving one races a deletion that would strand
  the link again.

The enum rather than a boolean is the extension point: `on_close_after: <duration>` fits
here without another format bump.

## Multi-repo shape

One team, one project per repository, one flat label namespace:

```
team OS ── project tbd          ── repo:tbd         ─┐
        ├─ project metaproc     ── repo:metaproc    ─┼─ all carry `tbd`
        └─ project metabrowser  ── repo:metabrowser ─┘
```

`tbd integration setup` provisions all of it—including the **project**, because
`resolveProjectId` fails a sync outright when `target.project` names nothing, so
provisioning only labels would print success and walk the operator into a guaranteed
first-sync error.

Inbound scanning is project-scoped, so sibling repositories in the same team stay
invisible to each other rather than importing each other’s work.

## What a sync costs

A quiet sync is `2 + N` requests.
With the free tier’s 2,500/hour (the documented 5,000 applies to paid plans; the halving
is not documented) a 200-pair mirror is affordable continuously, and that arithmetic is
why the steady-size property matters.

Failures are contained rather than amplified:

- A **workspace limit** rejection halts remaining creates in the batch—it is a property
  of the workspace, so every later create is doomed identically.
- A **child of a failed parent** is skipped without an API call: its parent id names
  something that was never created.
- A partially-failed **journal is compacted** after each replay, so completed operations
  are never re-paid.

Everything parked stays journaled and converges on the first sync after the blocker
clears. Measured on a mirror halted by the free-tier cap: 405 → 146 → 50 requests per
sync.

## What tbd deliberately does not do

Each of these is a judgment about whose workspace it is:

- **Auto-provision on sync.** Creating labels restructures a shared workspace;
  `tbd integration setup` is the command you run on purpose.
- **Create shared views.** `customViewCreate` would work, but a saved view is more
  invasive than a label.
- **Set `autoArchivePeriod`.** It is team-wide and governs human-authored issues too.
  tbd reports it; a human sets it.
- **Mass-create labels from bead labels.** `mirror: none` is the default; a repository
  can carry a hundred labels and a team namespace is shared.
- **Delete anything.** Unlink severs a pair; the tracker item is left for a human.

* * *

*This document is part of the tbd documentation.
See also: the `setup-linear` shortcut for connecting a repository, and
`docs/project/specs/` for the plans this design came from.*
