---
title: 'Senior Review: PR #169 — Forkable Docs (f05) Spec and Kernel'
description: Adversarial senior engineering review of PR #169, plus a holistic docs review, analysis of the fork/export and doc-map-vs-search-path design questions, and a deep review of the DocRef and DocMap abstractions
author: Review session operated by Joshua Levy with LLM assistance
---
# Senior Review: PR #169 — Forkable Docs (f05) Spec and Kernel

**PR:** https://github.com/jlevy/tbd/pull/169 (branch `claude/friendly-lamport-ojs6zm`)

**Reviewed commit:** `25bc008`

**Date:** 2026-06-12

**Scope:** (1) adversarial senior review of the spec and the shipped code; (2) holistic
review of documentation state across the new surface area; (3) analysis of two open
design questions — copy-all-plus-gitignore vs export-only forking, and doc-map registry
vs search-path resolution; (4) deep review of the DocRef and DocMap abstractions.

All critical findings were verified empirically against the CLI built from this branch
(`pnpm build`, fresh sandbox repo), not just by code reading.

## 1. PR Review

**CI:** all 5 checks green (ubuntu/macos/windows tests, benchmark, coverage+lint).
DeepSource grade A. No unresolved human review comments (only bot comments).
Unit coverage of the new core modules is 89–97%; the new CLI layer is ~3% under vitest
but covered by tryscripts — **which CI runs only on ubuntu** (`ci.yml` matrix runs
`vitest run` per-OS; tryscripts only run inside the ubuntu Coverage & Lint job).

**Summary:** The spec is genuinely strong — the doc model in `tbd-design.md` §2.9
(copies table, seven invariants, derived-not-stored state) is the best artifact in the
PR, and the merge/update design (stored bases, decision table, version-skew guard) is
sound and exhaustively unit-tested (129 tests, verified locally).
**Scope note (settled during review):** this PR is committed to being the complete, full
f05 experience and will ship as the next release — there is no separate shipping step.
The spec’s phases therefore serve as the strict validation checklist for driving this
branch to done (finding 4 audits the branch against them).
Within that frame, there are two user-facing bugs (verified end-to-end against the built
CLI) plus one data-clobbering edge case that are release blockers.

### Critical findings (verified empirically)

**1. Forked shortcuts are never served — the feature’s core promise (G2) is broken for
one of three kinds.** `doc-sync.ts:561–566` persists `docs_cache.lookup_path` into
**every** repo’s config on setup (verified in a fresh sandbox repo).
`shortcut.ts:78` then does `config.docs_cache?.lookup_path ?? DEFAULT_SHORTCUT_PATHS` —
the persisted key wins, and it contains only cache paths.
Result, reproduced with the built PR CLI: fork `review-code`, edit it, and
`tbd docs list` shows `[forked, customized]` while `tbd shortcut review-code` serves the
**upstream** copy. Guidelines and templates work because they don’t honor `lookup_path`.
This is precisely the “lookup_path zombie” the spec itself cites as a lesson, and it
falsifies §2.9 invariant 1 as written.
The tryscripts miss it because they only fork a guideline.
Fix: prepend the fork dir structurally in `shortcut.ts` regardless of config
(`[FORK_SHORTCUTS_DIR, ...(lookup_path ?? CACHE_SHORTCUT_PATHS)]`), and add a
fork-a-shortcut serve assertion to the tryscript.

**2. The CLI recommends a flag that doesn’t exist — and the golden test pins it as
correct.** `docs-fork.ts:357` (zero-fork `tbd docs status`) prints
`Make some visible: tbd docs fork --category=general (and your languages)`. `--category`
is a Phase 4 feature; running the suggested command errors with
`unknown option '--category=general'` (verified).
`cli-docs-fork.tryscript.md:36` golden-tests this hint, so CI enshrines a broken
recommendation that agents will follow verbatim.
Fix: either implement `--category` now (the spec says it reuses existing frontmatter
metadata, so it’s small) or change the hint to name-based forking until Phase 4.

