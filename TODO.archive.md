# TODO archive

Completed and superseded items moved out of [TODO.md](./TODO.md), newest first.
Kept because the reasoning is often more useful than the outcome, and because several of
these were found the expensive way.

Beads hold the authoritative record: `tbd show <id>` for any id below.

## 2026-08 — Linear integration, f08 era

### Multi-repo rollout (metaproc, metabrowser, tbd into one Linear team)

Three repositories now mirror into team `OS`, each as its own project, sharing one label
group.
Wiring the second and third repositories is what surfaced most of what follows — a
single-repo integration hid all of it.

- `tbd-cuwr` — **spec permalinks named the branch that ran the sync.** Every link would
  404 once the branch was deleted after merge, and because the link sits inside the
  managed block, syncing from any other branch rewrote the entire mirror.
  Now resolves durable-trunk-first
- Project provisioning — `integration setup` provisioned labels but not the configured
  project, so it printed success and walked the operator into a guaranteed
  `Linear project not found` on the first sync
- `max_nesting` was read by the mirror and ignored by the full sync — one missing
  property at one call site, so the engine default silently overrode configuration
- Batch-failure containment — a workspace issue-limit rejection used to burn a request
  per doomed item and then replay the whole backlog on every subsequent sync.
  Measured 405 → 146 → 50 requests per sync after halting, parking dependent ops, and
  compacting partially-failed journals

### Identity, dates, and the archive lifecycle

- `tbd-3lfc` — **mirrored issues carried sync-time dates instead of the bead’s own.**
  Onboarding three repositories produced 99 issues “completed” within one week,
  including beads genuinely closed seven months earlier.
  Linear’s auto-archive counts from `completedAt`, so this also filled the issue quota.
  Fixed on the create path, which is the only surface Linear allows it on — and, not
  coincidentally, the only one where it matters
- `tbd-o0sj` — **archive ownership became a policy**, `policy.archive`, defaulting to
  `manual`. Archiving is a filing decision about what a human sees; a repository’s
  automation is a poor judge of when someone is done looking.
  `on_close` hands tbd the lifecycle, with both halves together so reopened work is
  never stranded
- `tbd-0t6r` — reopening a bead under an archived issue used to stop syncing silently,
  forever, once Linear’s default 6-month auto-archive ran.
  Now either revived (`on_close`) or reported with the remedy (`manual`)
- `tbd-ktji` — mirror-only `--push` maintained no bridge record, so it never refreshed
  identifiers. Fixed at zero request cost: the update mutation already returned them and
  the adapter was discarding them
- The tracker identifier moved off the bead entirely.
  Renaming team `TBD` → `OS` mid-session left every bead carrying a stale `TBD-nnn` in a
  file committed to git, while the UUID links survived untouched — the whole argument
  for keeping identity and display in different tiers

### Proven, not assumed

- `tbd-majw` — creating a Linear comment **does** advance the issue’s `updatedAt`
  (02:11:54 → 02:30:58 live), which was the plan’s stated precondition for the
  delta-gated comment fetch.
  Worth remembering: the issue’s `updatedAt` landed 21ms *earlier* than the comment’s
  `createdAt`, so nothing should assume the reverse ordering
- Linear enforces **label-name uniqueness across a whole team**, and a label group does
  not scope it. This is why the origin marker is `tbd:sync` rather than a bare `tbd`:
  repository label names are sanitized to `[a-z0-9._-]` and cannot contain a colon, so
  the namespaces are disjoint by construction.
  Before this, mirroring a repository named `tbd` was impossible
- **Linear rewrites markdown on store.** A link written `[a](url)` reads back
  `[a](<url>)`. Comparing the managed block as a raw string therefore found a difference
  on every sync and rewrote 109 of 205 issues forever — the third distinct write loop
  found in this feature, and the one no other check could see, because the base hash
  strips the managed block before comparing

### Test infrastructure

The recurring theme: **the mock server was kinder than Linear**, so the suite kept
blessing shapes the real API refuses.
It now models team-wide label uniqueness, markdown round-tripping, the free-issue limit,
unknown-parent rejection, create-date rules, and both archive mutations.

- `tbd-z70i` — `testTimeout` was the 5s default while `hookTimeout` was already
  Windows-aware. A git-heavy test failed CI at 5472ms and passed on rerun

### Superseded

- `tbd-zo62` — “stamp this repo to `f07` after v0.6.0 publishes.”
  Obsolete: the repository is stamped `f08`

## Earlier

Work before 2026-08 lives in bead history and in the plan specs under
[docs/project/specs/](./docs/project/specs/). `tbd list --status closed` is the full
record — 1,599 closed beads as of this writing.
