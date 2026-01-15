# Tbd V1 Design + Plan Review

Reviewed documents:

- **Design spec:**
- **V1 implementation plan spec:**
- **Best practices (TypeScript CLI patterns):**
- **Best practices (TypeScript monorepo patterns):**

Scope: I reviewed the design + plan end-to-end (File/Git/CLI layers,
schema/serialization, sync + merge + attic, search, import, testing strategy,
packaging/monorepo setup as described in the plan).
I did **not** review an actual repository codebase beyond what’s described in the plan
doc (since only the docs were provided).

---

## Executive summary

The overall architecture is coherent and implementable:

- **File-per-entity** (Markdown + YAML front matter) on a **dedicated sync branch** is a
  good fit for Git-native collaboration and aligns with the design goals.
- The plan’s **BaseCommand + OutputManager** approach matches the CLI best-practices doc
  well.
- The use of a **hidden worktree** for search is a pragmatic performance choice.

However, there are several **high-impact alignment gaps and correctness issues** that
will cause implementation churn or bugs unless resolved up front.
The biggest themes:

1. **Schema/serialization mismatch**: “explicit nulls” vs Zod “optional fields” +
   examples using `null`.
2. **Git write path ambiguity/mismatch**: plan uses `GIT_INDEX_FILE` +
   `git add .tbd-sync/` without clearly operating in a worktree that contains
   `.tbd-sync/`.
3. **CLI contract mismatches & option parsing bugs**: `--quiet` is used in tests but not
   defined; `--no-sync` is a Commander negated option but the plan reads `opts.noSync`
   (likely wrong); missing `warn()` method in OutputManager; environment variable naming
   mismatch.
4. **Cross-platform + security**: atomic rename on Windows; `exec(args.join(' '))`
   injection risk in search; `grep` fallback isn’t Windows-safe.
5. **Import section deviates from design**: attempts SQLite; wrong file paths/names;
   async/await bugs; invalid example IDs; pending dependency targets violate schema.

If you address the P0 items below before coding, the implementation effort should be
significantly smoother and the resulting tool will be more reliable, testable, and
agent-friendly.

---

## P0 issues to resolve before implementation proceeds

### P0-1: Decide and standardize “optional vs null” fields across schema + serialization + examples

**Why it matters:** Your canonical serialization rules and examples emphasize **explicit
nulls**, but the design’s Zod schemas use `.optional()` in multiple places (which
rejects `null`) while examples and the plan show `parent_id: null`, `closed_at: null`,
etc. This is a guaranteed source of parsing/validation failures and/or inconsistent
round-trips.

**Observed mismatches:**

- Canonical rules: “Null values explicit (not omitted)”
- Examples in both design + plan show `null` for fields like `parent_id`, `closed_at`,
  `close_reason`, `deferred_until`.
- But schema snippets (design) mark those fields as `optional()` instead of
  `nullable()`.

**Recommendation (strong):**

- For “conceptually nullable” fields, use **`z.string().nullable()`** (and do not omit
  them in canonical serialization).
- For “optional presence” fields, **omit them consistently** and remove the “explicit
  null” rule.

Given your canonicalization + hashing goals, the simplest consistent approach is:

- **Store keys always present** for the major nullable scalars, and use **`null`**
  explicitly:
  - `assignee`, `parent_id`, `closed_at`, `close_reason`, `due_date`, `deferred_until`

- Update schema to allow nulls:
  - `z.string().nullable()` etc.

**Acceptance criteria:**

- Parse → serialize → parse round-trip yields identical objects (including `null`
  presence).
- Hash is stable under round-trip.
- Schema accepts all examples in docs.

---

### P0-2: Fix ID collision probability math (and decide if 6-hex is still acceptable)

**Why it matters:** The design doc’s collision probability numbers for 24-bit IDs are
incorrect by orders of magnitude.
Even if you keep 6 hex chars, the doc should not mislead implementers/users.