**3. `git merge-file` error exits are misread as conflict counts → can overwrite a
customized doc with empty content.** `fork-update.ts:66–79` treats any positive exit
code as a conflict count.
Verified: `git merge-file` exits **255** on errors (e.g. binary-content refusal), and
git documents the conflict count as truncated to 127 — so exit 255 means error, not “255
conflicts”. On that path stdout is empty, `updateOne` returns `merged-conflict`, and the
handler writes **empty content** over the user’s customized fork (git-recoverable, but
still a silent clobber).
Fix: treat `code > 127` as an error; one-line guard plus a unit test.

### Major findings

**4. Phase-completion audit: the branch is partway through every phase — use the phases
as strict completion gates, and reconcile the golden maps.** This PR delivers the
complete f05 experience as the next release, so the spec’s phases are the in-PR
validation checklist rather than separate shipping steps.
Audited against the spec, the branch currently stands:

- **Phase 0 (contracts + docs):** spec contracts authored ✔; `tbd-design.md` §2.9/§4.13
  ✔; `tbd-docs.md` drift table + abort recipe ✔. Missing: the `tbd docs` command-group
  manual section, the three-sync taxonomy table and `.tbd/` layout contract in
  `tbd-docs.md`, the `docs-overview.md` and README forkable-docs rows,
  `references/docref-format.md`, `references/docmap-format.md`,
  `suggest-upstream-improvements.md`, and item 0.5 (lock golden maps against real
  output).
- **Phase 1 (format + kernel):** f05 stamp + migration ✔ (but stamp-only: no
  `.tbd/.gitignore` refresh, no generated `.tbd/README.md`, and `FORMAT_HISTORY.f05`
  omits the `docs_cache.fork_dir`/`local_dirs` keys the spec defines — finding 5);
  docref/docmap modules ✔ (but wired into nothing — see §4); fork-manifest ✔;
  fork/unfork ✔; precedence wiring ✔ for guidelines/templates, **broken for shortcuts**
  (finding 1). Missing: `tbd docs sync` subcommand, the serve provenance note (Decision
  18), per-kind `--list` markers.
- **Phase 2 (status/browse/doctor):** `status`, `list`, `diff` ✔. Missing: bare
  `tbd docs` overview (old viewer still the default action), `show`/`manual`, the shared
  docmap renderer + per-kind reader migration, `local_dirs`, `docs add <docref>`,
  grouped sync, all doctor checks, the `tbd status` Docs line.
- **Phase 3 (update/merge):** merge module + update command ✔ (with the exit-code bug,
  finding 3); pending-update reporting in setup missing; the `tbd sync` drift notice is
  a good addition not in the spec — add it there.
- **Phase 4 (categories/setup):** nothing landed yet, but `--category` is already
  recommended by shipped output (finding 2); setup Docs summary and `--interactive`
  removal pending.
- **Phase 5 (agent surface):** nothing landed (skill upgrade hints only); reference kind
  \+ self-docs, skill routing rows, `welcome-user` onboarding, and CHANGELOG pending.

Two consequences.
First, **the golden maps and the shipped output must be reconciled into
one source of truth now**, because they already disagree in a dozen places (e.g. spec:
`Updated 2 forked docs:` / impl: `Updated 1 forked doc(s):`; spec:
`1 doc is missing (forked file deleted):` / impl:
`1 doc(s) missing (forked file deleted or renamed):`; spec fork output has a
`Recorded base in .tbd/doc-forks/…` line the impl never prints; spec unfork refusal
points at `tbd docs diff`, impl points at `tbd docs status`; spec list `--json` includes
`stale` and `word_count`, impl emits neither).
Recommendation: update the spec maps to the (mostly better) shipped wording, then treat
them as binding for the remaining phases — validating each phase against its golden
block as it lands. Second, the PR title/description should state this scope (full
experience, next release) and carry the phase checklist; as of `25bc008` they still
described a spec-only PR.

**5. The f05 format definition drifts from its own spec, and a release cut now would
ship a confusing hybrid.**

- `FORMAT_HISTORY.f05` (`tbd-format.ts`) omits `docs_cache.fork_dir`, `local_dirs`, and
  the generated `.tbd/README.md` that the spec’s contract table defines as part of f05;
  the migration is stamp-only (no `.tbd/.gitignore` refresh, no `.tbd/README.md`), and
  `fork_dir` is not configurable at all — `FORK_DIR` is a hard constant
  (`paths.ts:361`), contradicting Resolved Decision 6. Additive later landing is
  probably fine, but then amend the spec so f05’s definition matches what f05 actually
  stamps.
