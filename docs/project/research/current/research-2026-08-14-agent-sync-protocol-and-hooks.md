# Research: Keeping Agent Sessions Synchronized — Prime, Claim, Sync, and Linear

**Date:** 2026-08-14 (last updated 2026-08-14)

**Author:** Research brief (AI-assisted; audit of the shipped v0.6.1 code and this
repository’s live bead store, a measured probe of the sync engine against the bundled
mock Linear server, plus a primary-source survey of agent hook surfaces)

**Status:** Complete for the current-state audit and the platform survey.
The design section proposes and recommends; it deliberately does not decide.

**Related:**

- [Linear as a Task Surface for Beads and Agents](research-2026-08-09-linear-task-surfaces.md)
  — the verified Linear API facts, the topology option space, and §7b.4 “agents
  announcing themselves in beads”, which this doc turns into a concrete protocol
- [External Tracker Integrations](../../specs/active/plan-2026-08-10-external-tracker-integrations.md)
  — the shipped sync engine this doc audits
- [How Coding Agents Listen On and Monitor Issues](research-2026-06-04-agent-issue-monitors.md)
  — the trigger/dispatch taxonomy; this doc is its inverse, covering how an agent
  *reports* rather than how it is *woken*
- [Modernize multi-agent skills and hooks setup](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
  — the surface registry (`portable`, `agents-md`, `claude`, `codex`) this doc proposes
  extending
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) — durable truth vs.
  live coordination

* * *

## Overview

The goal is concrete: **someone should be able to open Linear and see what every agent
on this project is doing right now**, without agents flooding Linear with hundreds of
issues, and without depending on any single agent remembering to be polite.

Four questions, in order:

1. What actually happens today, end to end, when an agent works in this repository and a
   human watches Linear?
2. What can each agent platform *enforce*, as opposed to merely *suggest*?
3. Once a person is looking at Linear, can they **click through** — to the PR, to the
   doc, into the bead browser — and is the work linked together well enough to try?
4. What protocol, and what new tbd primitives, would make all of that true by
   construction rather than by good behavior?

**The headline finding: the mechanism is essentially built and the enforcement is not.**
`tbd sync` already folds Linear in by default, reconciles three-way against a recorded
base, and is safe to call from any agent at any moment — that was the hard part and it
is done. What is missing is everything that decides *when* it runs and *what it says*:

- Nothing makes an agent claim a bead.
  **Zero of this repository’s 1,681 beads carry an assignee.**
- Nothing makes a sync happen at the moments that matter.
  The only sync in the shipped protocol is at session end.
- The selection policy puts 114 mostly-idle beads in Linear while leaving 8 of the 14
  *currently in-flight* beads out of it.