For a uniform random 24-bit ID space (16,777,216 possibilities):

- ~**1%** collision probability occurs around **581** generated IDs
- ~**50%** occurs around **4,823** generated IDs
- ~**99%** occurs around **12,431** generated IDs

That does **not** mean collisions are common day-to-day (expected collisions at 5,000
IDs is still < 1), but the stated “1% at 13,000” is backwards.

**Recommendation:**

- Correct the math in the design doc.
- Keep the implementation’s collision handling (check existence + retry), and explicitly
  document that **remote/dual-node collisions** are handled during sync by treating it
  as a create conflict and preserving the loser in attic.
- Optionally consider 8 hex chars (32-bit) _later_ if compatibility allows (but note
  your “stability contract” says 6 hex).

---

### P0-3: Clarify and align the Git write strategy (worktree commit vs plumbing + isolated index)

**Why it matters:** The plan currently mixes approaches in a way that will likely not
work:

- It sets `GIT_INDEX_FILE` (isolated index), does `git read-tree tbd-sync`, then runs
  `git add .tbd-sync/`.
- But `.tbd-sync/` is **not present** on main branch worktree; it’s on `tbd-sync` branch
  (and your hidden worktree holds that).
- `git add` is a porcelain command that depends on a working tree containing the files.

You need to pick one canonical approach and reflect it consistently in both design and
plan.

#### Option A (recommended for V1): **Do all sync-branch writes inside the hidden worktree**

- Treat `.tbd/.worktree` as the local working copy of the sync branch data.
- Modify files there, commit there, push `HEAD:refs/heads/tbd-sync`.
- This naturally avoids touching the user’s main index; `GIT_INDEX_FILE` becomes
  unnecessary.

Pros: simpler, less git-plumbing complexity, fewer opportunities for subtle index/tree
mistakes. Cons: you must ensure the worktree stays healthy/clean; but you already have
doctor + rebuild.

#### Option B: **Pure plumbing using isolated index and blob writes** (as shown in design)

- Write content to blobs (`git hash-object -w`), then `git update-index --cacheinfo`,
  `write-tree`, `commit-tree`, update ref.
- This avoids dependency on a working directory.

Pros: no worktree dependency for writes; very “pure” and robust once correct.
Cons: complex; more implementation risk; harder to debug.

**Recommendation:** Choose **one** for V1 (I’d choose Option A unless there’s a strong
reason not to), then:

- Update plan pseudocode accordingly.
- Update design doc invariants accordingly (or clarify that “isolated index” is only
  required if you’re writing from the main worktree context).

---

### P0-4: Add missing CLI flags + fix option parsing bugs (quiet/no-sync/automation)

**Why it matters:** Plan golden tests and best-practices require flags that are missing
or incorrectly wired.

#### Issues

1. **`--quiet` is used in golden tests** (`tbd init --quiet`) but global options snippet
   does not define it.

2. Commander negated option: `.option('--no-sync')` yields a property named **`sync`**,
   not `noSync`. The plan reads `opts.noSync`, which means `--no-sync` likely won’t
   work.

3. OutputManager uses `ctx.quiet` but ctx.quiet depends on (1).

4. Sync retry code calls `ctx.output.warn(...)`, but OutputManager in plan doesn’t
   define `warn`.

5. Env var name mismatch:
   - Design doc shows `tbd_ACTOR` (lowercase `tbd_...`)
   - Plan uses `TBD_ACTOR`

#### Recommendations (minimum set)

- Add `.option('--quiet', 'Suppress non-essential output')`

- Fix negated sync flag reading:
  - Either read `opts.sync === false`
  - Or avoid Commander negated option pattern and define a normal boolean flag yourself

- Add OutputManager methods:
  - `warn(message)` (stderr, text-only; JSON mode emits structured warning object or
    stays silent depending on your contract)

- Standardize env vars to uppercase:
  - `TBD_ACTOR` (and optionally accept legacy `tbd_ACTOR` as fallback)