- The old docs surface coexists with the new: `tbd docs --list` (sections) and
  `tbd docs list` (docs) both work with different meanings; the command description
  still says “use tbd sync --docs”.
  The spec’s safety argument is “everything ships in the same release behind the f05
  gate” — and since this PR is that release vehicle, the argument holds only once the
  surface re-homing lands here too.
  Concretely: #1, #2, and the disposition of all four old `tbd docs` behaviors are
  release bars for this PR.
- The config migration also reorders keys (`lookup_path` moved to the bottom of
  `docs_cache` in this repo’s own diff) — harmless but contradicts “metadata-only stamp”
  minimal-churn expectations.

**6. Windows is untested for the whole feature and has at least one real defect.**
`FORK_DIR = join(DOCS_DIR, 'tbd')` is `docs\tbd` on Windows; `forkRelPath()` then
records `docs\tbd/guidelines/x.md` (mixed separators) into the committed manifest and
CLI output. Meanwhile the unit tests use a *different* constant —
`DEFAULT_FORK_DIR = 'docs/tbd'` (POSIX literal in `doc-fork.ts:44`) — so Windows CI
green proves nothing about production paths: tests exercise a value production never
uses. And tryscripts don’t run on Windows at all.
Fix: one POSIX-string constant for repo-relative semantics (join only at fs boundaries),
delete the duplicate, and run the fork tryscripts in the OS matrix.
(Related: `docref` rejects `C:/...` as “unknown scheme” — see §4.)

### Minor findings

7. **`conflicted` never clears in the stored manifest.** After resolving markers, state
   computes correctly (flag AND markers), but the committed `forks.yml` keeps
   `conflicted: true` until some later update writes the entry (`docs-fork.ts:461–465`
   only clears when an update applies).
   Spec says “auto-clears”.
   Cosmetic but confusing in a committed file.
8. **`tbd docs update <typo>` silently reports “All forked docs are up to date”** —
   unknown names are filtered out without error (`docs-fork.ts:418–419`).