**And a second finding that reorders the work: a sync with nothing to do is not free.**
Measured, a quiet tracker sync still rewrites every bridge record (so it commits, so it
pushes, so it runs this repo’s pre-push test suite) and spends one provider request per
linked bead. So the natural plan — *hook it, run it constantly, keep agents unblocked* —
is correct in principle but cannot be built on today’s code without making every agent
turn expensive. Three small fixes
([§1.7](#17-is-plain-tbd-sync-cheap-enough-to-run-often-measured)) turn a quiet sync
into two requests and zero writes, and they are prerequisites for everything else here
rather than follow-ups to it.

**And a third: the links a reader would follow mostly do not exist.** Of the three
click-throughs the requirement names, one works (Linear → the doc), two are rendering
code with no data behind them (Linear → PR, Linear → bead source), and the fourth
destination — a specific bead in `tbd web` — has no address at all
([§5](#5-traceability-beads-docs-prs-and-the-tracker)). A bead also has nowhere to put a
pull request: external identity is deliberately one-link-per-provider, which is right
for a tracker and wrong for PRs.

Each of these is a small, tractable change.
None of them requires new distributed-systems machinery.

### The chain, and where it breaks

Everything the user wants reduces to a five-link chain.
Each link exists; three of them are unreliable.

| # | Link | Mechanism today | Verdict |
| --- | --- | --- | --- |
| 1 | Agent learns tbd exists and what to work on | `SessionStart` hook runs `tbd prime` | **Broken here** — the shipped hook script exits 1 in this environment and fails silently ([§1.4](#14-finding-the-sessionstart-hook-fails-open-and-fails-here)) |
| 2 | Agent picks work | `tbd ready` | Works |
| 3 | Agent marks what it is working on | `tbd update <id> --status in_progress` | **Never happens** — one table row in one doc tier; 0 assignees repo-wide ([§1.5](#15-finding-nothing-in-the-shipped-guidance-tells-an-agent-to-claim)) |
| 4 | The change reaches Linear | `tbd sync`, on by default via `sync_on_tbd_sync` | Correct, but **not cheap enough to run often** (F9, F10) — and off in this repo, and instructed only at session end ([§1.2](#12-is-linear-included-in-plain-tbd-sync-yes--the-matrix), [§1.7](#17-is-plain-tbd-sync-cheap-enough-to-run-often-measured)) |
| 5 | Linear shows who and what | Managed block + attachment | Shows status; carries no actor and no in-flight detail ([§1.6](#16-finding-linear-receives-status-but-not-actor-or-in-flight-detail)) |

Links 1, 3, and 5 are the work.
Link 4 works but needs to get cheap before anything can lean on it.

* * *

## 1. What ships today, audited

### 1.1 The sync path is real and already safe to call from any agent

`tbd sync` runs three independent surfaces — docs, issues, external trackers — and
contains each one’s failure so a bad Linear key never blocks a git push
(`sync.ts:220-305`). When `integrations.sync_on_tbd_sync` is true (the schema default,
`schemas.ts:581`), the tracker run is folded *inside* `fullSync`, after the pull/merge
and before the push, so reconciliation sees other machines’ bead changes and the records
it writes ride the same push out (`integration-runner.ts:1-11`).

The engine underneath (`sync-engine.ts:1-23`) is the “opportunistic single-writer”
design that
[§7b.3 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#7b3-the-resolution-opportunistic-single-writer-and-three-way-merge-instead-of-lww)
called for, and it is complete:

1. Replay pending intents from any crashed run, including another machine’s.
2. Pull the remote delta against a watermark with a 10-minute overlap — an efficiency
   prefilter, never a correctness input.
3. Reconcile every linked pair three-way against a bridge-maintained base, per the
   `field_sync` policy.
4. Guard: bulk thresholds count both directions (20 creates / 40 updates).
5. Journal every planned external write with client-generated UUIDs, and commit the
   journal *before* any provider I/O.
6. Apply, with per-pair failure containment; conflicts archive to the attic and post a
   `commentCreate` on the Linear side, deduplicated by client id.
7. Run the policy scans: outbound creates, inbound report or import.

**The consequence that matters for this brief: how often to sync is a policy question,
not a safety question.** Two agents syncing concurrently is already handled.
There is no *correctness* argument left against syncing more often.
There are, however, three concrete *cost* defects that make frequent syncing painful
today, all measured in [§1.7](#17-is-plain-tbd-sync-cheap-enough-to-run-often-measured)
and all fixable.

### 1.2 Is Linear included in plain `tbd sync`? Yes — the matrix

Worth stating plainly, because it is the first thing to check before building any
frequent-sync habit on top of it.
**`integrations.sync_on_tbd_sync` defaults to `true`** (`schemas.ts:581`), and the fold
site tests `!== false` (`sync.ts:1163-1167`), so *enabling a provider is itself the
opt-in*: a repository that configures Linear gets it in plain `tbd sync` with no second
switch. That is the right default and it is already systematic.

What is *not* uniform is which invocations carry it, and in which direction:

| Invocation | Docs | Issues | Linear | Direction |
| --- | --- | --- | --- | --- |
| `tbd sync` | ✓ | full | **✓ full** | both |
| `tbd sync --integrations` | — | — | ✓ full | both |
| `tbd sync --pull` | — | pull | ✓ | inbound only |
| `tbd sync --push` | — | push | ✓ **but outbound-only mirror** | outbound, **no three-way reconcile** |
| `tbd sync --issues` | — | full | **✗ silently skipped** | — |
| `tbd sync --docs` | ✓ | — | ✗ | — |
| `tbd sync --status` | ✓ | ✓ | **✗ never reported** | — |
| `tbd --dry-run sync` | ✓ | ✓ | **✗ never previewed** | — |

Three of those rows are defects rather than design:

**F6 — `tbd sync --push` silently performs the outbound-only projection.** It calls
`runEnabledIntegrationPushes` (`sync.ts:205`), the same one-way mirror as
`tbd integration sync --push`. The `setup-linear` shortcut warns joiners in bold never
to run that command, because it “projects local bead values over the tracker without a
three-way reconcile, so it can overwrite a teammate’s Linear-side edit that a full
`sync` would have detected.”
The warning names `integration sync --push` only.
`tbd sync --push` is a far more natural thing for an agent to type, carries no warning,
and does the same thing.

**F7 — `tbd --dry-run sync` previews docs and git but never the tracker.** The dry-run
guard returns before `fullSync` and surface 3 excludes dry runs outright
(`sync.ts:234`), so the one command an agent would reach for to answer “what would this
do to Linear?” is exactly the one that will not say.
`tbd --dry-run integration sync` does preview it — the inconsistency is the problem.

**F8 — the code comment says the opposite of the code.** `sync.ts:1155` opens the fold
site with “Integration fold, **off by default**.” The default is on.
A reader auditing this file — human or agent — takes away the reverse of the truth.

### 1.3 Measured state of this repository

Read from the live sync branch on 2026-08-14 (1,681 bead files under
`.git/tbd/data-sync-worktree/.tbd/data-sync/issues/`), with the selection recomputed
using the same predicate as `selection.ts:mirrorSet` against this repo’s configured
`select` block (`kinds: [epic]`, `statuses: [open, in_progress, blocked]`,
`specs: active`, `linked: true`).

| Measure | Value |
| --- | --- |
| Beads total / active (open, in_progress, blocked) | 1,681 / 254 |
| Active epics | 25 |
| Active beads with a spec in `specs/active/` | 105 (across 14 distinct specs) |
| **Beads the current policy selects for Linear** | **114** — 45% of all active work |
| Selected beads at nesting depth 1 / 2 / 3 | 31 / 39 / **44** |
| Beads currently `in_progress` | 14 |
| …of which the policy selects | **6** |
| Beads carrying an `assignee`, ever | **0 of 1,681** |
| Beads carrying a `parent_id` | 1,164 of 1,681 (133 of 254 active) |

Four findings fall straight out of that table.

**F1 — The default policy selects far more than advertised.** The `setup-linear`
shortcut tells users the `default` preset is “roughly 10% of a typical repository’s
beads.” Here it is 45%. The preset selects `kind == epic` *or* `spec_path` under
`specs/active/`, and in a spec-driven repository the second clause dominates: 105 of the
114 selected beads qualify on their spec, not on being an epic.
The claim should either be corrected or the preset narrowed.
[§5.3](#53-what-already-works-better-than-expected-spec_path-propagation) explains the
mechanism: `spec_path` propagates from an epic to every descendant, so the clause really
means “mirror every descendant of every epic with a live spec.”

**F2 — A third of the selected set would be skipped on creation.** With
`max_nesting: 2`, `planMirror` skips any unlinked bead deeper than 2 levels *within the
selection* (`mirror.ts:203-212`). 44 of the 114 sit at depth 3. A first full mirror of
this repository therefore produces 70 Linear issues and 44 lines of
`nested 3 levels, past max_nesting 2`. That is defensible behavior — Linear’s views
flatten past two levels anyway
([§9.0a](research-2026-08-09-linear-task-surfaces.md#90a-nested-epics)) — but it means
the selection count and the Linear issue count differ by 39%, which will surprise
whoever runs the first sync.

**F3 — The in-flight work is largely invisible.** 8 of the 14 `in_progress` beads are
not selected: they are tasks and bugs with no active spec, most of them children of an
in-progress parent (`tbd-0zpa` alone has five in-flight children).
Someone watching Linear sees the epic move to *Started* and learns nothing about what is
actually happening underneath it.
This is precisely the gap the user is describing.

**F4 — Presence does not exist.** Not one bead in the store’s entire history carries an
assignee. `tbd ready` defines “ready” as *open, unblocked, and unclaimed*
(`issue-selection.ts:61`), so the claim filter is live code that has never had anything
to filter. Two agents working this repository concurrently today would both see the same
`tbd ready` list and could pick the same bead.

One more piece of local context: this repository sets
`integrations.sync_on_tbd_sync: false` (`.tbd/config.yml`), a deliberate pilot override
recorded in the tracker spec.
**So today, in this repo, plain `tbd sync` does not touch Linear at all.** Everything
below assumes that override is lifted once the pilot completes.

### 1.4 Finding: the SessionStart hook fails open, and fails here

`tbd setup --auto` installs `.claude/scripts/tbd-session.sh`, which Claude Code runs on
`SessionStart` and `PreCompact`. It is the only mechanism that makes an agent aware of
tbd at all in a fresh session.
It did not work in this session, and the reason is a bug in the script rather than in
the environment:

```bash
# .claude/scripts/tbd-session.sh
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
```

Prepending `/usr/local/bin` **ahead of the caller’s own PATH** shadows whatever Node the
session was configured with.
Here, `/usr/local/bin/node` is v20.20.2 while the session’s Node is v22.22.2, so the
pinned fallback `npx --yes get-tbd@0.6.1 prime` printed:

```
tbd requires Node.js 22.12.0 or newer; current runtime is 20.20.2. Upgrade Node.js before running tbd.
```

and the script exited **1**. Claude Code treats a non-zero, non-2 exit from
`SessionStart` as a non-blocking error whose stderr goes to the debug log
([hooks reference](https://code.claude.com/docs/en/hooks)), so nothing surfaced to the
user or to the agent.
The agent in this session received no bead list, no workflow context, and no indication
that any of it was missing.

Three separate weaknesses compound here:

- **Wrong PATH order.** The intent is “prefer common local bin locations”; the effect is
  “override the caller’s toolchain.”
  Appending rather than prepending fixes it.
- **A network fetch on every session start.** With no global `tbd`, every session (and
  every compaction) runs `npx --yes get-tbd@0.6.1`, which is slow, needs egress, and is
  a fresh supply-chain fetch each time.
- **Silence on failure.** `SessionStart` accepts a `systemMessage` field precisely so a
  hook can tell the user something went wrong.
  The script uses none of it.

This is link 1 of the chain, and it is the cheapest thing in this brief to fix.

### 1.5 Finding: nothing in the shipped guidance tells an agent to claim

An audit of every instruction surface tbd installs, searching for anything that tells an
agent to mark a bead as in progress:

| Surface | Says to claim? |
| --- | --- |
| `AGENTS.md` managed block | No — “Track all work as beads: `tbd create`, `tbd ready`, `tbd close`, and `tbd sync`” |
| `skill-minimal.md` (the `SKILL.md` frontmatter tier) | No |
| `skill-brief.md` (used by `tbd prime --brief`, and after compaction) | No |
| `skill-baseline.md` (full tier) | **One table row**: `tbd update <id> --status in_progress` — “Claim work” |
| `tbd closing` / session closing protocol | No — commit, push, watch CI, close, sync |
| `implement-beads` shortcut | No — “Follow `tbd shortcut precommit-process` and `tbd sync` changes after each bead” |
| `plan-implementation-with-beads` shortcut | No |

So the entire instruction for the single most important operational signal is one cell
in one table in the largest of three doc tiers — a tier that is *replaced by the brief
tier* after the first compaction.
The measured outcome (F4: zero assignees, and only 14 of 1,681 beads ever left in
`in_progress`) is exactly what that guidance predicts.

By contrast, the closing protocol — commit, push, watch CI, close, sync — appears in
**all four** surfaces, repeated with emphasis, and it is followed.
The lesson is not subtle: repetition across tiers is what makes agent instructions
stick.

### 1.6 Finding: Linear receives status but not actor or in-flight detail

`renderManagedBlock` (`managed-block.ts:57-93`) writes this into the Linear description,
inside `⟦tbd⟧`…`⟦/tbd⟧`:

```
tbd-va8i · epic · in_progress · P1
Spec: [plan-2026-08-10-external-tracker-integrations.md](https://github.com/…)
PRs: [#206](…)
Children: 12 (3 ready)
Bead: [tbd-va8i](…) · `tbd show tbd-va8i`
```

The bead attachment carries the full canonical field set as structured metadata
(`mirror.ts:128-160`) — kind, status, priority, labels, assignee, spec path, parent,
child counts, dependencies.

What is absent, for the operational-visibility purpose:

- **No actor.** `assignee` is pushed only when `user_map` maps it (`mirror.ts:245-247`),
  and it is empty everywhere.
- **No in-flight roll-up.** `Children: 12 (3 ready)` is a count.
  It cannot answer “which two of those twelve is someone working on right now, and since
  when?” — and those two are the only ones a human watching Linear cares about.
- **No freshness.** Nothing states when the bead was last synced, so a stale mirror and
  a quiet project look identical.

`Children` and `ready` are computed across *all* issues, not just the selected ones
(`mirror.ts:176-183`), so the data needed for a real roll-up is already in hand at
render time. This is a rendering change, not a data change.

### 1.7 Is plain `tbd sync` cheap enough to run often? Measured

The plan — hook it, run it a lot, keep agents unblocked — only works if a sync that has
nothing to do is genuinely free.
It is not, and the reasons are specific.

**Measurement 1: git, no bead changes.** A no-op `tbd sync` in this repository:

```
✓ Docs up to date
✓ Already in sync
--- wall: 2.92s | tbd-sync commits: 468 -> 468 (delta 0)
```

**2.9 seconds, no commit, and no push at all** — `pushChanges` skips the push when
`aheadCommits === 0` (`sync.ts:1220`), so the pre-push hook of F5 never fires.
Roughly 1.3 s of that is CLI startup.
This is the good case and it is fine.

**Measurement 2: the tracker path, nothing changed anywhere.** Run against the mock
Linear server in `tests/helpers/linear-mock-server.ts`, driving `runSync` to a settled
steady state and then measuring one further genuinely-quiet run with a fresh adapter
(because the real CLI is a fresh process each time):

| Linked beads | `comments` mode | Provider requests | Bridge records rewritten | `nothingToDo` |
| --- | --- | --- | --- | --- |
| 3 | `two_way` (default) | 5 | **3 of 3** | `true` |
| 10 | `two_way` (default) | 12 | **10 of 10** | `true` |
| 10 | `off` | **2** | **10 of 10** | `true` |

Two defects, both visible in that table.

**F9 — a no-op sync rewrites every bridge record, so “nothing changed” still produces a
commit.** The apply loop runs over *every* linked pair, not only the changed ones
(`sync-engine.ts:1097`, over `executablePairs`, which is every synchronizable pair), and
ends by writing the link record unconditionally with `synced_at: options.now()`
(`sync-engine.ts:1216-1230`). `synced_at` is a persisted schema field
(`schemas.ts:425`), so the file genuinely differs.
The measured diff of a quiet run is exactly this and nothing else:

```
  - synced_at: 2026-08-14T16:34:57.878Z
  + synced_at: 2026-08-14T16:34:57.898Z
```

The consequences compound:

- Every sync writes N files, so **every sync produces a commit and therefore a push**,
  which means **F5’s pre-push test suite fires on every sync** — the good case in
  measurement 1 never happens once Linear is on.
- `tbd changes` fills with commits that carry no information, which is precisely the
  “unreadable change reports” harm §7b.4 warned about.
- **The report and the git history disagree**: `nothingToDo` is `true` while N files are
  rewritten. Anything built on the report — a hook, a dashboard — will believe the sync
  was free.

The fix is small and local: write the record only when a field other than `synced_at`
differs, or drop `synced_at` from the persisted record (it is diagnostic; correctness
rides on `base` and `remote_updated_at`).

**F10 — comment polling is one request per linked bead, per sync, unbatched.** With the
default `comments: two_way`, the per-sync request count is **2 + N**, where N is the
number of linked beads: one `TeamMeta`, one `IssuesUpdatedSince`, and then one
`IssueComments` for *every* linked pair regardless of whether the delta showed any
activity on it. Setting `comments: off` collapses it to a flat 2, which confirms the
comment fetch is the entire slope.

**This corrects the estimate in an earlier draft of §3.3.** The real budget arithmetic,
against the **2,500 requests/hour** measured on a live key
([§1.2 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#12-rate-limits-measured)):

| Linked beads | Requests per no-op sync | Syncs/hour on one key |
| --- | --- | --- |
| 10 | 12 | ~208 |
| 70 (this repo’s projected mirror) | 72 | **~34** |
| 114 (this repo’s current selection) | 116 | **~21** |

Thirty-four syncs per hour is not “sync on every claim across a fleet of agents” — it is
one agent syncing twice a minute, with the whole team sharing that budget.
And the ceiling is per *key*, so every agent holding the same personal key draws on the
same 2,500.

With `comments: off` the same table reads 2 requests and ~1,250 syncs/hour at any bead
count, which is the shape frequent syncing needs.
Comments are worth having, so the fix is not to turn them off but to **fetch comments
only for pairs the delta says changed** — the delta is already in hand at that point in
the run, and a quiet pair cannot have a new comment without its `updatedAt` moving.

**Verdict on the user’s question.** Yes, `tbd sync` should always include Linear, and it
already does by default — that part is correct and systematic.
But “run it often, from a hook, without slowing an agent down” is **not safe to build
today**: F9 makes every sync a commit, F5 turns every commit into a full test-suite run,
and F10 makes the request cost scale with the mirror.
Fix those three and the frequent-sync design becomes not just viable but nearly free — a
quiet sync would be two requests, zero writes, zero commits, and no push.

* * *

## 2. Agent platform hook surfaces

### 2.1 What “enforcement” can actually mean

Hook mechanisms fall into three tiers, and conflating them is the main way this kind of
design goes wrong:

| Tier | Mechanism | Reliability |
| --- | --- | --- |
| **T-C: Context** | Inject text the model sees (`additionalContext`, `systemMessage`) | The model may ignore it. Good for orientation, useless as a guarantee. |
| **T-B: Block** | Refuse to let the turn or session end (`continue: false`, exit 2) | Strong. The agent cannot finish without addressing it — but it can loop. |
| **T-A: Act** | The hook *runs the command itself*; no model involvement | Strongest. Bounded by what a shell script can decide without knowing intent. |

The rule that follows: **use T-A for anything mechanical (running `tbd sync`), T-B for
anything that gates completion (did the claimed work get recorded?), and T-C only for
orientation.** Never use T-C for something that must happen.

### 2.2 Claude Code

The richest surface by a wide margin.
Claude Code exposes roughly thirty hook events; these are the ones that matter here
([hooks reference](https://code.claude.com/docs/en/hooks)):

| Event | Matcher | Useful output | Tier | Fit |
| --- | --- | --- | --- | --- |
| `SessionStart` | start reason (`startup`, `resume`, `clear`, `compact`, `fork`) | `additionalContext`, `systemMessage` | T-C | Orientation. **Used today.** |
| `PreCompact` | `manual` / `auto` | `additionalContext` | T-C | Re-prime. **Used today.** |
| `UserPromptSubmit` | — | `additionalContext`, `updatedInput` | T-C | A per-turn in-flight reminder. Cheap but noisy. |
| `PreToolUse` | tool name + `if` conditions (`Bash(git commit *)`) | `permissionDecision: allow/deny/escalate` | T-B | Gate a commit on the bead being claimed. Aggressive. |
| `PostToolUse` | tool name + `if` | `additionalContext` | T-C/T-A | **Used today** for `git push` → `tbd closing`. The natural checkpoint trigger. |
| `PostToolBatch` | — | `continue: false` | T-B | Fires after each parallel tool batch — a rate-limited checkpoint tick. |
| **`Stop`** | — | **`continue: false` + `stopReason`** | **T-B** | **The keystone.** Claude cannot end its turn; the reason goes back to the model. |
| `SubagentStop` | agent type | `continue: false` | T-B | Same gate for subagents. |
| `TaskCompleted` | — | `continue: false` (rolls back completion) | T-B | Could bind harness tasks to bead closure. Speculative. |
| `SessionEnd` | end reason | `systemMessage` | T-A | Last-chance sync. **1.5 s shared budget**, raised to 60 s max by setting `timeout`. |

Two details worth pinning down because they shape the design:

- **`Stop` is the only event that reliably catches “the agent thinks it is finished.”**
  Returning `continue: false` with a `stopReason` sends the reason back into the model’s
  context and the turn continues.
  That is the mechanism for “you claimed `tbd-abc1` and never synced.”
- **`SessionEnd`’s default budget is 1.5 seconds shared across hooks.** A `tbd sync`
  that contacts a git remote and Linear will not fit unless `timeout` is set explicitly.
  Treat `SessionEnd` as a courtesy, never as the guarantee.

tbd uses three of these today (`SessionStart`, `PreCompact`, `PostToolUse`+`git push`).
`Stop` and `SessionEnd` are unclaimed and are where the enforcement belongs.

### 2.3 Codex

Codex converged on Claude Code’s event vocabulary, which is why tbd’s
`.codex/hooks.json` maps almost 1:1 today.
Per the [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks):

- Events: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`,
  `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`,
  `SubagentStop`, `Stop`.
- Config: `~/.codex/hooks.json`, `~/.codex/config.toml` (`[hooks]` inline),
  `<repo>/.codex/hooks.json`, `<repo>/.codex/config.toml` — all layers load, higher
  precedence does not replace lower.
- **Hooks are on by default now**; `[features] hooks = false` disables them.
  Earlier releases gated them behind an experimental `codex_hooks` flag, so guidance
  written against that is stale.
- **Project-local hooks load only when the project `.codex/` layer is trusted.** This is
  a real deployment caveat: a fresh clone’s `.codex/hooks.json` does nothing until the
  user trusts it.
- Output: `continue`, `stopReason`, `systemMessage`, `additionalContext` — the last
  capped by `additionalContextLimit` (~2,500 tokens default).
  `PreToolUse` and `PermissionRequest` support `systemMessage` only.

**Implication:** a `Stop`-based gate works on Codex with the same script, and `tbd`’s
current Codex surface is one event short of parity with the plan below.
The trust requirement means the Codex surface must degrade gracefully to
instructions-only.

### 2.4 Cursor

[Cursor hooks](https://cursor.com/docs/agent/hooks) are production, not beta, and
configured in `.cursor/hooks.json` (project) or `~/.cursor/hooks.json` (user).
Event names are camelCase and the payload contract differs from Claude/Codex, so this
needs its own adapter script rather than a copy:

- `sessionStart` returns `additional_context` — the orientation slot.
- **`stop` returns `followup_message`**, which auto-continues the agent.
  That is Cursor’s analogue of `continue: false` and is exactly what the gate needs.
- `beforeShellExecution` returns `{"permission": "allow|deny|ask"}` — the `PreToolUse`
  analogue.
- Also present: `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`,
  `subagentStop`, `preCompact`, `afterFileEdit`, `beforeSubmitPrompt`, `workspaceOpen`.

tbd installs nothing for Cursor today, even though Cursor reads `AGENTS.md` and
`.agents/skills/`. Adding a `cursor` surface is a well-defined, self-contained unit of
work.

### 2.5 Gemini CLI

[Gemini CLI hooks](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)
live in the `hooks` object of `settings.json` (`.gemini/settings.json` project,
`~/.gemini/settings.json` user).
Events: `BeforeTool`, `AfterTool`, `BeforeAgent`, `AfterAgent`, `BeforeModel`,
`AfterModel`, `BeforeToolSelection`, `SessionStart`, `SessionEnd`, `Notification`,
`PreCompress`. Output supports `systemMessage`, `hookSpecificOutput.additionalContext`
(on `BeforeAgent`, `AfterTool`, `SessionStart`), and `decision: allow|deny` with a
`reason`.

**There is no blocking stop event.** `AfterAgent` fires after the agent has responded
and carries no documented way to force continuation.
So Gemini gets T-C orientation and T-A actions, but the completion gate degrades to a
strongly worded reminder.

### 2.6 Everything else

- **OpenCode** exposes a TypeScript *plugin* API — a function returning hook objects,
  with `session.start`, `tool.execute.before`, `session.idle`, and others.
  It is code, not JSON, so tbd would ship a plugin package rather than a config file.
  A generic hook-router (JSON handlers with stdin/stdout decisions) is still an open
  feature request upstream, so this is a “watch it” item, not a build-now item.
- **Amp, GitHub Copilot CLI, Cline, and the rest** read `AGENTS.md` and
  `.agents/skills/`. No lifecycle hooks.

### 2.7 Coverage summary

| Agent | Skill file | `AGENTS.md` | Session-start context | Completion gate | tbd installs today |
| --- | --- | --- | --- | --- | --- |
| Claude Code | ✓ `.claude/skills/` | ✓ | ✓ `SessionStart` | ✓ `Stop` (blocking) | Skill + 3 hooks |
| Codex | ✓ `.agents/skills/` | ✓ | ✓ `SessionStart` | ✓ `Stop` (blocking) | Skill + 3 hooks (needs trust) |
| Cursor | ✓ `.agents/skills/` | ✓ | ✓ `sessionStart` | ✓ `stop` → `followup_message` | **Nothing** |
| Gemini CLI | ✓ `.agents/skills/` | ✓ | ✓ `SessionStart` | ✗ | **Nothing** |
| OpenCode | ✓ `.agents/skills/` | ✓ | ✓ (plugin) | ~ (plugin) | **Nothing** |
| Amp / Copilot / Cline / … | ✓ `.agents/skills/` | ✓ | ✗ | ✗ | Skill only |

**The portable floor is instructions.** Hooks cover Claude, Codex, Cursor, and partly
Gemini; everything else is on the honour system.
So the protocol has to be *correct by instruction* and merely *reinforced* by hooks.
Any design that only works with hooks silently excludes half the ecosystem — and, per
[§1.4](#14-finding-the-sessionstart-hook-fails-open-and-fails-here), hooks fail open
even where they exist.

* * *

## 3. The protocol

### 3.1 Constraints inherited from prior work

[§7b.4 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#7b4-agents-announcing-themselves-in-beads)
settled the discipline that makes bead-carried presence work.
Restated as rules:

- **Claim before write, one writer per bead.** Presence merges cleanly only because the
  claiming agent is the sole writer of its presence fields.
- **Coarse-grained only in the durable store.** Claimed, started, PR link, done: yes.
  Per-minute progress: no.
  High-frequency writes churn the sync branch and make `tbd changes` unreadable.
- **Never use `--notes` as a message log.** It replaces the whole body, so a second
  writer silently drops the first’s text.
- **The mirror must shrink on its own**, or it accretes forever.

### 3.2 The five moments

| Moment | When | Command | Why this moment |
| --- | --- | --- | --- |
| **Orient** | Session start; after compaction | `tbd prime` | The agent cannot follow a protocol it does not know about. |
| **Claim** | Before the first edit for a bead | `tbd update <id> --status in_progress --assignee <agent>` then sync | **The highest-value moment in the whole protocol.** It is the only thing that makes Linear show “someone is on this, right now.” |
| **Checkpoint** | After each commit, and at PR creation | `tbd sync` | Bounds staleness to one commit without per-tool-call churn. |
| **Land** | Before declaring done | Existing closing protocol (commit → push → CI → close → sync) | Already works and is already obeyed. |
| **Release** | On close, or on abandoning work | `tbd close`, or clear the claim | Prevents zombie claims ([§8](#8-risks-and-failure-modes)). |

Only **Claim** and **Checkpoint** are new.
Everything else exists.

**Claim is where the leverage is.** It is one command; it converts a bead from “planned”
to “in flight”; it populates the field `tbd ready` already filters on; and — with the
selection change in [§4](#4-visibility-versus-volume-in-linear) — it is what puts the
bead in front of a human in Linear.
If exactly one change ships from this brief, it should be this one.

### 3.3 What “sync on claim” actually costs

[§1.7](#17-is-plain-tbd-sync-cheap-enough-to-run-often-measured) has the measurements;
this is what they mean for the protocol.

**As shipped, sync-on-claim is affordable only at small mirror sizes.** The per-sync
request count is `2 + N` (N = linked beads), so this repository’s projected 70-bead
mirror allows roughly 34 syncs/hour across everyone sharing a key — and every sync
writes N bridge records, commits, pushes, and (here) runs the test suite.
Claiming a bead is itself a change, so **every claim pays the full price**.

**After F9 and F10 are fixed, it is nearly free**: two requests, zero writes on a quiet
run, no commit, no push, no hook.
At that point the frequency question stops being interesting and the protocol can simply
say “sync on every transition.”

That ordering matters for planning: **the efficiency fixes are prerequisites for the
enforcement work, not follow-ups to it.** A `Stop`-hook gate that nags an agent into
syncing, on today’s code, converts every agent turn into a test-suite run.

One further avoidable cost: `ensureMeta` caches on the adapter instance only
(`adapter.ts:488-491`), so **every CLI invocation re-fetches the team’s workflow states
and labels** — the single most expensive query in the set at 53 complexity points
measured. It is one of the two requests in the fixed floor, so an on-disk cache with a
TTL would halve a quiet sync.

**Git cost.** Each `tbd sync` fetches and merges the `tbd-sync` branch; it commits and
pushes only when something changed (`sync.ts:1220`), which measurement 1 confirms.
Syncing per bead transition is fine; syncing per tool call is not — it turns the sync
branch into commit noise and makes `tbd changes` reports unreadable, which is the
concrete harm §7b.4 warned about.

**F5 — and in this repository, every `tbd sync` runs the entire test suite.** tbd
deliberately passes `--no-verify` on its *commits* to the sync branch, precisely so
parent-repo hooks (lefthook, husky) do not fire on bead bookkeeping — `git.ts:1722`
comments on this intent directly.
The *push* does not do the same: `pushWithRetry` issues a plain
`git push <remote> refs/heads/tbd-sync:refs/heads/tbd-sync` (`git.ts:1029`), which fires
`.git/hooks/pre-push`. In this repository that hook is lefthook’s `pre-push`: quality
gate, build, and the full vitest suite.

Observed while writing this brief: a `tbd sync` that wrote 19 bead files committed in
under a second and then sat for minutes in `pnpm test`, invoked from the sync branch’s
push. Worse, the retry loop re-pushes up to `MAX_PUSH_RETRIES` times on a
non-fast-forward, so a contended sync can pay for the suite repeatedly.

It is an inconsistency rather than a design decision: the commit path already states the
intent that the push path does not implement.
The fix is to push the sync branch with `--no-verify` — it carries no source code, so no
parent-repo pre-push gate has anything to say about it.

F5 and F9 multiply each other.
F9 guarantees there is always something to push; F5 makes every push expensive.
Either fix alone helps; both together are what make a quiet sync actually quiet.

**Rule of thumb: sync on state transitions and commits, never on tool calls.** That is
at most a handful of syncs per bead, which both budgets absorb comfortably — once F5,
F9, and F10 are fixed.

### 3.4 What not to do

- **No sync on every `PostToolUse`.** Commit noise, no added information.
- **No hook that guesses which bead to claim.** A hook can see that a `git commit` ran;
  it cannot know which bead it was for.
  Claiming the wrong bead is worse than claiming none, because it makes Linear
  confidently wrong. The *decision* stays with the model; the hook only checks that a
  decision was made.
- **No mirroring every child bead.** That is 254 Linear issues and defeats the purpose.
- **No progress narration in bead notes.** Single-writer replaceable state, per §3.1.

* * *

## 4. Visibility versus volume in Linear

The user’s requirement contains a real tension: *maximum* operational visibility from a
*minimal* set of synchronized issues.
Resolving it means noticing that these are three separate levers, not one.

| Lever | Question it answers | Cost of using it |
| --- | --- | --- |
| **Selection** | Which beads become Linear issues? | One Linear issue each, forever (links persist) |
| **Projection** | What does a mirrored issue’s managed block say? | Free — it is a rendering change |
| **Events** | What gets posted as a comment? | Cheap, but noisy if overused |

The current design uses lever 1 heavily, lever 2 minimally, and lever 3 only for
conflicts. Inverting that ratio is the whole recommendation.

### 4.1 Why today’s selection is the wrong shape

`kind == epic OR spec == active` is a **scope** filter: it answers “what is this project
working on this quarter.”
The user is asking for an **attention** filter: “what is happening right now.”
Those select nearly disjoint sets — F3 measured 8 of 14 in-flight beads falling outside
the scope filter, while 108 of the 114 selected beads are not in flight at all.

There is also an expressiveness gap in the policy schema.
`mirrorSet` (`selection.ts:76-98`) applies `statuses` as a **global gate** over both the
kind rule and the spec rule:

```
linked  OR  (statusAllowed AND labelsAllowed AND (kindRule OR specRule))
```

So “epics in any active status **OR** anything at all that is `in_progress`” cannot be
expressed: narrowing `statuses` to `[in_progress]` to catch the second clause would also
drop every open epic.
Supporting attention-based selection needs one new clause, not a rewrite.

### 4.2 Four options

Taking this repository’s numbers as the yardstick:

| Option | Rule | Linear issues | What a human sees |
| --- | --- | --- | --- |
| **A. Status quo** | epic ∪ active-spec | 114 selected → **70 created** (44 skipped at depth 3) | A large flat-ish backlog; in-flight work mostly invisible |
| **B. Mirror everything active** | all active beads | 254 | Everything, including 240 items nobody is touching. Blows the bulk guard; pollutes the team’s board |
| **C. Attention set** | epics ∪ anything `in_progress` ∪ linked | 25 + 12 = **~37** | Every epic, plus exactly the work in flight, and nothing else |
| **D. Epics only + rich roll-up** | epics ∪ linked | **25** | 25 issues whose descriptions list their in-flight children by name |

**Recommendation: C and D together, which are complements rather than alternatives.**

- Narrow the standing set to **epics plus explicitly linked beads** (option D’s
  selection): ~25 issues, stable, each one a thing a human would recognize as a project.
  Whether `specs: active` stays in the default preset is a per-repo choice; in a
  spec-driven repository it is the clause that produces the 45% (F1).
- Add a **transient attention rule**: any bead that is `in_progress` joins the mirror
  regardless of kind or spec.
  It enters when an agent claims it and stops being *newly* selected when it closes.
  Its link persists, so it keeps reconciling — which is correct: the closed issue should
  reach *Completed* in Linear.
- **Roll the rest up into the epic’s managed block** instead of mirroring it.

That yields roughly 37 Linear issues instead of 114, while showing strictly *more*
operational detail than today.

### 4.3 The roll-up, concretely

Replace `Children: 12 (3 ready)` with the information a human actually needs.
All of it is already available at render time (`mirror.ts:176-183` computes children and
readiness across the full store):

```
⟦tbd⟧
`tbd-va8i` · epic · in_progress · P1
Spec: [plan-2026-08-10-external-tracker-integrations.md](https://github.com/…)
PRs: [#206](…)
Children: 12 · 2 in progress · 3 ready · 7 open

In progress now:
  • tbd-9ggk — PR #205 final R1: preserve empty-status list behavior — claude@host (2h)
  • tbd-55a2 — PR #205 final R2: document watch commands in agent skill — codex@ci (11m)

Bead: [tbd-va8i](…) · `tbd show tbd-va8i` · synced 2026-08-14T16:04Z
⟦/tbd⟧
```

Three properties make this the right lever:

1. **It costs nothing.** No extra Linear issues, no extra API calls — the block is
   already rewritten on every sync via `spliceDescription`.
2. **It is self-limiting.** Only in-flight children are listed, so the block stays short
   by construction.
3. **It answers the actual question.** “Who is on this and since when” is what a person
   opens Linear to find out.

The `synced` timestamp matters more than it looks: without it, a stale mirror and a
quiet project are indistinguishable, and a human cannot tell whether they are looking at
live state.

### 4.4 Representing an agent in Linear

Agents are not Linear users, and `assignee` pushes only identities present in `user_map`
(`mirror.ts:245-247`), by deliberate design — nothing person-identifying enters bead
data without an explicit mapping.
Three options:

- **(a) Map an agent alias to a real Linear bot user.** Cleanest UI: Linear’s own
  avatar, filters, and “assigned to me” views all work.
  Costs a Linear seat and a `user_map` entry.
- **(b) Carry the actor in the managed block and a `tbd:in-progress` label.** No seat,
  no schema change, works today.
  Loses Linear’s native assignee affordances.
- **(c) Linear agent sessions (`actor=app`).** Native agent presence, narrower blast
  radius, and actor-based echo filtering — but needs an OAuth app and hosting this
  project does not have
  ([§6.4 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#64-linear-native-agent-sessions)).

**Recommend (b) now, (a) when a team wants it, (c) only if a hosted tbd Linear agent is
ever built.** Note that the `tbd:` label prefix and the status-carrier mechanism
(`tbd:blocked`, `tbd:deferred`) already exist in `mapping.ts`, so (b) is a small
addition to an established pattern.

* * *

### 4.5 Many repositories, one Linear surface

An important topology this brief had not yet examined: several repositories, each with
its own bead store, all reporting into **one** Linear project a human reviews.
Verified facts about Linear’s containment model first, because the mapping choices fall
out of them:

| Linear container | Owns | Verified |
| --- | --- | --- |
| **Team** | The issue identifier prefix (`FIN-123` is a per-team sequence), the workflow states, cycles, team-scoped labels. **An issue belongs to exactly one team.** | [§1.4 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#14-entity-model-for-field-mapping); [Linear docs](https://linear.app/docs/teams) |
| **Project** | Milestones, lead, health, dates, project labels. **A project can be shared across many teams**; an issue joins at most one project. | Linear docs: projects “can belong to a single team or be shared across many teams” |
| **Initiative** | The level above projects. | [§5.1b](research-2026-08-09-linear-task-surfaces.md#51b-containers-and-grouping-levels) |
| **Labels** | Team-scoped or workspace-scoped; label groups allow one label per group per issue. | Linear brief §1.4 |

So the user-visible identifier prefix lives at the **team** level, not the project level
— and tbd’s scope is exactly `team_key` (required) plus `project` (optional), with both
`createIssue` and `fetchUpdatedSince` filtered to that pair (`adapter.ts:249`,
`queries.ts:71-105`).

**What happens today when two repositories share one scope — probed, not assumed.** Two
disposable stores were pointed at one mock team+project; repo A mirrored two epics, then
repo B synced:

- **`inbound: report` (the default):** repo A’s items appear in repo B’s `importable`
  list — `FIN-1`, `FIN-2`, presented with ready-to-import ids — on every sync while they
  remain inside the delta window.
  `nothingToDo` is false, so the quiet-sync target is unreachable, and an agent reading
  the report is invited to import beads that already belong to another repository.
- **`inbound: auto`:** every foreign item fails `assertExternalUnclaimed` and lands in
  `report.failures` — and the folded `tbd sync` path converts per-item failures into a
  non-zero exit (`assertIntegrationReportsHealthy`). **Two repositories sharing a scope
  with auto-inbound make every sync of each repo fail** for as long as the other is
  active.

Call this **F15**. The one-source claim guard is doing its data-protection job — nothing
double-writes — but the *scan* has no concept of “not mine, skip silently”, so a foreign
claim reads as either an invitation or an error.
Each claim check also costs one `listAttachmentUrls` request per foreign candidate per
sync.

**F16 — mirrored issues carry no origin marker.** tbd applies labels only as status
carriers (`tbd:blocked`, `tbd:deferred`) and, optionally, mirrored bead labels.
There is no label saying “tbd wrote this” and none saying which repository it came from.
Two consequences:

- A human using Linear manually cannot filter agent-synced items in or out of a view,
  which is precisely the clutter concern raised for mixed human/agent workspaces.
- The claim URL `tbd://bead/<displayId>` names a bead but not a repository, so the
  refusal message cannot say *who* holds the claim — and the display prefix it embeds is
  per-repo config, so two repos with the same prefix produce indistinguishable claims.

**The three viable topologies**, given the verified containment model:

|  | Mapping | Works today? | Prefix tells you the repo? | Human filter |
| --- | --- | --- | --- | --- |
| **Mode 1** | Team per repo, one shared project | **Yes, zero changes** — each repo’s scan is team-filtered, so repos never see each other (F15 cannot fire) | Yes (`FIN-12` vs `TBD-45`) | By team |
| **Mode 2** | One team, one shared project, **repo labels** | No — needs F15’s scan scoping plus F16’s labels | No (one interleaved sequence) | By label |
| **Mode 3** | One team, project per repo, shared initiative | Yes, zero changes | No | By project |

Mode 1 is the recommendation for teams that can afford a Linear team per repository: it
is the only topology where isolation is structural rather than filtered, and the
per-team prefix answers “which repo” at a glance in every Linear view, notification, and
commit message. Its cost is real — teams carry members, cycles, and state configuration,
and `ensureMeta` is per team — so it suits a handful of repos, not dozens.

Mode 2 is what the user’s instinct describes (tags), and it should become first-class:

- **Origin labels (E18).** Every mirrored issue gets a plain `tbd` label plus a
  per-repository label inside a **Linear label group** named `repo` — the platform’s
  native convention for exactly this: creating a label as `repo/tbd` places it in the
  group, the UI renders the namespace, and **only one label from a group can be applied
  per issue**, which matches “each bead belongs to exactly one repo” structurally.
  Both label facts verified against Linear’s docs, along with the filtering this depends
  on: views support **“is not”** negation on labels, so `label is not tbd` hides all
  agent traffic and a `repo` group filter selects one repository.
  Applied through the existing status-carrier machinery, which already creates and
  attaches labels regardless of `mirror_labels`.
- **The repo label names the GitHub repository, not the bead prefix.** The default
  derives from the git origin via the existing `parseRepoSlug` (`permalink.ts:27-37`):
  the repo *name* (`tbd`), or the sanitized `owner-name` form when two repos share a
  name. Fallback when there is no GitHub remote: `display.id_prefix`. Override:
  `integrations.linear.repo_label`. The slug’s literal `owner/name` form is avoided
  because `/` is Linear’s label-group separator — `repo/jlevy/tbd` would parse as
  nesting, not a name.
- **Scope the inbound scan by origin.** A candidate carrying another repo’s `repo:`
  label is skipped silently — not reported, not failed, not claim-checked (saving the
  per-candidate request).
  Untagged items remain candidates, so human-authored issues still flow in under the
  inbound policy.

Mode 3 needs nothing and keeps the human entry point at the initiative level; it is the
answer when project-per-repo is acceptable, and the reason multi-repo-in-one-project
should never be the silent default.

### 4.6 Changing the mapping: what resyncs correctly, and what does not

Config is committed and editable, so remapping — a new `team_key`, a different
`project`, a narrowed policy — must either work or refuse loudly.
Today it mostly *neither works nor refuses*; it splits (**F17**, with the one genuinely
broken case in the `team_key` row).
Traced through the code:

| You change | What actually happens | Verdict |
| --- | --- | --- |
| `policy` (narrow or widen selection) | Linked beads keep syncing (`linked: true` is always honored); newly-selected beads mirror on the next sync, gated by the bulk guard; de-selected beads stop being *created* but never leave | **Safe.** The mirror never shrinks, which is documented behavior; preview with `--dry-run` (once F7 lands) |
| `project` | New creates land in the new project. **Already-linked issues never move**: nothing in the update path sets `projectId`, and the liveness fetch (`ISSUES_BY_ID_QUERY`) is unscoped, so old items keep reconciling from the old project forever | **Split-brain, silent.** Coherent per item, surprising in aggregate |
| `team_key` | New creates land in the new team. Old linked issues keep reconciling (unscoped liveness fetch) — **but every status push to them now sends the NEW team’s workflow-state UUID against an OLD-team issue** (`toInput` resolves `stateId` from the configured team’s `ensureMeta`, `adapter.ts:667-669`). Linear state ids are per-team, so these writes fail — a repeated per-item failure on every sync, forever | **Broken, noisy.** F17 |
| `display.id_prefix` | The claim/idempotency URL embeds the display id (`tbd://bead/<displayId>`, `mirror.ts:33-35`). New syncs upsert attachments under the new URLs; the old claims remain on the items, so every item accumulates a second tbd claim and other repos’ guards report both | **Degrades quietly.** Stale claims accumulate; the guard’s refusal message becomes ambiguous |
| `project` to a name that does not exist | Hard error listing every available project (`adapter.ts:172-176`) | **Good** — the model for what the others should do |

One adjacent sharp edge: `resolveProjectId` matches by name or slug across **the whole
workspace** (the projects query is unscoped) and takes the first hit, so two projects
with the same name in different teams resolve to whichever paginates first.

The fix (E19) is not migration tooling — it is making the split visible and the one
broken case safe:

1. **Detect the mismatch.** The liveness fetch already returns each issue’s identity;
   have the sync report (and `tbd doctor`) flag linked issues whose team no longer
   matches the configured `team_key`, with the count and a one-line explanation, instead
   of letting per-item state-push failures repeat silently.
2. **Never push a state id across teams.** If the linked issue’s team differs from the
   configured team, skip the status field for that pair and report why — one warning,
   not a failure per sync.
3. **Document the semantics** in `setup-linear` and the docs: policy changes are safe;
   `project`/`team_key` changes affect *new* creates only; moving existing items is a
   deliberate Linear-side operation (or unlink + relink), not something sync infers.

That is the “simple should be simple, complex should be possible” resolution: the
defaults never require these knobs; each knob has defined, stated behavior when turned;
and the genuinely complex operation (migrating a live mirror between teams) stays a
human decision rather than an inference.

* * *

## 5. Traceability: beads, docs, PRs, and the tracker

The requirement, stated as a test a person can run: **open Linear, see what has been
done so far, and click through — to the PR for detail, or into the bead browser for the
full picture.** This brief is a convenient specimen, because producing it exercised
every edge in that graph.

### 5.1 The graph that has to exist

Seven entities, and the edges a reader actually traverses:

```
   research doc ──┐
   plan spec    ──┼──► epic bead ──► child beads
                  │        │              │
   GitHub issue ──┘        ▼              ▼
                      Linear issue    PR / commits
                           │
                           └──► bead browser (tbd web)
```

The work starts as a **research doc**; a bead — usually an epic — is created to track
it; plan specs attach to that same epic later; children carry the implementation; PRs
and a GitHub issue attach as work lands; and the whole thing projects into **one Linear
issue** that a human uses as the entry point.

### 5.2 What works today, edge by edge

| Edge | Mechanism | Status |
| --- | --- | --- |
| bead → doc (spec or research) | `spec_path`, propagated to descendants | **works**, and better than expected ([§5.3](#53-what-already-works-better-than-expected-spec_path-propagation)) |
| bead → Linear issue | `extensions.linear` (`LinkedEntry`) | **works** |
| Linear issue → doc | `specUrl`: managed-block line + attachment, branch-resolved GitHub blob permalink | **works — the only live click-through** |
| Linear issue → bead source | `repoUrl`: managed-block `Bead:` line + “bead source” attachment | **dead stub** (F11) |
| Linear issue → PR | `prUrls`: managed-block `PRs:` line | **dead stub** (F12) |
| Linear issue → bead browser | — | **absent** (F13) |
| bead → PR | — | **absent** (F14) |
| bead → GitHub issue | `extensions.github` in principle | **absent** — no adapter (`integration-runner.ts:61`) |
| bead → *several* PRs | — | **structurally impossible** (F14) |

**F11 — `repoUrl` is declared, rendered, and never populated.** `MirrorLinks.repoUrl`
drives two things: the managed block’s `Bead: [id](url)` line (`managed-block.ts:80-84`)
and the “bead source” attachment (`mirror.ts:169-175`). Both call sites that build the
context pass only `specUrl` (`integration-runner.ts:272` and `:386`), and the sync
engine hardcodes `repoUrl: undefined` (`sync-engine.ts:527`). So the managed block
always renders the fallback form — `` Bead: `tbd show tbd-va8i` `` — and the bead-source
attachment is never created.

**F12 — `prUrls` is declared, rendered, and set by nothing at all.** The
`PRs: [#205](…)` line exists in `renderManagedBlock` (`managed-block.ts:74-76`) complete
with a `prLabel()` helper that parses `/pull/(\d+)`. A repository-wide search finds **no
assignment to `prUrls` anywhere in `src/`**. The single most-wanted click-through —
Linear to the PR — is rendering code with no data behind it.

**F13 — `tbd web` has no addressable bead.** The server exposes `/`, `/api/board`,
`/api/bead?id=`, and `/api/events` (`http.ts:383-411`), and the client never reads
`location.hash` or a query parameter to select a bead at load.
There is no URL that opens the browser on a specific bead, so “click into the bead
browser” has nothing to link to.

**F14 — no bead field can hold a PR.** External identity lives in
`extensions.<provider>`, and the schema comment is explicit that this is deliberate: the
namespace key **is** the provider, which makes at-most-one-link-per-provider structural
rather than a rule the merge code has to enforce (`schemas.ts:145-147`). That is exactly
right for a tracker — one bead, one Linear issue — and exactly wrong for pull requests,
which are many per bead and are not a tracker at all.
There is no other field for an arbitrary external reference.

The net: of the three click-throughs the requirement names, **one works (doc), two are
stubs, and the fourth destination does not have an address.**

Worth noting what the `tbd://bead/<id>` attachment is and is not.
It is the upsert idempotency key and the carrier for the full canonical field set as
attachment metadata (`mirror.ts:128-160`) — genuinely useful, and the reason a Linear
issue knows its bead’s labels and dependencies.
But `tbd://` is an invented scheme with no handler, so it renders as an attachment
nobody can click. It is a data channel, not a link.

### 5.3 What already works better than expected: `spec_path` propagation

Three properties, and none of them are obvious from the field’s name:

1. **`spec_path` accepts any repository path.** The schema is a bare string
   (`schemas.ts:193`) and `specPermalink` resolves whatever it is given against
   whichever branch contains it (`permalink.ts:74-84`). Nothing restricts it to
   `specs/`.
2. **`tbd update --spec` propagates to descendants** (`update.ts:129-130`, “Capture old
   spec_path before applying updates (for propagation)”), and `create --parent` inherits
   it (`integration-runner.ts:434`). So an epic pointed at a doc pulls its whole subtree
   along.
3. **Matching is gradual** (`spec-matching.ts`): filename, path suffix, or full path all
   resolve, so `tbd list --spec research-2026-08-14-agent-sync-protocol-and-hooks.md`
   finds the tree without anyone typing a full path.

Measured on this brief: pointing the epic at its research doc propagated `spec_path` to
all 24 children, `tbd list --spec <filename>` then returned all 25 beads, and the Linear
mirror set grew by exactly **one** — the epic, selected on `kind`, not on the doc.
The children stayed out because `matchesSpecRule` looks for the literal segment
`/specs/active/` (`selection.ts:22`) and a research path does not contain it.

**And that mechanism explains F1.** Of the 89 non-epic beads carrying an active spec,
**79 (89%) inherited it from an ancestor carrying the same spec.** The default policy’s
45% selection is not sloppy authoring — it is `spec_path` propagating from spec-carrying
epics to every descendant, with the `specs: active` clause then selecting each one.
Read plainly, that clause means *“mirror every descendant of every epic with a live
spec.”*

This sharpens the recommendation in [§4.2](#42-four-options): narrowing the standing set
to epics is not just a volume reduction, it removes a rule whose real behavior is much
broader than its name suggests.
And it argues that if the spec clause survives, it should select the bead that *carries*
the spec rather than everything that inherited it.

### 5.4 The workflow this brief itself failed to follow

The honest worked example, because it is the clearest evidence of the gap.

What happened: the research doc was written first, an epic was created afterwards to
track it, 24 children were filed under that epic — and **`spec_path` was set on none of
them** until this section went looking for the linkage and found it missing.
Nothing in `tbd prime`, the skill tiers, `new-research-brief`, or `AGENTS.md` asks for
it. The `new-research-brief` shortcut says to create the document and update it as you
learn; it never mentions a bead.

What should have happened, and what the shortcuts should say:

1. **Bead first.** Create the tracking epic when the research *starts*, not when it ends
   — an epic titled for the question, `spec_path` pointed at the doc that is about to
   exist.
2. **Sync immediately**, so the epic appears in Linear as *Started* while the work is
   under way rather than as a fait accompli.
3. **File children as findings turn into work**, inheriting `spec_path` automatically.
4. **Attach the PR** when it opens, and the GitHub issue if one exists — which is
   exactly what F12 and F14 make impossible today.
5. **Attach the plan spec** to the same epic when research turns into a plan, so one
   bead carries the whole arc: question → findings → plan → implementation.

Step 5 is the reason `refs` should be a list rather than a second scalar field: an epic
legitimately points at a research doc *and* a plan spec *and* a PR *and* an issue, and
that set grows over the epic’s life.

### 5.5 Proposed metadata: one `refs` list, not four fields

*Problem:* four different things a bead needs to point at (PR, external issue, research
doc, plan spec), one singular field (`spec_path`), and one provider-keyed single-valued
namespace (`extensions.<provider>`) that is deliberately not general.

*Proposal:* one additive, optional, top-level list.

```yaml
refs:
  - kind: doc
    url: https://github.com/jlevy/tbd/blob/main/docs/project/research/current/research-2026-08-14-…md
    title: research-2026-08-14-agent-sync-protocol-and-hooks.md
    at: 2026-08-14T16:04:00Z
  - kind: pr
    url: https://github.com/jlevy/tbd/pull/222
    title: 'research: Agent sync protocol, hooks, and Linear visibility'
    at: 2026-08-14T17:12:00Z
  - kind: issue
    url: https://github.com/jlevy/tbd/issues/190
    at: 2026-08-12T09:00:00Z
```

Design decisions, each with a reason:

- **`kind` is an open string with known values** (`pr`, `issue`, `doc`, `design`,
  `other`), not a closed enum — the same call `WorkflowState.type` gets in the Linear
  brief, for the same reason: an unrecognized kind should render generically, not fail a
  sync.
- **`url` is the identity**, so a repeated add is idempotent and the merge is a union
  keyed on it. `refs: 'union'` slots straight into the existing field-merge table
  (`git.ts:449-451`) beside `labels` and `dependencies` — **no new merge machinery**,
  and two agents attaching different PRs concurrently both survive.
- **Provider-neutral by construction.** A ref is a URL with a kind.
  Nothing about it knows Linear exists, which is the whole point: the same field carries
  a GitLab MR, a Notion page, or a CI dashboard.
- **`spec_path` stays.** It is load-bearing for selection, propagation, and
  `list --spec`, and re-homing it would be a format break for no gain.
  The clean split is: `spec_path` is *the doc this work is defined by*, singular and
  inherited; `refs` is *everything else this work points at*, plural and local.
  Optionally, surface `spec_path` as a synthetic `kind: doc` ref when rendering, so
  consumers see one uniform list.
- **Additive, so no format bump.** A new optional field on `IssueSchema` round-trips
  through older readers the same way `extensions` does.

*Why in the CLI rather than in agent instructions:* an agent cannot invent a storage
location, and four agents inventing four conventions in `notes` is the outcome if the
field does not exist.

### 5.6 Making the three click-throughs real

With `refs` in place, each dead edge closes with a small, local change:

| Edge | Change |
| --- | --- |
| Linear → PR | Populate `prUrls` from `refs` where `kind == pr` (F12). The renderer already exists, including `#222` labelling |
| Linear → bead source | Pass a `repoUrl` resolver at both call sites, built the same way `specUrl` already is — `blobUrl(slug, syncBranch, 'issues/<id>.md')` (F11) |
| Linear → bead browser | Give `tbd web` an addressable bead: `/#<bead-id>` read at load and written on selection, and have the managed block render `tbd web --open` alongside it (F13). A loopback URL is not shareable across machines, but it is exactly right for the person who has the repo checked out |
| bead → PR, automatically | `tbd shortcut create-or-update-pr-simple` already holds the PR URL at step 6; have it record the ref. `tbd sync` can also resolve the current branch’s PR opportunistically |

And the managed block that results — the thing a human actually opens Linear to read:

```
⟦tbd⟧
`tbd-dzme` · epic · in_progress · P1
Doc: [research-2026-08-14-agent-sync-protocol-and-hooks.md](https://github.com/…)
PRs: [#222](https://github.com/jlevy/tbd/pull/222)
Issue: [#190](https://github.com/jlevy/tbd/issues/190)
Children: 24 · 2 in progress · 5 ready · 17 open

In progress now:
  • tbd-774m — A quiet tbd sync must write nothing — claude@host (2h)
  • tbd-7okw — Push the sync branch with --no-verify — codex@ci (11m)

Bead: [tbd-dzme](https://github.com/…/tbd-sync/…) · `tbd show tbd-dzme` · `tbd web --open`
synced 2026-08-14T17:20Z
⟦/tbd⟧
```

Every line there is either already rendered or one resolver away.
Nothing in it requires a new sync mechanism, a webhook, or a hosted service.

### 5.7 Where GitHub fits

The GitHub adapter is Phase 3 of the tracker spec and unimplemented
(`integration-runner.ts:61`). It is worth being clear that **`refs` is not a substitute
for it, and mostly removes the urgency**:

- A *reference* to a GitHub issue or PR — “this bead’s work landed in #222” — is what
  the traceability requirement actually needs, and `refs` covers it with no adapter, no
  credential, and no reconciliation.
- A GitHub *integration* — beads and issues converging bidirectionally, three-way merged
  — is a much larger commitment, and the Linear brief’s §7 evidence is that
  bidirectional sync is rare in practice for good reasons.

So: ship `refs` now; treat the GitHub adapter as an independent decision about whether
GitHub issues should be an authoring surface, not as a prerequisite for linking.

* * *

## 6. Proposed tbd primitives

Each item states the problem, the proposal, and — importantly — why it belongs in the
CLI rather than in agent instructions.
The general principle: **anything a hook must decide has to be a machine-checkable CLI
answer, because a shell script cannot read prose.**

### E1. `tbd start <ids...>` — the claim primitive

*Problem:* claiming is three concepts (status, assignee, publish) that an agent must
remember to combine, and F4 shows it never does.

*Proposal:* one command, symmetric with `tbd close`:

```bash
tbd start tbd-a7k2                 # status=in_progress, assignee=<agent identity>
tbd start tbd-a7k2 --sync          # …and publish immediately
```

*Why in the CLI:* it collapses the instruction to a single memorable verb that can be
repeated across all four doc tiers, and it gives hooks something unambiguous to check.
`ready`/`start`/`close` is a complete, teachable vocabulary; `update --status` is a
generic escape hatch that happens to also do this.

### E2. Agent identity

*Problem:* `--assignee` needs a value, and every agent inventing its own string makes
the field useless for filtering.

*Proposal:* resolve an identity in order — `--as <name>`, `$TBD_AGENT`, then a derived
default such as `<agent-kind>@<host>` — and expose it as `tbd whoami`. Keep it
non-person-identifying by default, consistent with the existing `user_map` stance.

*Why in the CLI:* consistency across agents is the entire value; if each agent’s
instructions pick their own convention there is nothing to group by.

### E3. Attention-based selection

*Problem:* [§4.1](#41-why-todays-selection-is-the-wrong-shape) — `statuses` gates both
rules, so “epics, plus anything in flight” is inexpressible.

*Proposal:* add one clause to `IntegrationSelect`, e.g.
`always_statuses: [in_progress]`, unioned after the existing gate:

```
linked  OR  always_statuses.includes(status)  OR  (statusAllowed AND labelsAllowed AND (kindRule OR specRule))
```

Additive, defaults to empty, and leaves every existing config’s behavior identical.

### E4. Managed-block roll-up

Implement [§4.3](#43-the-roll-up-concretely) in `renderManagedBlock`: status breakdown,
in-flight children with actor and claim age, and a sync timestamp.
Pure rendering; the inputs already reach the function.

### E5. `tbd prime` reports live state

*Problem:* `prime` prints installation status, three counts, and a large static
document. It does not tell an agent the two things that would change its next action.

*Proposal:* add to the dynamic status block:

- **What this agent already claims** (`in_progress` beads matching the resolved
  identity) — the resume case, and the thing a compaction destroys.
- **Sync freshness**: how long since the last successful `tbd sync`, and whether Linear
  is enabled and current.

*Why in the CLI:* `prime` is the one output every session-start hook already pipes into
context on every platform.
It is the highest-leverage place to put anything an agent must know.

### E6. `tbd closing --check` — the machine-checkable gate

*Problem:* `tbd closing` prints prose.
A `Stop` hook needs a *decision*.

*Proposal:* a mode that inspects local state and exits with meaning:

- exit **0** — nothing outstanding;
- exit **2** with a one-paragraph reason on stderr — beads claimed by this identity are
  `in_progress` and the sync branch has unpushed bead changes;
- exit **0** with a `systemMessage` — a sync was attempted and *failed* (environmental:
  never block on it).

Add `--json` for hooks that prefer parsing to exit codes.

*Why in the CLI:* this is the single primitive that turns a T-C reminder into a T-B
guarantee, and it must live where the state is.

### E7. Hook hardening

- Fix the PATH order in `tbd-session.sh` and its Codex twin: **append** the fallback
  locations rather than prepending them
  ([§1.4](#14-finding-the-sessionstart-hook-fails-open-and-fails-here)).
- Prefer a repo-local resolution (`node_modules/.bin/tbd`, then a global `tbd`) before
  reaching for `npx`, so the common case needs no network.
- **Fail loudly**: emit `{"systemMessage": "tbd prime failed: …"}` so a broken hook is
  visible instead of silently skipped.
- Add a `tbd doctor` check that actually *executes* the installed hook scripts and
  reports their exit codes.
  Today `doctor` verifies the files exist and are wired; it cannot detect that they do
  not run.

### E8. Cheaper repeated syncs

Cache `ensureMeta` on disk with a TTL (per team, under the gitignored state area).
It is one of the two requests in the fixed floor and the most expensive one, so this
roughly halves a quiet sync once E10 and E11 land.

### E10. A quiet sync must write nothing (F9)

*Problem:* the apply loop writes every link record on every run with a fresh
`synced_at`, so a sync that changed nothing still produces N file writes, a commit, a
push, and (with F5) a test-suite run — while reporting `nothingToDo: true`.

*Proposal:* one of two small changes, and the second is cleaner:

1. Write the record only when a field other than `synced_at` differs from the record
   already on disk.
2. Drop `synced_at` from `LinkRecordSchema` entirely.
   It is diagnostic only — reconciliation rides on `base` and `remote_updated_at` — and
   the git commit timestamp already records when the record last moved.

Either way, add the regression test the audit used: settle a mirror, run once more, and
assert **zero bytes changed under `bridge/<provider>/links/`**. That assertion is the
whole contract, and nothing currently pins it.

*Why this is the highest-priority efficiency item:* it is what makes “sync is free when
nothing happened” true, which is the premise every frequent-sync design in this brief
rests on.

### E11. Fetch comments only for pairs the delta moved (F10)

*Problem:* with the default `comments: two_way`, every linked pair gets its own
`IssueComments` request on every sync, so cost is `2 + N` and a 70-bead mirror allows
~34 syncs/hour on a shared key.

*Proposal:* a pair whose provider `updatedAt` has not advanced past the recorded
`remote_updated_at` cannot have a new comment — Linear bumps `updatedAt` on comment
creation. The delta is already in hand at that point in the run
(`sync-engine.ts:513-560`), so restrict the comment fetch to pairs present in it, plus
pairs with locally authored comments pending push.
Quiet mirrors then cost a flat 2 requests at any size.

If a case is found where Linear does *not* bump `updatedAt` for a comment, fall back to
a periodic full comment reconcile (say, hourly) rather than per-sync polling — the
correctness argument for catching a missed comment within the hour is much weaker than
the cost argument against `N` requests every sync.

### E12. Make the surface flags say what they do (F6, F7)

- `tbd sync --issues` silently excludes the tracker.
  Either include it (issues and tracker are one logical surface) or say so in the
  output, so an agent narrowing to `--issues` for speed knows Linear went stale.
- `tbd sync --push` performs the outbound-only mirror that `setup-linear` warns joiners
  never to run. Give it the same guard the shortcut prescribes, or make it run the full
  reconcile in the outbound direction.
  A natural-looking flag should not be the dangerous one.
- `tbd --dry-run sync` should preview tracker work, as `tbd --dry-run integration sync`
  already does. “What would this do to Linear?”
  is the question dry-run exists to answer.
- `tbd sync --status` should report tracker state — enabled, reachable, last synced,
  pending intents — alongside git status.
  It is where `tbd prime` and any hook would read freshness from (E5).

### E13. Fix the comment that says the opposite of the code (F8)

`sync.ts:1155` says the integration fold is “off by default.”
It is on. One line, and it is exactly the kind of thing a future audit trusts.

### E14. A `refs` list on beads (F14)

The design is in [§5.5](#55-proposed-metadata-one-refs-list-not-four-fields): one
additive, optional, top-level list of `{kind, url, title?, at}`, merged as a union keyed
on `url`, provider-neutral, with `spec_path` left alone.
Plus the CLI to reach it:

```bash
tbd ref add <bead> <url> [--kind pr|issue|doc|design|other] [--title "..."]
tbd ref rm <bead> <url>
tbd ref ls <bead>
```

*Why in the CLI:* an agent cannot invent a storage location.
Without the field, four agents invent four conventions inside `notes` — which is
single-writer replaceable state and will silently lose them.

### E15. Wire the two dead renderers (F11, F12)

- Pass a `repoUrl` resolver at both `planMirror` call sites and in the sync engine,
  built exactly as `specUrl` already is (`integration-runner.ts:110-134` is the
  pattern): `blobUrl(slug, syncBranch, 'issues/<internal-id>.md')`. That lights up the
  managed block’s `Bead:` link and the bead-source attachment.
- Populate `prUrls` from `refs` where `kind == pr`. The renderer and its `#222`
  labelling already exist and are currently unreachable.

Both are small because the presentation was written first and only the data was missing.

### E16. Give `tbd web` an addressable bead (F13)

Read `location.hash` at load, select that bead, and write the hash on selection, so
`http://127.0.0.1:PORT/#tbd-dzme` opens the browser on one bead.
Then the managed block can name it.

A loopback URL is not shareable between machines, and that is fine — it is aimed at the
person who has the repository checked out and wants the dependency graph and full field
set that Linear structurally cannot render
([§5.4 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#54-what-each-surface-is-actually-good-at)).
Rendering `tbd web --open` beside the id gives the same affordance without pretending a
localhost link travels.

### E17. Capture the PR ref automatically

`create-or-update-pr-simple` holds the PR URL at its step 6 and currently only reports
it to the user. Have it record the ref on the beads the branch closes.
`tbd sync` can additionally resolve the current branch’s PR opportunistically via `gh`,
recording it when found and staying silent when not — a bead should never be blocked on
GitHub being reachable.

### E18. Origin and repo labels, and an origin-scoped inbound scan (F15, F16)

Apply a plain `tbd` label and a `repo`-group label (created as `repo/<name>`, Linear’s
label-group syntax) to every mirrored issue, through the status-carrier machinery that
already creates and attaches labels regardless of `mirror_labels`. The name defaults to
the GitHub repo name from the origin remote (`parseRepoSlug`), falling back to
`display.id_prefix`; `integrations.linear.repo_label` overrides it.
Label groups enforce one-per-issue, and Linear views support “is not” label filters —
both verified — so the group is queryable in both directions.
Skip inbound candidates carrying another repo’s `repo:` label — silently, before the
per-candidate claim check, so a shared scope costs nothing and reports nothing about a
sibling repo’s traffic.
Include the repo name in new claim attachments so the one-source guard’s refusal can say
who holds the claim.

This is what makes topology Mode 2 (one team, one shared project, several repos)
first-class, and it is also the human-clutter answer: `label != tbd` in any Linear view
hides all agent-synced items.

### E19. Remap safety (F17)

No migration tooling — visibility and one guard:

1. Sync report and `tbd doctor` flag linked issues whose team no longer matches the
   configured `team_key`, once, with a count.
2. Never push a workflow-state id to an issue in a different team than the one it was
   resolved from; skip the status field for that pair and say why.
3. Document remap semantics in `setup-linear`: policy changes are safe; `project` and
   `team_key` changes affect new creates only; moving existing items is a deliberate
   operation, not something sync infers.

### E9. Instruction changes

No code, and probably the highest ratio of value to effort:

- Add **Claim** to the session protocol in *all four* surfaces — `AGENTS.md` block,
  `skill-minimal`, `skill-brief`, `skill-baseline` — mirroring how the closing protocol
  is repeated (§1.4 is the evidence that repetition is what works).
- Add “claim the bead, then sync” as an explicit numbered step in `implement-beads`.
- Correct the “roughly 10%” figure, which appears in both the `setup-linear` shortcut
  and the `PRESETS` comment in `policy.ts` (F1), and state the `max_nesting` skip
  behavior so the first mirror’s output is not a surprise (F2).
- **Make `new-research-brief` open with a bead, not a document**
  ([§5.4](#54-the-workflow-this-brief-itself-failed-to-follow)): create the tracking
  epic first, point `spec_path` at the doc that is about to exist, sync so it shows up
  as *Started*, then write.
  The same edit belongs in `new-architecture-doc` and `new-plan-spec`. This brief did it
  backwards, which is the evidence that the shortcut does not ask.

* * *

## 7. Enforcement design, agent by agent

Three commands — `tbd prime`, `tbd closing`, `tbd sync` — wired to each platform’s
nearest equivalent event.
Tiers are from [§2.1](#21-what-enforcement-can-actually-mean).

| Purpose | Script | Claude Code | Codex | Cursor | Gemini CLI | Others |
| --- | --- | --- | --- | --- | --- | --- |
| Orient | `tbd prime` | `SessionStart` (T-C) | `SessionStart` (T-C) | `sessionStart` → `additional_context` (T-C) | `SessionStart` (T-C) | — |
| Re-orient after compaction | `tbd prime --brief` | `PreCompact` (T-C) | `PreCompact` (T-C) | `preCompact` (T-C) | `PreCompress` (T-C) | — |
| Checkpoint nudge | `tbd closing --check` | `PostToolUse` + `if: Bash(git commit *)` (T-C) | `PostToolUse` (T-C) | `postToolUse` (T-C) | `AfterTool` (T-C) | — |
| Closing protocol | `tbd closing` | `PostToolUse` + `git push` (T-C) **— today** | same **— today** | `postToolUse` (T-C) | `AfterTool` (T-C) | — |
| **Completion gate** | `tbd closing --check` | **`Stop` → exit 2 (T-B)** | **`Stop` → `continue:false` (T-B)** | **`stop` → `followup_message` (T-B)** | ✗ none | ✗ |
| Last-chance sync | `tbd sync` | `SessionEnd` + explicit `timeout` (T-A) | `SessionEnd` (T-A) | `sessionEnd` (T-A) | `SessionEnd` (T-A) | — |

Everything in the “Others” column falls back to instructions
([§6 E9](#e9-instruction-changes)), which is why the instruction work is not optional.

### 7.1 The gate must never trap the agent

A completion gate that blocks on “unsynced” can loop forever when sync itself is failing
— a revoked Linear key, no network egress, a rejected push.
Two constraints make it safe:

1. **Block on *inaction*, not on *failure*.** Exit 2 only when no sync has been
   *attempted* since the last bead mutation.
   If a sync ran and failed, report it via `systemMessage` and exit 0 — the agent cannot
   fix an expired credential by trying harder.
2. **Fire at most once per session.** Record a marker (session id plus sync-branch tip)
   so a second `Stop` in the same session never blocks again, whatever the agent did.

This is the same “fail loud, never fail closed” posture the tracker sync already takes
with its independent-surface failure containment.

### 7.2 Sequencing

The gate is the last thing to build, not the first.
Enforcing a protocol that agents have not been told about produces confused agents and
blocked turns. Order: fix orientation → teach the protocol → measure whether it is
followed → then gate.

* * *

## 8. Risks and failure modes

| Risk | Mechanism | Mitigation |
| --- | --- | --- |
| **Zombie claims** | An agent crashes mid-work; the bead stays `in_progress` with an assignee forever, and `tbd ready` hides it from every other agent | `tbd stale` already defaults to open + in_progress over 7 days. Add a claim-age surface in `prime` and the roll-up, and consider a shorter default for claimed beads |
| **Gate loops** | A `Stop` hook blocks on a condition the agent cannot satisfy | [§7.1](#71-the-gate-must-never-trap-the-agent) |
| **Credential sprawl** | Every agent that can sync holds a workspace-writable Linear key in its sandbox, sharing one identity and one rate-limit budget | Already flagged in [§7b.2 of the Linear brief](research-2026-08-09-linear-task-surfaces.md#7b2-what-a-second-non-git-replica-breaks). More frequent syncing raises the value of a narrower app identity |
| **Inbound prompt injection** | `field_sync.comments` defaults to `two_way`, so Linear comments land in `extensions.<provider>.comments` and are read by agents. Anyone who can comment in the workspace can write text into bead data | Body is capped and the author is a display name only, but treat pulled comments as untrusted input. Worth an explicit note in the guidance |
| **Sync-branch churn** | Frequent syncing turns `tbd changes` into noise — and F9 makes EVERY sync churn, even a quiet one | E10 (write nothing when nothing changed), then sync on transitions and commits, never on tool calls ([§3.3](#33-what-sync-on-claim-actually-costs)) |
| **Rate-limit exhaustion on a shared key** | Comment polling costs one request per linked bead per sync (F10), so a 70-bead mirror allows ~34 syncs/hour across everyone sharing the key | E11 — fetch comments only for pairs the delta moved |
| **Sync pays for the parent repo’s pre-push hook** | `pushWithRetry` pushes without `--no-verify`, so every sync fires `.git/hooks/pre-push` — here, the full test suite, and again on each retry (F5) | Push the sync branch with `--no-verify`, matching what the commit path already does deliberately |
| **Silent hook failure** | Demonstrated in this very session | E7 — fail loud, and make `doctor` execute the scripts |
| **Shared-scope cross-talk** | Two repos on one team+project: report mode advertises each other’s items as importable; auto mode fails every sync (probed — F15) | E18 origin labels + origin-scoped inbound; or topology Mode 1 (team per repo), which is structurally isolated today |
| **Remap split-brain** | Changing `team_key` leaves old links reconciling in the old team while status pushes send the new team’s state UUIDs — repeated per-item failures (F17) | E19 — detect team mismatch, never push a state id across teams, document remap semantics |
| **First-mirror surprise** | 114 selected, 70 created, 44 skipped (F2), against a 20-create bulk guard | Document it; keep the staged `--limit` rollout the `setup-linear` shortcut already prescribes |

* * *

## 9. Recommendations

The ordering changed once the costs were measured.
**Make a quiet sync actually quiet first**, because every later item — the hook, the
gate, the claim protocol — assumes syncing is cheap, and today it is not.

### Phase 0 — make a quiet sync free

The whole phase is small, local, and unblocks everything else.

1. **E10 — a quiet sync writes nothing** (F9). Write the link record only when something
   other than `synced_at` changed, or drop `synced_at` from the schema.
   Pin it with a test asserting zero bytes change under `bridge/<provider>/links/` on a
   settled re-run.
2. **F5 — push the sync branch with `--no-verify`.** Two words.
   The difference between a sync costing a second and costing a full test run.
3. **E11 — fetch comments only for pairs the delta moved** (F10). Turns `2 + N` requests
   per sync into a flat 2.
4. **E8 — cache `ensureMeta` on disk with a TTL.** Halves what remains.

Together these make a no-op sync ≈ 2 requests, 0 writes, 0 commits, 0 pushes, no hooks —
which is the precondition for treating `tbd sync` as something an agent runs constantly
rather than ceremonially.

### Phase 1 — repair the surfaces that already exist

5. **E7 — hook hardening.** Append rather than prepend the fallback PATH, prefer local
   resolution, fail loudly, and make `doctor` execute the hook scripts.
6. **E9 — instruction changes.** Add **Claim** to all four surfaces and to
   `implement-beads`; correct the “roughly 10%” figure (F1) and document the
   `max_nesting` skip (F2).
7. **E12/E13 — make the flags and comments honest.** `--issues` silently drops the
   tracker; `--push` silently does the dangerous outbound-only projection; `--dry-run`
   never previews it; `--status` never reports it; and the fold-site comment claims the
   feature is off by default when it is on.
8. Decide whether to lift this repository’s `sync_on_tbd_sync: false` pilot override.

### Phase 2 — the claim protocol and the links

9. `tbd start` (E1) and agent identity (E2).
10. `tbd prime` reports claimed work and sync freshness (E5).
11. **`refs` on beads, plus `tbd ref add/rm/ls` (E14).** The one new field, and what
    makes the rest of this phase have data to render.
12. **Wire the two dead renderers (E15).** `repoUrl` and `prUrls` are written and
    unreachable; a resolver each lights up Linear → bead source and Linear → PR.
13. Managed-block roll-up: in-flight children, actor, doc, PRs, sync timestamp (E4).
14. **Capture the PR ref automatically (E17)** from `create-or-update-pr-simple`, so the
    link appears without anyone remembering.

### Phase 3 — enforcement, selection, and the bead browser

15. `tbd closing --check` with exit-code semantics and `--json` (E6).
16. `Stop`-event gate for Claude Code and Codex, with the anti-loop constraints (§7.1).
17. Attention-based selection (E3), then narrow the default standing set to epics.
18. **Addressable beads in `tbd web` (E16)**, so the managed block has somewhere to
    point.

### Phase 4 — reach

19. A `cursor` setup surface (`.cursor/hooks.json` + `sessionStart`/`stop`).
20. A Gemini CLI surface (`settings.json` hooks; orientation only).
21. Watch OpenCode’s hook-router work; ship a plugin when the API settles.
22. Decide independently whether the GitHub adapter is worth building
    ([§5.7](#57-where-github-fits)) — `refs` covers the traceability need without it.

**If only one thing ships: E10.** It is a handful of lines, it is the difference between
“nothing changed” costing nothing and costing a commit plus a push plus a test suite,
and every other recommendation here gets cheaper behind it.

**If only one *user-visible* thing ships: `tbd start` plus the instruction repetition
(E1 + E9).** That converts every subsequent `tbd sync` — which agents already run at
session end — into a live picture of who is working on what.

**And if the goal is specifically “I can review the work from Linear”: E14 + E15.** One
new field and two resolvers close both dead click-throughs, and neither touches the sync
engine.

### 9.1 What this streamlines, in one page

The through-line of every recommendation above is the same: **move work out of the
agent’s head and out of the agent’s critical path.**

| Today the agent must… | After | Which primitive |
| --- | --- | --- |
| Remember three commands to claim a bead (`update --status`, `--assignee`, `sync`) | Run one verb: `tbd start` | E1 |
| Invent an identity string for `--assignee` | Get one resolved for it | E2 |
| Wait out a commit, a push, and a test suite on every sync | Wait ~2 s for a quiet sync | E10, F5, E11, E8 |
| Re-read the whole skill doc to recall the protocol | Read its own claimed work and sync age in `prime` | E5 |
| Know that `--issues` and `--push` behave differently toward Linear | Have flags that mean what they say | E12 |
| Be trusted to remember the protocol at all | Be reminded by a hook, and gated once at the end | E6, §6 |
| Mirror 114 beads to give a human visibility | Mirror ~37 and roll the rest up | E3, E4 |
| Paste PR and doc links into a bead by hand, or lose them | `tbd ref add`, and the PR ref captured automatically | E14, E17 |
| Tell a reviewer where to look, in prose | Hand them one Linear issue that links to the doc, the PR, and the bead | E15, E16 |
| Write a research doc and remember afterwards to track it | Start from the bead; docs, specs, and PRs attach to it as they appear | E9, E14 |

Two things this deliberately does **not** add, because they would cost more complexity
than they buy:

- **No background sync daemon.** Once a quiet sync is two requests and no writes,
  calling it inline on transitions is simpler than owning a process lifecycle, and it
  keeps the “opportunistic single-writer through git” property that makes concurrent
  agents safe.
- **No new bead fields for presence.** `status` and `assignee` already carry it.
  Adding a presence namespace would mean new merge semantics for something the existing
  fields express, and §7b.4’s discipline (claim before write, one writer per bead) works
  precisely because those fields are single-writer.

* * *

## 10. Open questions

1. **Should `tbd start` sync by default?** Syncing on claim is what makes Linear live,
   but it makes a local bookkeeping command touch the network.
   `--sync` opt-in is safer; `--no-sync` opt-out is more likely to produce the desired
   behavior.
2. **Does `specs: active` belong in the `default` preset?** It is the clause producing
   the 45% (F1). Excellent for a spec-driven repository, wrong as a universal default.
3. **Should closed beads leave the mirror?** Links persist deliberately, so the Linear
   issue survives at *Completed*. Over years that accretes.
   Is archival a tbd concern or a Linear housekeeping concern?
4. **Do harness task lists and beads want binding?** Claude Code’s `TaskCreated` and
   `TaskCompleted` are blocking events.
   Tempting, but it couples bead state to one vendor’s ephemeral to-do UI.
5. **What is the right claim TTL?** `tbd stale`’s 7 days is right for open work and far
   too long for “an agent is actively holding this.”
6. **How should the gate behave for subagents?** `SubagentStop` can block, but a
   subagent usually should not sync — its parent should.
7. **Is `synced_at` worth keeping at all?** It is the sole cause of F9’s churn and is
   never read for correctness.
   If something does want “when did this last reconcile”, the git commit time of the
   record answers it without writing every run.
8. **Does Linear always bump `Issue.updatedAt` when a comment is added?** E11’s
   delta-gated comment fetch depends on it.
   The live-QA runner is the place to prove it; if it does not hold, a periodic full
   comment reconcile is the fallback.
9. **Should the tracker be part of the `--issues` surface rather than its own?** Beads
   and their mirror are arguably one logical thing, and merging them would remove the
   surprise in F6 rather than documenting it.
10. **Should an *inherited* `spec_path` select a bead for mirroring?** §5.3 shows the
    `specs: active` clause really means “every descendant of every spec-carrying epic.”
    Selecting only the bead that carries the spec would cut the mirror sharply and
    probably match what people expect the rule to say.
11. **Should `spec_path` be renamed, or joined by `doc_path`?** It already accepts any
    repository path and propagates usefully, but the name stops agents from pointing it
    at research or architecture docs.
    A rename is a format concern; an alias is not.
12. **Should `refs` be pushed to the tracker as native links?** Linear attachments would
    make PRs first-class in its UI rather than lines in a description block.
    That is a nicer result and a larger surface: attachments are already used for the
    bead metadata carrier, so the interaction needs thought.
13. **Should the claim URL carry repo identity?** `tbd://bead/<displayId>` is both the
    idempotency key and the cross-repo claim, and it embeds a per-repo display prefix.
    Adding the repo name (or using the internal ULID, which is globally unique) makes
    claims unambiguous — but the URL is the upsert key, so changing its format must
    tolerate items carrying the old form.
14. **Is a team-per-repo (Mode 1) recommendation acceptable to teams?** It is the only
    structurally isolated topology and works today, but Linear teams carry membership
    and ceremony that a small repo may not merit.
15. **Should `mirror_labels: false` come with bulk label removal?** The schema comment
    promises prefixed labels are “removable in bulk if someone turns the option off
    again”, and no command does it.

* * *

## References

### Agent platform hook surfaces

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) — event list,
  matcher semantics, JSON output fields, exit-code behavior
- [Codex hooks](https://learn.chatgpt.com/docs/hooks) — event list, config layers,
  `[features] hooks`, `additionalContextLimit`, trust requirement
- [Cursor agent hooks](https://cursor.com/docs/agent/hooks) — `.cursor/hooks.json`,
  `sessionStart` `additional_context`, `stop` `followup_message`
- [Gemini CLI hooks reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)
  — `settings.json` hooks, `hookSpecificOutput.additionalContext`
- [OpenCode plugins](https://opencode.ai/docs/plugins/) — TypeScript plugin API
- [OpenCode issue #39275](https://github.com/anomalyco/opencode/issues/39275) — proposed
  `PreToolUse`/`Stop`/`SessionStart` hook router

### tbd source read for this audit

- `packages/tbd/src/integrations/core/selection.ts` — `mirrorSet`, the status gate
- `packages/tbd/src/integrations/core/mirror.ts` — `planMirror`, nesting skip,
  attachments
- `packages/tbd/src/integrations/core/managed-block.ts` — `renderManagedBlock`
- `packages/tbd/src/integrations/core/sync-engine.ts` — the seven-step run
- `packages/tbd/src/cli/lib/integration-runner.ts` — folding into `tbd sync`
- `packages/tbd/src/cli/commands/sync.ts` — surface independence, `sync_on_tbd_sync`
- `packages/tbd/src/cli/commands/prime.ts` — the orientation payload
- `packages/tbd/src/integrations/linear/adapter.ts` — `ensureMeta` caching,
  `fetchUpdatedSince`
- `packages/tbd/src/lib/issue-selection.ts` — “ready” means unclaimed
- `.claude/scripts/tbd-session.sh`, `.codex/tbd-session.sh` — the session hooks

### Internal

- [Linear as a Task Surface for Beads and Agents](research-2026-08-09-linear-task-surfaces.md)
- [External Tracker Integrations](../../specs/active/plan-2026-08-10-external-tracker-integrations.md)
- [Modernize multi-agent skills and hooks setup](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
- [How Coding Agents Listen On and Monitor Issues](research-2026-06-04-agent-issue-monitors.md)
- [Agent Coordination Kernel](research-agent-coordination-kernel.md)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