- Add automation-friendly flags recommended in the CLI patterns doc:
  - `--no-progress` (disables any spinners/progress output; even if you don’t add
    spinners now, this protects future changes)
  - `--non-interactive` (ensures no prompts; default in CI)
  - `--yes` or `--force` where destructive-ish behavior exists (optional but helpful)

---

### P0-5: Fix shell injection risk + portability issues in `search`

**Why it matters:** Plan uses `execAsync(args.join(' '))`. If user supplies patterns
containing shell metacharacters (even accidentally), this is dangerous and will also
break searches with spaces/quotes.

**Recommendations:**

- Use `spawn`/`execFile` with an args array (no shell).

- Prefer `rg --json` for robust parsing (or `git grep` as a cross-platform fallback).

- Avoid `grep` fallback on Windows (often absent).
  Best fallback hierarchy:
  1. `rg` if available
  2. `git grep` (should be available anywhere git is installed)
  3. Node-native search (slow but safe) as last resort

- Ensure output parsing works on Windows paths (drive letters contain `:` which breaks
  `path:line:match` parsing unless you use structured output).

---

### P0-6: Atomic write must handle Windows replace semantics + temp cleanup

**Why it matters:** The design doc explicitly calls out that `rename()` may fail on
Windows if the destination exists.
The plan’s atomicWrite snippet uses `fs.rename(tmp, path)` which is not cross-platform
safe.

**Recommendations:**

- Use a proven library (`atomically`, `write-file-atomic`) or implement:
  - write temp
  - fsync temp
  - replace existing with platform-safe replace semantics

- Add orphan temp cleanup (design suggests deleting stale `.tmp.*` files older than a
  threshold).

---

### P0-7: Import plan is not aligned with design and contains correctness errors

Key problems in the plan import section:

- Mentions importing from SQLite (`db.sqlite`) which conflicts with design goals (“no
  SQLite”) and requires extra deps not listed.
- Wrong/unclear Beads file paths (design calls out `.beads/issues.jsonl`; plan
  references `beads-sync.jsonl`).
- Async/await bugs: `generateUniqueId(storage)` is async but used synchronously.
- Example IDs include non-hex values (`is-x7y8z9`) which violates IssueId format.
- “Pending dependency targets” (`pending:...`) violate schema (`target` must be
  IssueId).
- Priority range is inconsistent (0–4 vs 0–5 appears in different places).

**Recommendation:** Rework import design to:

1. Read JSONL only (from provided file and/or `.beads/issues.jsonl` sources).
2. First pass: parse all lines, build a complete mapping for all Beads IDs found.
3. Second pass: create all Tbd issues with dependencies translated using the full
   mapping.
4. Merge behavior: reuse same merge machinery as sync or define import-specific rules.
5. Never persist invalid IDs to issue files.

---

## P1 issues (important, but can be addressed shortly after P0)

### P1-1: Dependencies merge strategy should be “merge_by_id”, not “union”

The plan uses `union` for `dependencies`. This will not correctly handle “same
target/type but updated metadata” and can lead to duplicates unless union logic is
specialized.

Recommendation:

- Define dependency identity as `(type, target)` and merge/dedupe by that key.
- Keep output sorted deterministically.

### P1-2: Stats/status/kind enums are inconsistent in plan examples

Design includes:

- Status: `open`, `in_progress`, `blocked`, `deferred`, `closed`
- Kind: `bug`, `feature`, `task`, `epic`, `chore`

Plan stats aggregation initializes only `{ open, in_progress, closed }` and kinds
`{ bug, feature, task, epic }`.

Recommendation:

- Make enums consistent everywhere (schemas, filters, stats, JSON output, docs).
- If you truly want to omit `chore` in V1, remove it from schema + docs.

### P1-3: Timestamp precision + deterministic tie-breakers

- Many examples show timestamps without milliseconds; `toISOString()` includes
  milliseconds.
- LWW ties need deterministic ordering to avoid oscillation across nodes.