9. **Path-traversal hardening**: `unforkDoc`/`updateOne` compute fs paths from committed
   manifest `name`/`kind` without validating for separators/`..` — a hostile `forks.yml`
   in a cloned repo can direct `rm`/writes outside the fork dir.
   Validate names (no `/`, `\`, `..`) on manifest read.
10. **`pathExists` reads the whole file to test existence, then callers re-read it**
    (`doc-fork.ts:69–76`); it also swallows non-ENOENT errors.
    Use `stat`, or read once and branch on ENOENT.
11. **Fork-conflict error is not actionable** (raw “already exists and is not an
    unmodified fork”, no options) — violates the spec golden and `error-handling-rules`
    ("tell users what to do next"); contrast unfork, which does it well.
12. `tbd docs list --kind=bogus` / `fork --kind=bogus` silently produce empty results or
    a misleading “No doc found” (`KIND_CACHE_PATHS[kind] ?? []`). Validate the kind.
13. `FORK_KINDS` includes `'reference'` but `KIND_CACHE_PATHS` doesn’t — a forked
    reference doc (Phase 5) would permanently read `orphaned`. Latent trap; add a
    comment or a guard now.
14. The sync drift notice writes via `process.stderr.write` (`sync.ts` ~218), bypassing
    the output layer the spec’s style contract mandates; `update --json` returns prose
    strings in `needsDecision` rather than names.
15. `UpdateAction` includes a never-returned `'noop'` member; the update tryscript uses
    GNU-only `sed -i` (fails if run locally on macOS).
16. **Spec is behind the code in one place**: the version-skew guard (`skip-newer-base`,
    a good design addition, documented in §2.9 invariant 7) has no row in the spec’s
    update decision table.
    Add it.

### Strengths worth keeping

The derived-state design (no stored tracking ⇒ git can’t desync it) is the right call
and §2.9 articulates it precisely; the stored-base three-way merge is the correct answer
to the shadcn-has-no-update-story problem and Alternatives #5 justifies the cost
honestly; out-of-band deletion as a supported state with exactly two resolutions is
excellent UX thinking; the decision-table unit tests cover every row × strategy
including the skew guard; the abort-upgrade recipe with its state-inventory table is the
kind of operational doc most projects never write; and the drift tryscript (rename →
`missing`+`local`, prune-on-empty) tests realistic mess, not just happy paths.

## 2. Holistic Documentation Review

**Surface inventory after this PR** (maturity in parens):

| Surface | Audience | State |
| --- | --- | --- |
| `tbd-design.md` §2.9 + §4.13 | contributors/design | **Strong, new canonical doc model** |
| `tbd-docs.md` “Forked Docs in Your Repo” + “Aborting a Format Upgrade” | users | Good, but see inversion below |
| README “Upgrading” + skill-baseline upgrade hints | users/agents | Good; upgrade ergonomics now first-class |
| `development.md` format-upgrade section | contributors | Good |
| The plan spec | design | Strong but now diverges from code (§1, finding 4) |
| `docs-overview.md` | contributors | **Stale** — still describes only the old `--add` flags; its Phase 0 contract row was not executed |
| `tbd-docs.md` command reference | users | **Missing the new commands entirely** — fork/unfork/status/update/diff/list ship in this PR but are documented nowhere in the manual; discovery is `--help` only |
| `welcome-user.md`, skill routing rows, `suggest-upstream-improvements.md`, `docref-format.md`, `docmap-format.md` | agents/users | Absent (Phases 0/5 promised, not landed) |

**Code currently leads docs on this branch**: the commands exist but the manual, the
onboarding, and the agent routing don’t yet — today an agent discovers `tbd docs fork`
via `--help` and the (broken) `--category` hint with zero guidance.
Since this PR is the complete experience, the docs must catch up before release;
concretely:

1. **Re-couple agent surface to command surface.** The minimal skill routing rows ("make
   guidelines visible" → fork; “update the guidelines” → update; “I deleted a forked
   file” → status/restore/finalize) and a short `tbd-docs.md` “Managing docs” section
   are part of this PR’s release bar — a command without its routing row is invisible to
   the primary operator (agents).
2. **One first-principles “Managing docs” chapter in `tbd-docs.md`**, opening with the
   two-mode model users actually face — *hidden cache* (default: docs live in gitignored
   `.tbd/docs/`, always active, zero repo footprint) vs *forked* (tracked in
   `docs/tbd/`, visible on GitHub, editable, mergeable) — then the scope axis (all vs by
   category), then commands, then the drift table.
   The content exists today but is scattered across the spec (two-axis framing), §2.9
   (model), and tbd-docs (drift table).
   The spec’s Documentation Contract table already prescribes exactly this; execute it.
3. **Avoid the dual-drift-table trap.** The user-action table in `tbd-docs.md` and the
   drift matrix in §2.9 describe the same truths in different words for different
   audiences — fine per the ownership/audience rule, but make one canonical (suggest
   §2.9) and have the other cite it, so the next state addition doesn’t fork them.
4. **Upgrade workflow is now well covered** (README → manual troubleshooting →
   development.md → §2.9, correctly layered by audience).
   One gap: the README “Upgrading” section should add one line: “if you’ve forked docs,
   `tbd sync` will tell you when upstream moved — run `tbd docs update`.”
5. **`docs-overview.md`** needs its promised rewrite (the `tbd docs` group, docref-based
   `add`, fork mention) — it’s the repo’s own orientation doc and currently teaches the
   superseded surface.
6. **The three-sync taxonomy** (sync vs setup vs docs sync vs docs update) is the single
   most confusion-prone area for users; the spec’s 4-row table is the right artifact and
   should land in `tbd-docs.md` verbatim as the contract says (today a 3-row variant
   lives only in design §4.13).

## 3. The Two Design Questions

### Q1: Copy-all-and-gitignore-some vs export-only-the-forked

**Recommendation: keep the current export-only model.
Don’t build the gitignore-workflow variant, even as an option.**

The decisive observations:

- **Gitignored mirrors don’t actually deliver the visibility goal.** The original
  complaint is “can’t browse them *on GitHub*, can’t check them in.”
  Gitignored files appear in neither GitHub nor PRs — so under copy-all, the unforked
  majority is exactly as invisible to the team as `.tbd/docs/` is today; the cache has
  only moved to a prettier path.
  The only incremental benefit is local-editor browsing, which `.tbd/docs/` (plain local
  files) already provides.
- **It creates the worst silent failure mode in the design space.** A user or agent
  *will* edit a gitignored mirror file (they sit right next to tracked ones, and agents
  grep first and check ignore rules never).
  The edit works locally, is served (fork dir has top precedence), and silently never
  reaches the team — no commit, no PR review, no record.
  The current design makes visibility an explicit act (fork = start tracking), so
  divergence is impossible without a git-visible artifact.
  That property is load-bearing; the copy-all option destroys it.
- **Gitignore-as-state-machine is fragile in well-known ways**: ignoring an
  already-tracked file does nothing (the #1 gitignore confusion); `git add -f`
  accidents; “is doc X forked?”
  becomes a predicate over *two* systems (index + ignore rules) instead of one manifest
  — and the derived-state achievement (§2.9 invariant 5: no sequence of git operations
  can desync tbd) stops holding, because ignore rules are not content.
- **Upgrade and deletion semantics get contradictory.** Today “nothing is ever silently
  re-created against the user’s deletion” is a clean principle.
  With a mirror, `tbd docs sync` must re-write unforked mirror files on every upgrade —
  so deleting one either resurrects (violating the principle) or requires tombstones
  (new state machinery).
- **“See everything, then choose” is already served** — and better: `tbd docs list`
  (with sizes/descriptions) is the catalog; `tbd docs show <name>` (Phase 2 — worth
  pulling earlier, since it’s the browse-without-forking command); and crucially
  `tbd docs fork --all` *is* the copy-all option in tracked form: every doc visible in
  `docs/tbd/`, on GitHub, with the manifest tracking all of them — and `unfork` (or just
  not committing) is the undo.
  A user who wants the all-visible experience can have it today with one command and
  real visibility, instead of a fake one.

The fallback intuition — tbd should always use `docs/tbd` as the first source and fall
back to its internal cached copies — is exactly what’s implemented (the precedence list,
§2.9 invariant 1) and is correct *independent of this choice*; it’s also what makes
out-of-band deletion degrade gracefully.
The action item from §1 is just to make it true for shortcuts.

One simplification to consider: since `fork --all` is the sanctioned “show me
everything” path, make the zero-fork `tbd docs` overview present **three** named
postures — hidden (default), curated (`--category`), everything (`--all`) — so the
catalog→choice flow is explicit without any gitignore machinery.

### Q2: Granular doc-map registry vs search path

**What the PR actually builds is a hybrid, and the split is right — but it should be
stated as a principle, in the docs, because right now it has to be reverse-engineered.**
The principle is:

> **Resolve by convention; track only what cannot be derived; publish the inventory as a
> generated view.**

- **Resolution = search path** (fork dir → [future `local_dirs`] → cache,
  first-match-wins, names-are-identity, flat kind dirs).
  Right because: zero registration ceremony (drop a file → served, the `local` state for
  free), and *a registry can’t be wrong if there is no registry* — every stale-registry
  failure mode (file says X, disk says Y) is structurally impossible.
  The lookup_path bug found in §1 is the cautionary tale for the alternative: the one
  place resolution *is* config-state-driven is exactly where the feature broke.
- **The manifest tracks only the non-derivable fact**: which upstream a fork came from
  and the base snapshot at the fork point.
  A merge base cannot be recomputed from disk; everything else
  (customized/stale/missing/local) is derived by hashing.
  So the manifest is minimal by construction — it’s not a doc registry, it’s a
  provenance ledger, and only for docs that have an upstream relationship.
- **docmap = generated view**, so it’s always true.
  Making it *authoritative* (file-by-file management in docmap format) would mean: every
  add/rename/delete must update the map (agents and humans will skip this), map merge
  conflicts, and the stale-registry failure class — in exchange for capabilities not yet
  needed.

**What is given up, honestly stated**:

1. **Arbitrary layouts.** A team with an existing guidelines tree in non-tbd layout
   can’t map names→paths; they must move files into `<kind>/<name>.md` (or wait for
   `local_dirs`, which only adds more convention-shaped dirs).
   An authoritative map could redirect per-doc.
2. **Per-doc metadata overrides and ordering** (title/description live in frontmatter
   only).
3. **A committed machine-readable inventory** for external consumers to read from the
   repo at rest (today they’d have to run `tbd docs list --json`).

**Why the loss is acceptable and reversible**: the docmap *format* already carries
everything an authoritative registry would need (`type`, `name`, `path`, `source`). So
the future move — “tbd can also *read* a committed docmap as a doc source” (#117’s
framework, as ‘operations over docmaps’) — adds a consumer without changing the format
or breaking anything shipped.
The option stays open at zero cost.
What should *not* happen is making the docmap authoritative preemptively: wait for a
concrete user with the arbitrary-layout problem.

Two refinements to make now so the story is crisp (both feed §4):

- Fix the location inconsistency: tbd’s own `docs list --json` currently emits upstream
  entries with **neither `path` nor `source`** (`docs-fork.ts:573–581`), while the
  format’s definition says every entry has a location.
  Emit `source: internal:…` for upstream docs (already computed for forking).
  Then the docmap is genuinely usable as an inventory by third parties.
- Write the one-paragraph “resolution is by search path; the docmap is a view, not an
  input (today)” statement into `docmap-format.md` and §2.9, so nobody later “fixes” the
  system into registry-driven resolution by accident.

## 4. Deep Review: DocRef and DocMap Abstractions

Both modules are well-built as code: dependency-free as claimed, small public APIs,
spec-mirror tests, extraction-ready.
This section is about the *abstractions* — where they’re exactly right, and where v0.1
currently overcommits or under-specifies in ways that are cheap to fix now and expensive
later. Verdict: **DocRef needs four cuts/clarifications to be the universal grammar
intended; DocMap needs two tightenings and one deletion.
Neither needs more features.**

### DocRef (`src/docref/docref.ts`)

**What’s right and should be preserved**: single-string, totally-parsed, typed result;
the `//` repo/path separator is genuinely better than GitHub’s own blob-URL ambiguity
(branch names containing `/` parse correctly — `github:o/r@feature/x//path` works
because the separator is unambiguous); normalization of `blob`/`raw` web URLs to one
canonical form is exactly the right kind of opinion; idempotent `parse∘format`
round-trips are tested.

**Issue 1 — cut the `git:` scheme (overcommitment).** `git:owner/repo//path` has no
hostname, so it’s unresolvable — there’s nothing a consumer can fetch.
Worse, the natural reading `git:host.com/owner/repo//path` mis-parses today
(owner=`host.com`, repo=`owner`, path swallows the rest).
Shipping an unresolvable, mis-parsing scheme in a v0.1 grammar is exactly the
“complexity that might not be correct later” risk: once any manifest contains a `git:`
ref it must be supported forever.
Cut it from v0.1; add a host-bearing form (`git:host/owner/repo@ref//path`) when a
non-GitHub/GitLab need actually appears.

**Issue 2 — decide the bare-path question deliberately (currently the grammar validates
almost nothing).** `parseDocRef('hello world')` succeeds as a local path, so
`isDocRef()` is true for nearly any string and validation is toothless.
For a *universal* address format the grammar should be strict — local paths must start
with `./`, `../`, or `/` — letting each consumer decide to coerce bare strings at its
own boundary (tbd can keep accepting `guidelines/python-rules.md` in config by
prepending `./` before parse).
Strict grammar + lenient consumers composes; lenient grammar can never be tightened.
If the lenient rule stays, document it as a deliberate decision in `docref-format.md`,
because it surprises.

**Issue 3 — two local-path holes**: (a) `~/` parses as local but no expansion semantics
are defined anywhere — define ("consumers expand to the user home") or reject in v0.1
(recommend reject; it’s a config-file convenience that can come later); (b) Windows
drive-letter paths (`C:/Users/...`) hit the `unknown scheme` rejection (`docref.ts:172`)
since `C:` matches the scheme regex.
CI runs Windows; a Windows user’s absolute path is a legitimate address.
Either special-case `^[A-Za-z]:[\\/]` as local, or document “absolute paths are
POSIX-style” — but choose explicitly.

**Issue 4 — URL fragments are silently dropped during normalization.**
`https://github.com/o/r/blob/main/f.md#testing` normalizes to `github:o/r@main//f.md` —
the `#testing` vanishes (`gitRefFromUrl` reads `pathname` only).
For *documents*, fragments are meaningful (tbd itself has `--section`). v0.1 can rule
fragments out of scope, but silent data loss in a *normalizer* is the one behavior a
format can’t afford.
Either preserve (add an optional `fragment` to the git/url kinds — small) or reject refs
with fragments with a clear error.
Recommend preserve: it’s one optional field and it future-proofs section addressing.

**Smaller notes**: `docRefsEqual` is syntactic — fine, but say so in the format doc
(GitHub owners are case-insensitive; case is deliberately not normalized).
`internal:` is fine to keep in the universal grammar *if* the format doc defines it
app-relatively ("the consuming tool’s bundled collection") rather than as tbd-specific.
And the reference doc should cite purl (package-url) as prior art and say why it doesn’t
fit (package-centric identity, no good in-repo file story) — reviewers will ask.

**The biggest DocRef gap is not in the code**: `references/docref-format.md` doesn’t
exist, so the grammar’s only spec is a module docstring — while Resolved Decision 10
declares it a “hard rule with no exceptions” and *nothing in the shipped code parses a
docref anywhere* (zero imports outside the module; manifest `source` strings are built
by string concatenation, `docs-fork.ts:81–89`). Before the next release: write the
reference doc, and wire `tryParseDocRef` validation into at least manifest read and
`docs status` so the hard rule is enforced somewhere real.

### DocMap (`src/docmap/docmap.ts`)

**What’s right**: one object, one entry shape; `passthrough()` for extension fields with
“consumers must ignore unknown fields”; identity uniqueness enforced; self-identifying
version tag. This is the right size for v0.1.

**Tighten 1 — require a location.** The format’s own definition says each entry has “a
location (`path`, and/or a provenance `source`)” but the schema makes both optional and
tbd’s first producer emits entries with neither (§3 Q2). Add a zod refinement: at least
one of `path`/`source` per entry.
An inventory whose entries can’t be located isn’t an inventory; this is the single
change that makes hand-authored docmaps in other repos actually consumable.

**Tighten 2 — pin path-relativity.** Nothing says what `path` is relative to.
For a committed docmap file the only sane answer is *relative to the docmap file’s own
directory* (the sitemap convention); for generated/streamed docmaps (tbd’s `--json`),
relative to a stated collection root.
One paragraph in `docmap-format.md`; without it, two consumers will disagree on day one.

**Delete 1 — drop `word_count` from the core format.** It’s the only presentation field
with a unit opinion baked in, and tbd — the format’s first and only producer — doesn’t
emit it (it renders bytes + approx tokens instead, `docs-fork.ts:568`). A core field the
reference implementation skips is a credibility leak.
Let size/length metrics be extension fields (`size_bytes`, `approx_tokens`, `word_count`
— whatever a producer has); keep core = identity + location + `title`/`description`.

**Smaller notes**: `parseDocMap` accepts any `docmap/*` version — fine for 0.x, but
state the policy ("readers accept `docmap/0.*`, warn on others").
`entryKey`/`groupByType`/`filterByType` are good minimal helpers; resist adding more (no
merge/diff helpers until an operation needs them — that’s the #117 layer, deliberately
deferred).

**Using this use case to refine the format**: the fork feature is teaching the right
lesson — tbd needed `state`/`stale` and put them in extension fields, not the core.
That’s the pattern holding up well.
The two places the use case exposes real format gaps are exactly location-requiredness
and path-relativity above; fix those and docmap/0.1 is something another tool could
adopt as-is.

## 5. Suggested Next Steps

This PR ships the complete f05 experience as the next release; in priority order:

1. Fix the three correctness blockers — shortcut serving precedence, the `--category`
   hint, the merge-file exit-code guard.
2. Reconcile the golden maps with shipped output (one source of truth); from then on
   validate each phase against its golden block as it lands — the Phase 0.5 discipline,
   applied in-PR.
3. Complete the remaining phase items per the audit in finding 4; the old-surface
   re-homing (Phase 2) and the agent surface (Phase 5) are the release-critical tail.
4. Apply the DocRef/DocMap tightenings (§4) while nothing depends on them.
5. Keep the PR title/description current with the phase checklist as items complete.