Recommendation:

- Decide and document timestamp precision (seconds vs milliseconds).

- Implement tie-breaker:
  - Compare `updated_at`
  - If equal: compare `content_hash`
  - If still equal: compare `(node_id, commit_hash)` or stable lexical ordering of
    source (`remote` > `local`) for determinism.

### P1-4: `.tbd/.gitignore` inconsistency inside design doc

In one place it ignores only `cache/`, elsewhere it ignores `cache/` and `.worktree/`.

Recommendation:

- Standardize `.tbd/.gitignore` to ignore **both** `cache/` and `.worktree/` (and
  consider ignoring temp files, lock files).

### P1-5: Canonical serialization rules contain a minor internal contradiction

- “No flow style” but examples include `extensions: {}` and `labels: []` (flow style).

Recommendation:

- Clarify rule as:
  - Block style for non-empty collections
  - Flow style allowed for empty `{}` and `[]`

### P1-6: `--dir` / `--db` must be threaded through _all_ path usage

Plan hardcodes `.tbd/...` in multiple pseudocode blocks (search, attic path).
Recommendation:

- Create a single `Paths` resolver and use it everywhere.

---

## Alignment with CLI best practices (research-modern-typescript-cli-patterns)

What’s aligned already (good):

- BaseCommand + OutputManager concept is present.
- Dual output (text + JSON) is present.
- Exit code convention (0/1/2) is stated.
- Golden tests focus on stable output (NO_COLOR).

Key best-practice gaps to close:

1. **Automation/agent friendliness**
   - Add `--no-progress` and ensure any progress/spinners go to stderr and are disabled
     when not TTY.
   - Add `--non-interactive` and ensure prompts are disabled in CI.

2. **Strict stdout/stderr contract**
   - Ensure JSON mode never prints “status” lines to stdout.
   - Errors always to stderr, ideally structured in JSON mode.

3. **Single exit point**
   - Commands throw typed errors; entrypoint handles `process.exit(code)` and SIGINT
     (130). Add SIGINT handling as recommended.

4. **Avoid shell execution**
   - Use spawn/execFile for git and search.

---

## Alignment with monorepo best practices (research-modern-typescript-monorepo-patterns)

The plan’s described setup is broadly aligned:

- pnpm workspace, tsdown dual build, exports map, changesets, CI/release workflows,
  publint checks (mentioned).

Recommended checks to ensure the “current setup” really matches the research doc intent:

- `package.json`:
  - `type: module`
  - `exports` with **types first**
  - `files: ["dist"]`
  - `sideEffects: false` (if valid)
  - `engines` set intentionally (be careful if “node24” target is aspirational)
  - `packageManager: "pnpm@..."` at root

- CI:
  - Run `pnpm -r test`, `pnpm -r lint`, `pnpm -r publint`
  - Ensure release workflow is changesets-based

- tsdown:
  - Ensure CLI bin gets a shebang in output
  - Consider dynamic git-based version injection if you want that traceability (plan
    references it but doesn’t implement details)

---

## Doc edits recommended for editors (design + plan)

### Design doc edits ()

1. **Fix ID collision probability numbers** in “2.5 ID Generation” and optionally add a
   short note explaining that collisions are handled via retry and attic-preserved
   create-conflict handling.

2. **Resolve optional vs null**:
   - Update schemas to use `.nullable()` for fields shown as `null` in examples, or
     update examples + canonical rules to omit instead of null.

3. **Clarify the Git write path**:
   - Either: officially bless “commit inside hidden worktree” for V1, or keep
     plumbing-only and remove any implication of staging from the working tree.

4. **Standardize env var name** (`TBD_ACTOR`), optionally supporting legacy alias.

5. **Clarify dependency direction**:
   - Explicitly define whether `dependencies: [{type:"blocks", target:X}]` means “X
     blocks this issue” (BLOCKED BY semantics).
   - Ensure `dep add <id> <target-id>` wording reflects that direction.

6. **Unify attic file format**:
   - Decide `.md` vs `.yml` and ensure examples match content (currently there’s an
     example that looks like JSON in a `.yml` file).

7. **Unify `.tbd/.gitignore` contents** (cache + worktree).

8. **Decide timestamp precision** (and document it).

### Plan spec edits ()

1. Add `.option('--quiet', ...)` and fix Commander `--no-sync` parsing.
2. Replace `exec(args.join(' '))` patterns with spawn/execFile calls; document as a
   security requirement.
3. Fix `commitToSyncBranch` pseudocode to match the chosen Git write strategy.
4. Update merge field strategy for `dependencies` to merge-by-id.
5. Implement OutputManager.warn (used by sync retry).
6. Import section: remove SQLite, fix paths, fix async mapping, remove invalid
   IDs/pending IDs.
7. Stats initialization must include full status/kind enum set.

---

## Engineering backlog for agents (prioritized, actionable)

### P0 implementation tasks

- [ ] **Define a single canonical data model decision: `null` vs omitted**
  - Update Zod schemas + serializer + examples + tests accordingly.

- [ ] **Implement `Paths` resolver**
  - `tbdDir`, `cacheDir`, `worktreeDir`, `syncRootDir`, `issuesDir`, `atticDir`, etc.
  - Must respect `--dir/--db` and repo root.

- [ ] **Choose Git write strategy and implement it end-to-end**
  - If “worktree commit”: implement `ensureWorktree()`, `applyChanges()`, `commit()`,
    `pushHeadToBranch()`.
  - If “plumbing”: implement blob write + update-index + commit-tree + update-ref and
    ensure no working-tree dependency.

- [ ] **Add local sync lock**
  - Lock around any operation that touches worktree/cache/index to prevent concurrent
    CLI runs.

- [ ] **Fix CLI global flags**
  - `--quiet`, `--no-progress`, `--non-interactive`, `--json`, `--color`, `--dir/--db`,
    `--actor`, `--sync/--no-sync` semantics.

- [ ] **Search backend**
  - spawn/execFile; prefer `rg --json` or `git grep`; no shell.

- [ ] **Atomic write**
  - Windows-safe replace + temp cleanup.

- [ ] **Import rework**
  - JSONL only; two-pass mapping; no pending IDs; correct file paths.

### P1 implementation tasks

- [ ] Merge-by-id for dependencies; deterministic sort.
- [ ] Tie-breakers for LWW conflicts (avoid oscillation).
- [ ] Stats includes all enums.
- [ ] Config set parsing (typed): parse booleans/numbers/null via YAML parsing of the
      value string.
- [ ] Add `Clock` + `Random` injection for test determinism (env override for golden
      tests).

---

## Additional golden tests I strongly recommend adding (to prevent regressions)

1. **`--no-sync` actually disables sync** (after you fix option parsing)
2. **Ambiguous ID prefix resolution** (create >300 issues or mock prefix list)
3. **Round-trip canonicalization**: parse → serialize → parse stable, hash stable
4. **Search pattern with spaces and shell metacharacters** (ensures no shell execution)
5. **Windows path safety** (at least unit-test path parsing logic; CI matrix helps)
6. **Import with dependencies** (ensures mapping and dependency direction correctness)
7. **Attic restore** creates new issue version and writes a new attic entry for
   displaced current value

---

## Closing note

The design and plan are directionally strong, and the golden-testing-first approach is
exactly what you want for a CLI with a strict compatibility contract.
The key to avoiding churn is to **resolve the P0 contract questions (null vs optional,
git write strategy, CLI flag semantics) before coding**—otherwise agents will implement
conflicting assumptions and you’ll pay the integration cost repeatedly.

If you want, I can also produce a “Doc Patch Checklist” formatted as a series of
concrete markdown diffs (section-by-section) that editors can apply directly, but the
items above should already be actionable for both doc editors and implementation agents.
