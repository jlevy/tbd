# Research Brief: Agent and Session Identity Across Coding Agents

**Last Updated**: 2026-08-14

**Status**: Draft

**Related**:

- [research-2026-08-14-agent-sync-protocol-and-hooks.md](./research-2026-08-14-agent-sync-protocol-and-hooks.md)
  — the sync/hook protocol research this brief branches from; its §1.6 ("Linear lacks an
  actor") is the immediate motivation
- [plan-2026-08-14-external-sync-and-traceability.md](../../specs/active/plan-2026-08-14-external-sync-and-traceability.md)
  — the phased plan; agent identity is a Phase 1 candidate
- [plan-2026-01-19-transactional-mode-and-agent-registration.md](../../specs/active/plan-2026-01-19-transactional-mode-and-agent-registration.md)
  — an earlier, unimplemented design for `tbd agent register`
- [research-agent-coordination-kernel.md](./research-agent-coordination-kernel.md) —
  multi-agent coordination context
- [research-2026-08-09-linear-task-surfaces.md](./research-2026-08-09-linear-task-surfaces.md)
  — §6.4a surveys the Linear agent ecosystem

* * *

## Executive Summary

tbd cannot say who did anything.
A bead’s `assignee` is a free-text string that nothing sets automatically; the bridge
records that link beads to Linear carry no actor; and a git commit made by an agent is
attributed to whatever `user.name` the harness happened to configure.
When three agents and a human work the same repo across a week, the record of *what*
changed is complete and the record of *who* changed it is empty.
That is the gap this brief investigates.

The investigation was deliberately ordered: survey how the ecosystem already handles
agent and session identity *before* designing anything for tbd.
The survey covers six coding-agent harnesses (Claude Code, Codex CLI, Cursor, Gemini
CLI, OpenCode, GitHub Copilot’s coding agent), two platform-side identity models (Linear
app users, GitHub Apps), and three standards efforts (OpenTelemetry GenAI conventions,
A2A AgentCards, SPIFFE/AIMS).

The headline finding is that **every harness already mints a session identifier, every
harness already knows its own model and version, and almost none of them tell the model
any of it.** The identity data exists and is handed to *hooks* — as JSON on stdin —
while the agent itself, the thing that would write an attribution, is left ignorant.
Claude Code, Codex, and Cursor all pass `session_id` (Cursor: `conversation_id`), `cwd`,
and `transcript_path` to every hook; Cursor and Codex additionally pass `model` on every
event, and Claude Code’s status line receives a fuller record still — `model.id`,
`model.display_name`, `version`, `workspace.project_dir`, and
`workspace.repo.{host,owner,name}`. Meanwhile there are open upstream issues on Claude
Code, Codex, and OpenCode all asking the same question — *how does a running session
learn its own ID?* — and a third-party OpenCode plugin exists for no purpose other than
telling an agent its own name.

That asymmetry is the design opening.
tbd already installs a `SessionStart` hook, and that hook currently ignores stdin
entirely. The identity payload is being delivered to tbd’s own script today and thrown
away.

A second finding shapes the ID format.
Session IDs are opaque UUIDs, harness-scoped, and not portable: a Claude Code session ID
means nothing to Codex, and Codex calls the same concept a `thread_id`. Any
cross-harness identity has to be minted by tbd, with the harness’s native ID recorded as
a *foreign key* rather than used as the identity.
And because agent IDs would be minted independently on many machines with no
coordination until push, they cannot borrow the trick that makes tbd’s 4-character bead
display IDs safe — registry-checked allocation under a lock.

The resolution is to reuse tbd’s *internal* ID tier rather than its display tier:
`agid-{ulid}`, the same shape as `is-{ulid}` with a different prefix, carrying 80 bits
of randomness and needing no registry to be safe.
The friendly slugified name is then joined onto that canonical ID through the record,
which lets the name be brief, repeatable, and renameable without ever changing identity.
Storage follows the one-file-per-entity layout the sync branch already uses for issues
and bridge links. §5 works this through, including a measured defect in the flat
`ids.yml` layout that the per-entity layout avoids by construction.

**Research Questions**:

1. What identity does each major coding-agent harness assign to a session, and in what
   form is it exposed — environment variable, hook payload, CLI flag, or nothing at all?

2. What does each harness know about its own model, version, and environment, and how
   much of that is reachable from a subprocess?

3. How do platforms outside the CLI (Linear, GitHub) model a durable agent identity, and
   how does that relate to a transient session?

4. What conventions exist for identifier format — prefixed IDs, sortable IDs, memorable
   names — and what entropy does uncoordinated minting actually require?

5. Given all of the above, what shape should a tbd agent identity take, and what would
   it cost to carry one?

* * *

## Research Methodology

### Approach

Three passes, in order:

1. **Primary-source documentation review** of each harness’s hooks, session, telemetry,
   and CLI reference pages, plus the specification texts for A2A, MCP transports,
   TypeID, and the OpenTelemetry GenAI conventions.

2. **Direct measurement** inside a live Claude Code session running in a remote cloud
   container: the full environment block, the transcript path, the git commit trailers
   this repo already produces, and the tbd source tree.

3. **Codebase audit** of tbd itself — what identity it records today, what was designed
   and never built, and what framework already exists to reuse.

Where documentation and measurement disagreed, both are reported.
That happened once and it matters: `CLAUDE_CODE_SESSION_ID` is present in this
container’s environment but is **not** in the documented environment variable list, and
there is an open upstream issue asserting a running session has no access to its ID. The
variable is therefore treated in this brief as observed-but-unsupported, not as an
interface.

### Sources

Official documentation for Claude Code, Cursor, Codex CLI, Gemini CLI, OpenCode, and
Linear’s agent APIs; the A2A protocol specification and MCP transport specification; the
TypeID specification and ULID/UUIDv7 references; the OpenTelemetry GenAI semantic
conventions repository; upstream issue trackers for `anthropics/claude-code`,
`openai/codex`, and `anomalyco/opencode`; and the tbd source tree at `packages/tbd/src`.

* * *

## Part 1 — Where tbd Stands Today

### 1.1 tbd records no actor

**Status**: ✅ Complete (measured)

**Details**:

- `assignee` is `z.string().nullable().optional()`
  (`packages/tbd/src/lib/schemas.ts:196`). It is free text with no validation, no
  vocabulary, and no default.

- Nothing sets it automatically.
  The only writers are explicit: `--assignee` on `tbd update` (`update.ts:741`), the
  bulk path (`update.ts:394`), and frontmatter import (`update.ts:573`).

- The field is deliberately excluded from tracker sync —
  `assignee: FieldFlowRule.default('local')` (`schemas.ts:480`) — because “tracker
  assignees are people” (`schemas.ts:468`). That comment encodes an assumption worth
  revisiting: it is exactly the assumption that leaves an agent’s work unattributed in
  Linear.

- Bridge link records carry `type`, `bead_id`, `external_id`, `base`,
  `remote_updated_at`, `state`, and `synced_at`. No actor field exists.

- A repo-wide grep for `CLAUDECODE`, `CLAUDE_CODE`, `CURSOR`, `CODEX_SESSION`,
  `agent_id`, or `agentId` in `packages/tbd/src` returns **no identity detection
  whatsoever**. The only `CODEX_*` matches are filesystem path constants for writing
  `.codex/hooks.json`, and `paths.ts:218` explicitly notes its sandbox handling “does
  not depend on any `CODEX_*` env var.”

**Assessment**: The gap is total, not partial.
There is no half-built actor concept to extend — which is good news for design freedom
and bad news for effort estimation.

* * *

### 1.2 `tbd agent register` was designed in January and never built

**Status**: ✅ Complete (measured)

An earlier spec, `plan-2026-01-19-transactional-mode-and-agent-registration.md`, already
proposed most of an agent identity system:

```
tbd agent register [--name <name>]   # Register agent, get unique ID
tbd agent status                     # Show current agent registration
tbd agent unregister                 # Clear agent registration
```

with an ID format of `ag-{slugified-name}-{ulid}`, for example
`ag-claude-code-cloud-01hx5zzkbkactav9wevgemmvrz`, stored in a gitignored
`.tbd/agent.yml`.

Neither `packages/tbd/src/cli/commands/agent.ts` nor `packages/tbd/src/file/agent.ts`
exists. The command is absent from the CLI. The design was never implemented.

**Assessment**: Three things in that older design are worth keeping and one is worth
discarding.

Keep: the `tbd agent` command surface; the working-directory-scoped state file; the
instinct to pair a human-meaningful name with machine-unique entropy.

Discard: `ag-{slugified-name}-{ulid}` as the *ID*. A 45-character identifier that embeds
a mutable slug is neither memorable nor stable — renaming the agent would change its ID.
The name and the ID want to be separate fields, which is precisely the “model agent
information as more than a name” instinct the current design sketch starts from.

Also note the older design gitignores the state file.
That is the opposite of the explore direction in Part 10, and the tension is real: a
*current-session pointer* is machine-local and belongs in `.gitignore`; a *historical
record of which agent did what* is shared state and belongs in the sync branch.
Those are two different files, and conflating them is what makes the question feel hard.

* * *

### 1.3 The session hook already runs, and already discards the identity it is handed

**Status**: ✅ Complete (measured)

tbd installs a `SessionStart` hook for Claude Code (`setup.ts:299-314`) and the
equivalent for Codex (`setup.ts:451`), both invoking `.claude/scripts/tbd-session.sh` /
`.codex/tbd-session.sh`. The script body (`setup.ts:265-292`) is:

```bash
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"
if command -v tbd &> /dev/null; then
    tbd prime "$@"
    exit $?
fi
# ... pinned npx fallback ...
```

It reads `"$@"` and never reads stdin.
But **stdin is where the identity is**: Claude Code writes
`{"session_id": ..., "transcript_path": ..., "cwd": ..., "permission_mode": ..., "hook_event_name": "SessionStart", "source": "startup"}`
to that script’s stdin on every session start, and Codex writes a payload including
`session_id`, `cwd`, `model`, and `source` to its equivalent.

**Assessment**: This is the single most important structural finding in the brief.
tbd does not need to invent a delivery mechanism, negotiate with a harness, or scrape a
transcript. The identity payload is already being piped into a tbd-authored script at
exactly the moment a session begins, and the script closes the pipe unread.
Whatever tbd decides to do with agent identity, the plumbing is one `cat`-and-parse away
in the file tbd already owns.

The one caveat is that `tbd prime` is also invoked on `PreCompact` with `--brief`, and
Claude Code fires `SessionStart` again with `source: "resume"`, `"clear"`, `"compact"`,
or `"fork"`. An identity assignment triggered here must be idempotent per session ID, or
a long session will mint several agent IDs for one agent.

* * *

### 1.4 tbd already has the two-tier ID framework, and its internal tier transfers directly

**Status**: ✅ Complete (measured)

tbd’s existing scheme (`lib/ids.ts`, `file/id-mapping.ts`):

| Tier | Format | Example | Where it lives |
| --- | --- | --- | --- |
| Internal | `is-{26-char ULID}` | `is-01hx5zzkbkactav9wevgemmvrz` | Issue file frontmatter, `parent_id`, `dependencies`, and the issue *filename* |
| Display | `{prefix}-{4 base36}` | `tbd-a7k2` | CLI input and output |

The internal ID is generated by `generateInternalId()` (`ids.ts:104`) from a
`monotonicFactory()` ULID: a 48-bit millisecond timestamp plus **80 bits of
randomness**, lowercased, prefixed `is-`. Nothing consults a registry to mint it,
because nothing needs to — a collision requires two agents to draw the same 80 random
bits inside the same millisecond.

The display ID is the tier that needs coordination.
`generateShortId()` (`ids.ts:115`, `randomBytes` modulo 36) runs inside a
**retry-until-free loop against the loaded mapping** (`generateUniqueShortId`,
`id-mapping.ts:232-251`), which also widens 4 → 5 characters past 50,000 issues
(`calculateOptimalLength`, `id-mapping.ts:219`). The mapping is a checked-in registry at
`.tbd/data-sync/mappings/ids.yml` — a flat `short: ulid` map, 1,737 entries in this repo
— saved under a lockfile with read-merge-write and an **append-only guard** that refuses
any write that would shrink the file (`id-mapping.ts:154-160`).

**Assessment**: The framework transfers, and the split between its two tiers is exactly
the split an agent identity needs.
The internal tier is already uncoordinated-safe by construction and can be reused with
nothing but a different prefix.
The display tier is the one that assumes a registry was consulted before the ID was
handed out — an assumption that holds when one repo’s lockfile serializes every
allocation, and does not hold for identities minted independently at session start on
many machines.

The consequence is not that the framework fails, but that the *identity* must live in
the tier that already survives uncoordinated minting, with the friendly form demoted to
a label on top of it.
§5 works that through.

* * *

## Part 2 — Harness Survey

### 2.1 Claude Code

**Status**: ✅ Complete (documentation + direct measurement)

**Session identity**:

- Every hook receives on stdin: `session_id`, `prompt_id` (a UUID per user prompt,
  absent until first input), `transcript_path`, `cwd`, `permission_mode`,
  `hook_event_name`, and `effort.level`.

- Hooks firing inside a subagent additionally receive `agent_id` and `agent_type` (for
  example `"Explore"` or a custom agent name).

- `SessionStart` carries `source`: one of `startup`, `resume`, `clear`, `compact`,
  `fork`. `SessionEnd` carries a `reason`.

- Transcripts live at `~/.claude/projects/<project>/<session-id>.jsonl`, where
  `<project>` is the working directory path with non-alphanumeric characters replaced by
  `-`. **The session ID is the transcript filename**, which makes the working directory
  ↔ session binding explicit in the filesystem layout.

- `claude -p --output-format json` returns the session ID in its structured result.
  `claude --resume <session-id>` resumes by ID from any directory.
  `--fork-session` and `/branch` mint a *new* session ID for the copy.

**Model and environment**:

- The status line command receives the richest payload of any surface surveyed:

```json
{
  "cwd": "...", "session_id": "...", "session_name": "...", "prompt_id": "...",
  "transcript_path": "...",
  "model": { "id": "claude-opus-5", "display_name": "Opus" },
  "workspace": {
    "current_dir": "...", "project_dir": "...", "added_dirs": [],
    "git_worktree": "feature-xyz",
    "repo": { "host": "github.com", "owner": "anthropics", "name": "claude-code" }
  },
  "version": "2.1.90",
  "output_style": { "name": "default" },
  "agent": { "name": "..." },
  "worktree": { "name": "...", "path": "...", "branch": "...", "original_cwd": "..." }
}
```

- Hooks get less. `model` is available on `SessionStart` but **is not guaranteed to be
  present**, and there is no `$CLAUDE_MODEL` environment variable.

**Environment variables** (documented as set by Claude Code): `CLAUDECODE=1` in every
spawned subprocess; `CLAUDE_PROJECT_DIR`; `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA`;
`CLAUDE_CODE_REMOTE`; `CLAUDE_CODE_BRIDGE_SESSION_ID` (the `session_`-prefixed Remote
Control ID, matching the `claude.ai/code` URL); `CLAUDE_EFFORT`;
`CLAUDE_CODE_CHILD_SESSION`.

Claude Code **strips `OTEL_*` exporter variables** from every subprocess it spawns,
hooks included — which forecloses one otherwise-obvious channel for passing telemetry
context down.

**Measured, undocumented**: this container’s environment additionally carries
`CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_VERSION`, `CLAUDE_CODE_ENTRYPOINT`,
`CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_ORGANIZATION_UUID`, `CLAUDE_CODE_USER_EMAIL`,
`CLAUDE_CODE_REMOTE_SESSION_ID`, `CLAUDE_CODE_CONTAINER_ID`,
`CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE`, `ANTHROPIC_MODEL`, and
`CLAUDE_CODE_SUBAGENT_MODEL`. The measured `CLAUDE_CODE_SESSION_ID` value equals the
transcript filename exactly.
But `CLAUDE_CODE_SESSION_ID` does not appear in the documented list, and upstream issue
`anthropics/claude-code#44607` ("No way to access session ID from within a running
session") indicates it is not a general interface.
Several of these look specific to the cloud/remote runner.
**Do not build on them.**

**Telemetry attributes** (the closest thing to a declared identity schema):
`session.id`, `user.id` (random anonymous, generated on first run), `user.account_uuid`,
`user.account_id` (tagged form, e.g. `user_01BWBeN28...`), `user.email`,
`organization.id`, `app.version`, `app.entrypoint` (`cli`, `sdk-ts`, `claude-vscode`),
`terminal.type`; plus per-event `prompt.id`, `message.uuid`, `client_request_id`,
`workflow.run_id` (prefixed `wf_`).

**Naming**: Claude Code names sessions.
Unnamed interactive sessions get a default display name combining the working directory
with a two-character suffix — `my-app-3f`. Named sessions that collide get a two-word
suffix appended — `auth-refactor-graceful-unicorn`. Both are relevant prior art for Part
5: Anthropic independently arrived at *directory name + short entropy* and at
*adjective-noun disambiguation*.

**Assessment**: The most identity-rich harness surveyed, but the richness is unevenly
distributed — the status line sees everything, hooks see a useful subset, and the model
sees nothing. A single session also has **at least three IDs simultaneously** in this
environment (local UUID, `cse_`-prefixed remote ID, `session_`-prefixed bridge ID
sharing the remote ID’s suffix), which is a caution against treating “the session ID” as
singular.

* * *

### 2.2 Codex CLI

**Status**: ✅ Complete (documentation)

**Session identity**:

- Sessions are persisted as *rollout files*: `~/.codex/sessions/rollout-*.jsonl`, with
  an internal `session_id` auto-generated at start.
  Resuming appends to the existing file and **keeps the same session ID**, so a Codex
  session ID survives resume where a Claude Code fork does not.

- `codex exec --json` emits newline-delimited events beginning with
  `{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}`. Note
  the vocabulary shift: the machine-readable stream calls it `thread_id`, the storage
  layer calls it `session_id`.

- `codex resume --last`, `codex resume <session-id>`, `codex exec resume <SESSION_ID>`.

**Hooks**: `.codex/hooks.json` uses the same event vocabulary as Claude Code.
Every command hook receives `session_id`, `transcript_path` (nullable), `cwd`,
`hook_event_name`, and — unlike Claude Code — **`model` on every event**, not just
`SessionStart`. `SessionStart` adds `source` (`startup` / `resume` / `clear`) and
`permission_mode`. A legacy `--notify` path predates `hooks.json` and uses a different
envelope with `session_id`, `cwd`, and `triggered_at`.

**Environment**: `CODEX_HOME` relocates the user-level directory (config, credentials,
`history.jsonl`, the SQLite state database).
Critically, **no dedicated environment variables are set during hook execution** — there
is no `CODEX_PROJECT_DIR` analogue to `CLAUDE_PROJECT_DIR`, and all context arrives via
stdin JSON. Upstream issue `openai/codex#8923` requests exactly the missing piece:
“expose current Codex session ID programmatically (env var or JSON).”

**Assessment**: Codex is the cleanest argument for treating **hook stdin as the only
portable identity channel**. It sets no hook environment variables at all, so any tbd
mechanism that depends on env vars works on Claude Code and Cursor and silently does
nothing on Codex. Its inclusion of `model` on every hook event is also the single most
useful divergence found — Codex tells you what model is running more reliably than
Claude Code does.

* * *

### 2.3 Cursor

**Status**: ✅ Complete (documentation)

**Session identity**: Cursor’s base payload — delivered to *every* hook — is the most
complete of the three stdin-based harnesses:

```
conversation_id, generation_id, model, model_id, model_params,
hook_event_name, cursor_version, workspace_roots, user_email, transcript_path
```

`conversation_id` is documented as “a stable ID of the conversation across many turns”;
`generation_id` changes with each user message, making it Cursor’s analogue of Claude
Code’s `prompt_id`. `workspace_roots` is a **list**, not a single directory — Cursor
models multi-root workspaces natively, which no other surveyed harness does.

Subagent events carry `subagent_id`, `subagent_type`, `parent_conversation_id`,
`subagent_model`, `is_parallel_worker`, and optionally `git_branch`.

**Configuration**: `.cursor/hooks.json` at project level, `~/.cursor/hooks.json` at user
level, with enterprise and team layers above.
Event names are camelCase (`beforeShellExecution`, `afterFileEdit`, `stop`) rather than
Claude Code’s PascalCase.

**Environment**: `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`,
`CURSOR_TRANSCRIPT_PATH`, `CURSOR_CODE_REMOTE` — **and `CLAUDE_PROJECT_DIR` as a
documented compatibility alias.**

**Known defect**: a community report describes hooks intermittently emitting empty
`conversation_id` / `session_id` on tool-execution events.
Any consumer must tolerate a blank ID rather than assume presence.

**Assessment**: Cursor exposes the most per-event identity of any harness and is the
only one that names the model, the model parameters, the harness version, and the user
in the same payload.
The `CLAUDE_PROJECT_DIR` alias is quiet evidence that Claude Code’s environment contract
is becoming a de facto convention — the same way `AGENTS.md` became one for
instructions.

* * *

### 2.4 Gemini CLI

**Status**: ✅ Complete (documentation)

Gemini CLI has no hook system comparable to the three above.
Its identity surface is **telemetry only**: OpenTelemetry-based, attaching `session.id`,
`installation.id`, `active_approval_mode`, and `user.email` (when authenticated) as
common attributes on all logs and metrics.

There is no supported way to read the session ID from inside a session.
Upstream issue `google-gemini/gemini-cli#8944` asks for one; the documented workaround
is to write telemetry to a local file and parse it back out:
`--telemetry-target=local --telemetry-outfile=tmp.txt`.

**Assessment**: The floor case.
Any tbd design must degrade gracefully to “harness known, session unknown” — and Gemini
CLI is the concrete reason that degradation path has to exist rather than being
hypothetical. Its `installation.id` is also worth noting: a *stable per-installation*
identifier is a different and arguably more useful primitive than a per-session one for
answering “which machine was this.”

* * *

### 2.5 OpenCode

**Status**: ✅ Complete (documentation + community sources)

OpenCode tracks `SessionID` and `ParentSessionID` internally, in Go context and SQLite.
Plugins (TypeScript) subscribe to `session.created`, `session.deleted`,
`session.status`, `session.updated`.

Three open feature requests define the gap precisely:

- `#12324` — “Inject current session ID into Plan/Build agent system prompts”: the
  agents “have no awareness of the unique session ID they are running in.”
- `#12916` — allow setting a custom session ID at creation.
- `#12930` — forward session and parent-session IDs as HTTP headers on LLM API requests.

Most telling is a third-party plugin, `gotgenes/opencode-agent-identity`, which exists
solely because “when a user switches agents mid-session, the newly active agent has no
built-in way to know its own name.”
It works by reading `info.agent` from the last user message and appending an identity
statement to the system prompt, with state keyed by session ID.

**Assessment**: OpenCode is the clearest demonstration that **agents not knowing who
they are is a recognized, independently-solved problem**, and that the working solution
is to *inject the identity into the prompt*. That is the same shape as Claude Code’s
`SessionStart` `additionalContext` and Codex’s `hookSpecificOutput.additionalContext` —
and it is the mechanism tbd would use.

* * *

### 2.6 GitHub Copilot coding agent

**Status**: ✅ Complete (documentation + community sources)

Copilot’s identity model is entirely platform-side, not session-side.
Attribution happens through the git trailer
`Co-authored-by: Copilot <copilot@github.com>`, controlled by the VS Code setting
`git.addAICoAuthor` with values `off`, `chatAndAgent`, and `all`.

The rollout is instructive as a cautionary tale: version 1.117 changed the default to
`all`, attaching AI co-authorship to commits containing any AI-generated code, and drew
substantial developer backlash over silent injection of attribution into commits that
were not substantially AI-authored.

**Assessment**: Two lessons.
First, **git trailers are the established medium for agent attribution** — no new
mechanism needed, and this repository already uses them (see 3.6). Second, attribution
defaults are contentious; anything tbd writes into a commit or a tracker should be
predictable, explainable, and configurable, and probably should not describe work that
the agent did not do.

* * *

### 2.7 Comparison

| Capability | Claude Code | Codex CLI | Cursor | Gemini CLI | OpenCode |
| --- | --- | --- | --- | --- | --- |
| Session ID to hooks | `session_id` | `session_id` | `conversation_id` | — (none) | — (plugin API) |
| Per-turn ID | `prompt_id` | — | `generation_id` | — | — |
| Model in hook payload | `SessionStart` only, not guaranteed | **every event** | **every event** (+ `model_id`, `model_params`) | — | via plugin |
| Harness version | status line (`version`) | — | `cursor_version` | — | — |
| Working directory | `cwd`, `CLAUDE_PROJECT_DIR` | `cwd` (stdin only) | `workspace_roots` (list), `CURSOR_PROJECT_DIR` | — | — |
| Transcript path | `transcript_path` | `transcript_path` (nullable) | `transcript_path` (nullable) | — | SQLite |
| Subagent identity | `agent_id`, `agent_type` | — | `subagent_id`, `subagent_type`, `parent_conversation_id` | — | `ParentSessionID` |
| Hook env vars set | several | **none** | several (+ Claude alias) | n/a | n/a |
| ID stable across resume | no (fork mints new) | **yes** | n/a | n/a | n/a |
| Agent can read own ID | no (issue #44607) | no (issue #8923) | no | no (issue #8944) | no (issue #12324) |
| Context injection back | `additionalContext` | `additionalContext` | stdout response | — | system prompt transform |

**Strengths/Weaknesses Summary**:

- **Claude Code**: richest total surface, but split across three tiers (status line >
  hooks > model). Session ID is unstable across forks.
- **Codex CLI**: most reliable model reporting and the only stable-across-resume session
  ID; zero hook environment variables, which forces stdin-only designs.
- **Cursor**: best per-event payload and the only multi-root workspace model;
  intermittent empty-ID defect.
- **Gemini CLI**: telemetry-only, no practical in-session identity.
  Sets the floor.
- **OpenCode**: internally rich, externally unexposed; the community has already built
  the workaround.

* * *

## Part 3 — Cross-Cutting Findings

**A1 — Every harness mints a session ID; none of them agree on what to call it.**
`session_id` (Claude Code, Codex), `conversation_id` (Cursor), `thread_id` (Codex
`--json`), `SessionID` (OpenCode), `session.id` (Gemini telemetry).
The concept is universal; the name, format, and lifetime are not.

**A2 — The identity is delivered to hooks, not to the model.** This is the structural
asymmetry the whole brief turns on.
Hooks receive rich JSON on stdin.
The agent — the component that would actually write an attribution into a bead or a
commit — receives nothing unless a hook injects it back as context.

**A3 — Every major harness has an open issue asking for in-session identity access.**
`anthropics/claude-code#44607`, `openai/codex#8923`, `google-gemini/gemini-cli#8944`,
`anomalyco/opencode#12324`. Four independent trackers, one request.
This is an unmet need across the ecosystem, not a tbd-specific gap.

**A4 — Session IDs are opaque and harness-scoped, so they cannot be *the* identity.** A
Claude Code UUID has no meaning to Codex.
They are excellent *foreign keys* — record them, correlate on them, resume with them —
and unusable as a cross-harness primary key.
Any portable identity must be minted by the tool that spans harnesses.
For this repo, that tool is tbd.

**A5 — One logical session can carry several IDs at once.** Measured directly here: a
local UUID (`46cf599f-…`), a remote session ID (`cse_01GF8v1Vyc…`), and a bridge/URL ID
(`session_01GF8v1Vyc…`) sharing the remote ID’s suffix under a different prefix.
A data model with a single `session_id` field will lose information.
A map of `{kind: value}` will not.

**A6 — Session IDs are not stable under the operations agents actually perform.** Claude
Code forks and `/branch` mint new IDs.
Compaction fires `SessionStart` again.
`/clear` starts a new conversation.
Codex resume, by contrast, preserves the ID. Anything keyed on session ID must be
idempotent under re-firing and tolerant of one agent-in-the-human-sense spanning several
session IDs.

**A7 — Working directory is the one binding every harness makes explicit.** `cwd` in
Claude Code and Codex payloads; `workspace_roots` in Cursor; `CLAUDE_PROJECT_DIR` and
`CURSOR_PROJECT_DIR`; and in Claude Code the project directory is literally encoded in
the transcript storage path.
The design sketch’s requirement — “it also needs to be assigned to a particular working
directory” — matches how every harness already thinks.

**A8 — Prefixed, tagged identifiers are the ambient convention.** `toolu_01ABC123`,
`user_01BWBeN28`, `wf_`-prefixed workflow runs, `session_`/`cse_` session IDs,
`asst_5j66UpCpwteGg4YSxUnt7lPY` in the OTel example, `spiffe://` URIs, and TypeID’s
formal `prefix_suffix` specification.
A prefixed `agid-` form is squarely conventional, and tbd’s own `is-` / `tbd-` scheme
already follows it.

**A9 — Platform-side agent identity is durable; session identity is transient.
They are different objects.** Linear app users and GitHub Apps persist across runs, hold
permissions, and appear in filters.
Session IDs live for hours.
Conflating them produces either a name too generic to be useful or an identity too
ephemeral to filter on.
A workable model needs both, linked.

**A10 — Attribution’s established medium is the git trailer.** Copilot uses
`Co-authored-by: Copilot <copilot@github.com>`. This repository’s own commits already
carry both an attribution trailer and a *session link*:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GF8v1VycQoBxB1s2C2LQri
```

That second line is the pattern the explore direction in Part 10 generalizes: a durable,
resolvable pointer from an artifact back to the session that produced it, written at the
moment of the work.

**A11 — The OTel GenAI conventions are the nearest thing to a schema, and they model an
agent as more than a name.** `gen_ai.agent.id` (unique identifier, e.g.
`asst_5j66UpCpwteGg4YSxUnt7lPY`) and `gen_ai.agent.name` (human-readable, provided by
the application, e.g. “Math Tutor”) are **separate attributes**, alongside
`gen_ai.conversation.id` for a single conversation and a proposed `session.id` for
multi-conversation sessions.
The ecosystem has already concluded that ID, name, and conversation are three fields,
not one — which independently corroborates the “more than a name” instinct.

**A12 — Cryptographic agent identity is a real and separate layer.** SPIFFE issues SVIDs
with `spiffe://trust-domain/path` subjects; the March 2026 IETF AIMS draft composes
SPIFFE, WIMSE, and OAuth 2.0 rather than inventing new protocols; A2A publishes
AgentCards at `/.well-known/agent-card.json` carrying name, description, provider, and
security requirements, with some deployments binding W3C DIDs.
**None of this is what tbd needs.** tbd needs *bookkeeping* identity — who did this,
with what, when — not *authentication* identity.
The distinction is worth stating explicitly so the design is not over-scoped: a tbd
agent ID is a label, not a credential, and it must never be treated as one.
It is self-asserted and trivially forgeable, and any future authorization decision must
rest on the underlying git, GitHub, or Linear credential, not on `agid-…`.

* * *

## Part 4 — Platform-Side Identity

### 4.1 Linear

**Status**: ✅ Complete

Linear’s model is the most developed of any tracker surveyed:

- **App users.** An agent installed in a workspace becomes a first-class member: “Agents
  behave similar to other users in a workspace.
  They can be @mentioned, delegated issues through assignment, create and reply to
  comments, collaborate on projects and documents.”
  Name and icon come from the OAuth application’s configuration.

- **`actor=app` OAuth.** Adding `actor=app` to the authorization URL makes all mutations
  attributable to the app itself rather than to an impersonated user.
  The setting is bound to the authorization and its access token.

- **Scopes.** `app:assignable` lets the app be assigned as a delegate on issues and made
  a project member; `app:mentionable` lets it be @mentioned in issues, documents, and
  editor surfaces.

- **`AgentSession`.** Created automatically when an agent is mentioned or delegated an
  issue; tracks a run’s lifecycle (working, waiting for input, error, complete) and
  emits `AgentSessionEvent` webhooks.
  Agents post *agent activities* — thoughts, tool calls, clarification prompts,
  responses, errors — with best practice being a `thought` activity within 10 seconds to
  acknowledge the session.

**Assessment**: Linear has independently built the exact two-layer model finding A9
describes: a durable app user, plus a transient `AgentSession` per run.
If tbd ever wants agent work to be visible in Linear *as agent work* rather than as
anonymous API traffic, `actor=app` is the mechanism, and `AgentSession` is the natural
counterpart to a tbd per-session agent record.
This is a much larger undertaking than an ID scheme and should not be bundled with one —
but the shape of tbd’s data model should not foreclose it.

### 4.2 GitHub

GitHub Apps get bot users (`copilot@github.com`, `<app>[bot]`), and attribution flows
through commit trailers as described in A10. The relevant constraint for tbd: a bot
identity is per-app, not per-session, so the session-level detail has to ride in the
message body or a trailer, as this repo’s `Claude-Session:` line already does.

### 4.3 Standards vocabulary worth borrowing

Even setting aside the authentication layer (A12), three vocabulary choices are worth
adopting because they are already load-bearing elsewhere:

- **Agent ID and agent name are separate fields** (OTel GenAI).
- **Session and conversation are separate concepts** (OTel’s `session.id` proposal vs.
  `gen_ai.conversation.id`).
- **Provider/vendor is its own field** (A2A AgentCard’s `provider`), distinct from the
  model.

* * *

## Part 5 — Identifier Format and Storage

### 5.1 What the field uses

| Scheme | Shape | Randomness | Sortable | Notes |
| --- | --- | --- | --- | --- |
| UUIDv4 | 36 chars hex | 122 bits | no | The default across every harness surveyed |
| UUIDv7 | 36 chars hex | 74 bits + 48-bit ms timestamp | yes | Time-ordered replacement for v4 |
| ULID | 26 chars base32 | 80 bits + 48-bit ms timestamp | yes | **What tbd already uses internally** |
| TypeID | `prefix_<26 base32>` | UUIDv7 payload | yes | Formal spec; prefix ≤63 chars `[a-z_]`, `_` separator |
| nanoid | configurable | configurable | no | Compact, URL-safe |
| Haikunator | `adorable-ox-1234` | adjective × noun × 4 digits | no | Memorable; the Heroku/Docker lineage |
| Claude Code default name | `my-app-3f` | dir name + 2 chars | no | Directory-scoped, not globally unique |
| Claude Code collision suffix | `auth-refactor-graceful-unicorn` | 2-word suffix | no | Applied only on observed collision |

The design sketch — a prefix, then base36 characters, “much like tbd issue ids”, example
`agid-c42yxi743` — sits between TypeID (formal prefix + high-entropy payload) and tbd’s
own display IDs (short prefix + base36). It is a conventional choice, and §5.2 argues it
should resolve toward the *internal* half of the tbd scheme rather than the display
half.

### 5.2 The recommended format: `agid-{ulid}`, with the friendly name joined on top

Take tbd’s internal ID shape verbatim and change only the prefix:

| Tier | Issues (today) | Agents (proposed) |
| --- | --- | --- |
| Canonical | `is-{26-char ULID}` | `agid-{26-char ULID}` |
| Example | `is-01hx5zzkbkactav9wevgemmvrz` | `agid-01m00h5y6q413edk3j82zry3d9` |
| Minting | `generateInternalId()`, no registry | identical, no registry |
| Friendly form | `tbd-a7k2`, registry-allocated | slugified name, joined via the record |

This resolves the two loose ends in the sketch without argument:

- **Entropy stops being a question.** A ULID carries 80 random bits alongside its
  millisecond timestamp.
  Two sessions collide only by drawing the same 80 bits in the same millisecond.
  There is no budget to run out of, so no character count to defend, and the sketch’s
  worry — “it might need more bits of randomness than a typical bead” — is satisfied by
  using the tier that *already has them* rather than by lengthening the short one.
  §5.5 keeps the arithmetic that shows why the short tier could not have done this job.

- **The mnemonic becomes a field, not a substring.** The friendly name is slugified and
  joined onto the canonical ID through the record, exactly as `ids.yml` joins `a7k2` to
  a ULID today. Because identity lives in the ULID, the name is free to be brief, free to
  repeat, and free to change without changing who the agent is.
  That is the specific failure of the January design’s `ag-{slugified-name}-{ulid}`
  (§1.2): it concatenated the two, so renaming rewrote the identity.

The resulting display convention mirrors what Claude Code arrived at independently
(§2.1): show the friendly name alone when it is unambiguous, and disambiguate with a
short slice of the canonical ID when it is not — `claude-code` and, when two are live,
`claude-code-01m0` and `claude-code-4rzn`. Ambiguity degrades legibility; it never
degrades correctness, because every join is on `agid-{ulid}`.

One implementation note: the ID grammar is already mostly prefix-agnostic.
`extractUlidFromInternalId` and `isShortId` both strip a generic `^[a-z]+-`, and the
display-prefix pattern (`display-id.ts:8`) accepts `agid` as written.
Only `INTERNAL_ID_PREFIX`, `INTERNAL_ID_PATTERN`, and `validateIssueId`
(`ids.ts:77-137`) hardcode `is`, so the work is generalizing three constants rather than
writing a second ID system.

### 5.3 Reusing the storage and mapping infrastructure

The sync branch already stores two entity families, both under `.tbd/data-sync/`:

| Family | Layout | Merge behavior |
| --- | --- | --- |
| Issues | `issues/is-{ulid}.md` — one file per entity, named by canonical ID | File-granular; concurrent writers touch different files |
| Bridge links | `bridge/<provider>/links/<bead>.yml` — one file per link | File-granular, chosen for exactly this reason |
| ID mapping | `mappings/ids.yml` — one flat file, `short: ulid` | `merge=union` (measured in the branch’s `.gitattributes`) |

Agent records fit the first pattern, not the third: `agents/agid-{ulid}.yml`, one file
per agent, named by the canonical ID. That inherits the merge property the bridge
directory was designed for — two machines minting agent IDs concurrently write two
differently-named files, which git merges without a conflict and without a resolution
rule. It also inherits the existing lockfile, atomic-write, and
`parseYamlWithConflictDetection` machinery unchanged.

It is worth being explicit about why *not* to reuse `ids.yml`’s shape for the friendly
name, because the flat-map layout carries a hazard that one-file-per-entity does not.

### 5.4 The measured hazard in the flat-map layout

`ids.yml` is keyed **short → ULID**, and merged with `merge=union`. Union merge keeps
both sides’ lines, so two machines that independently allocate the same short ID produce
a file with the same key twice.
The loader tolerates that (`parseYamlToleratingDuplicateKeys`, `yaml-utils.ts:183`) with
“last occurrence wins”.

Probed directly against the shipped loader, with a three-line `ids.yml` in which `00wl`
appears twice:

```
Warning: ids.yml contains 1 duplicate key(s): 00wl.
shortToUlid size: 2
00wl -> 01bbbb…                                  (second writer wins)
ulidToShort has A (first writer)?  false
ulidToShort has B (second writer)? true
display for A THREW: No short ID mapping found for internal ID: is-01aaaa…
display for B: tbd-00wl
```

So the first writer’s bead loses its display mapping entirely, and `formatDisplayId`
throws its “this is a bug” error rather than rendering.
The short ID meanwhile resolves to the *other* bead.

This is a latent defect in the existing issue-ID system, not a new one introduced by
anything here — filed separately.
It is reported in this brief because it settles the layout question: an agent registry
keyed by a low-entropy friendly name in a flat union-merged file would reproduce it by
construction, while one file per canonical ID cannot, since ULIDs do not collide and
filenames therefore do not either.

The probability is small in practice for beads — two machines must allocate the same
unseen 4-char ID in the same offline window — but it scales with the square of how much
work happens off-sync, and it is precisely the regime agent minting lives in.

### 5.5 Why a short random ID could not have been the identity

Keeping the arithmetic that the format above makes moot, because it is the reason the
format above is right.
Had the identity been a short random base36 string minted without a registry check, the
birthday bound would govern:

| Chars | Space | Bits | 50% collision at | 1-in-a-million risk at |
| --- | --- | --- | --- | --- |
| 4 (bead display ID) | 1,679,616 | 20.7 | 1,525 | 2 |
| 6 | 2,176,782,336 | 31.0 | 54,914 | 66 |
| 8 | 2,821,109,907,456 | 41.4 | 1,976,908 | 2,375 |
| 9 (as in `c42yxi743`) | 101,559,956,668,416 | 46.5 | 11,861,448 | 14,252 |
| 10 | 3,656,158,440,062,976 | 51.7 | 71,168,689 | 85,512 |
| 26-char ULID | 2^80 random | 80 | ~1.3 × 10^12 *per millisecond* | ~1.5 × 10^9 *per ms* |

The right-hand column is the one that matters: how many IDs can be minted before
collision probability stops being negligible.
Six characters buys 66 sessions; nine buys about 14,000. The ULID row is not in the same
regime — its budget is per-millisecond and still nine orders of magnitude larger.

And the registry loop that makes 4 characters safe for beads cannot be borrowed, because
it consults a registry *loaded from local disk under a local lock*. Two agents starting
in two containers cloned from the same commit both read the same registry, both find the
same short ID free, and both take it; §5.4 shows what happens next.
Bead creation gets away with this because it is serialized through one repo’s lockfile
in practice. Session starts are not, and are the exact case where many machines act at
once.

* * *

## Part 6 — Best Practices Distilled

1. **Take identity from hook stdin, never from environment variables.** Codex sets none;
   Claude Code’s useful ones are undocumented; Cursor’s are real but Cursor-specific.
   Stdin JSON is the only channel all three hook-capable harnesses share.

2. **Record the harness’s native ID as a foreign key, not as the identity.** Store
   `{harness, native_id_kind, native_id}` and mint your own primary key (A4, A5).

3. **Make anything keyed on a session ID idempotent.** `SessionStart` fires on startup,
   resume, clear, compact, and fork (A6).

4. **Separate ID from name from model from harness.** Four fields, not one string (A11,
   and the January design’s mistake in §1.2).

5. **Degrade to partial identity rather than failing.** Gemini CLI can supply a harness
   but no session; a bare terminal can supply neither.
   “Unknown session, known harness, known cwd” must be a valid record.

6. **Inject identity back into the agent’s context, since no harness does it natively.**
   `additionalContext` on Claude Code and Codex, stdout on Cursor, system-prompt
   transform on OpenCode — the mechanism exists everywhere and is used by no one
   automatically (A2, A3).

7. **Attribute through git trailers.** Established, tooling-compatible, already in use
   in this repo (A10).

8. **Do not treat a self-asserted agent ID as a credential.** It is a label.
   Authorization stays with git, GitHub, and Linear (A12).

9. **Be conservative about attribution defaults.** The Copilot `git.addAICoAuthor`
   backlash is the available lesson (2.6).

* * *

## Open Research Questions

1. **Is one agent ID per session right, or one per agent-installation?** Gemini CLI’s
   `installation.id` suggests a stable per-machine identity is a distinct and possibly
   more useful primitive.
   A session record can reference an installation; the reverse does not work.
   Deciding this determines whether the ID count grows with sessions or with machines.

2. **What is the identity of a subagent?** Claude Code supplies `agent_id` and
   `agent_type`; Cursor supplies `subagent_id` and `parent_conversation_id`. Does a
   subagent get its own `agid-`, a child ID, or nothing?
   A single tbd session can spawn many, so the answer materially affects record volume.

3. **How does an identity survive `--resume`?** Codex preserves its session ID, Claude
   Code’s fork does not.
   Should a resumed session keep its agent ID (identity follows the work) or mint a new
   one (identity follows the process)?

4. **Does `assignee` become the agent ID, or does a new field carry it?** `assignee` is
   `local`-only in field sync by explicit design (§1.1). Overloading it changes that
   decision; adding a field is an `f08` schema change.
   This is the concrete crossover point with the external-sync plan.

5. **What is the retention story?** One record per session, checked in, accumulates
   forever. At what point does it need pruning, archiving, or aggregation — and is that a
   year away or a month?

6. **Should tbd detect the harness even when no hook fired?** `CLAUDECODE=1` is set in
   *every* subprocess Claude Code spawns, so a bare `tbd list` invocation could
   self-attribute without any hook at all.
   Cheap, and it covers the case where setup never installed hooks — but it is
   env-var-based, which finding 6.1 argues against relying on.

* * *

## Recommendations

### Summary

The research supports building agent identity, and supports the design sketch’s
instincts on all three of its main points — prefixed ID, more entropy than a bead’s
display ID, working-directory binding at session start.
It settles the format by reusing tbd’s own internal ID tier: `agid-{ulid}`, with the
friendly slugified name joined on top rather than concatenated into it.

The recommended shape, stated as constraints rather than as a finished design:

**Constraint 1 — Identity is a record, not a string.** Minimum fields: `id`
(tbd-minted), `name` (human-facing, mutable, non-identifying), `harness` (`claude-code`
/ `codex` / `cursor` / `unknown`), `harness_version`, `model`, `session` (a *map* of
native IDs by kind, per A5), `cwd` / repo, and `started_at`. Every field except `id`
must be optional, because Gemini CLI and bare terminals cannot supply them.

**Constraint 2 — The mint point is the `SessionStart` hook, reading stdin.** tbd already
owns that script (§1.3). Assignment must be idempotent on the native session ID so that
compaction and resume do not mint duplicates.

**Constraint 3 — The canonical ID is `agid-{ulid}`**: tbd’s existing internal ID shape
(`generateInternalId()`, `ids.ts:104`) with a different prefix, minted at session start
with no registry consultation.
The friendly slugified name is a separate field joined onto it, brief and renameable
because it carries no identity.
Display shows the name alone when unambiguous and appends a short slice of the ULID when
not (§5.2).

**Constraint 3a — Storage is one file per agent**, `agents/agid-{ulid}.yml` under
`.tbd/data-sync/`, following the layout `issues/` and `bridge/*/links/` already use.
Do not key a flat union-merged map by the friendly name: §5.4 measures what duplicate
keys do to `ids.yml` today.

**Constraint 4 — The agent must be told its own ID.** A mint that the agent never sees
is bookkeeping no one can use.
`additionalContext` on `SessionStart` is the delivery mechanism, and it is the same
mechanism `tbd prime` already rides.

**Constraint 5 — Two files, not one.** A machine-local, gitignored pointer to *this*
session’s identity; and, separately, whatever durable record is chosen.
Merging them is what made the January design contradictory (§1.2).

**Constraint 6 — The ID is a label, never a credential** (A12).

### Recommended sequencing

Nothing here requires a schema change if the first step is limited to minting an ID,
telling the agent, and writing it into commit trailers — the mechanism this repository
already uses. Adding an actor to beads or to bridge records is an `f08` concern and
belongs with the other schema work in the external-sync plan, not ahead of it.

### Alternative approaches considered

- **Use the harness session ID directly.** Rejected: not portable, not stable across
  fork, and unavailable on Gemini CLI (A4, A6).
- **Use `assignee` with a free-text convention** (`claude-code@host`). Cheapest possible
  option, no schema change, and it does buy some attribution.
  Rejected as the primary design because it cannot carry model, harness version, or
  session linkage, and because collisions between two concurrent Claude Code sessions
  are invisible. Worth keeping as the degraded fallback.
- **Mint a short random base36 ID as the identity** (`agid-c42yxi743`). Rejected in
  favor of `agid-{ulid}`: it reintroduces a collision budget that uncoordinated minting
  cannot afford, and buys nothing, since the friendly name — not the ID — is what humans
  type and read (§5.2, §5.5).
- **Adopt SPIFFE/A2A identity.** Rejected as out of scope: authentication, not
  bookkeeping (A12).

* * *

## Explore Direction: Per-Session Agent Records in the tbd Sync Repo

*This section records a design direction to explore, not a recommendation.
It follows the research above rather than driving it.*

### The idea

Reuse tbd’s existing two-tier ID framework — a long, globally unique canonical ID with a
friendly name and metadata joined onto it — and extend the tbd repo to hold those
records. From any `agid-{ulid}`, it would then be possible to recover what that agent’s
setup actually was: model, harness, version, environment, working directory, repo, and
start time. Concretely, one new small record checked into the sync branch for every
session, at `agents/agid-{ulid}.yml` (§5.3).

### Why it is plausible

The research above supports it on four counts:

- The `Claude-Session:` trailer already in this repo’s commits (A10) is the same idea in
  miniature: an artifact pointing back at the session that made it.
  A record in the sync repo makes that pointer *resolvable inside the repo* instead of
  only against a vendor URL that may not outlive the session.

- Linear’s `AgentSession` (§4.1) is the same object at the tracker layer — one durable
  record per agent run, holding lifecycle and provenance.
  A tbd session record is its git-native counterpart, and would give tbd something
  concrete to map onto `AgentSession` if `actor=app` is ever pursued.

- Identity has to be a record rather than a string anyway (Constraint 1). Once that is
  true, the record has to live somewhere, and the sync branch is where tbd already puts
  shared state that must merge across machines.

- The layout already exists, twice.
  `issues/is-{ulid}.md` and `bridge/<provider>/links/<bead>.yml` are both
  one-file-per-entity directories named by a canonical ID, chosen specifically so
  concurrent writers from different machines meet in a git merge at file granularity.
  `agents/agid-{ulid}.yml` would be the third instance of an established pattern, not a
  new one — and it is the *easiest* of the three, since agent records are written once
  by exactly one writer.

### What has to be answered before it is a design

**Volume.** This is the question the sketch itself flagged — “if that’s fairly small, it
would probably be manageable.”
An estimate: a record with roughly a dozen scalar fields is on the order of 300–500
bytes of YAML. A busy repo with 10 sessions a day accumulates about 3,650 records and
1–2 MB per year, plus one commit’s worth of git overhead per session.
That is small in absolute terms and unremarkable next to the 1,726 bead files this repo
already carries. But it grows monotonically and never closes, which no other tbd entity
does — beads reach a terminal state, sessions just accumulate.
Retention needs an answer up front (Open Question 5), and the `attic` mechanism already
in tbd is the obvious candidate.

**Write timing.** Writing on `SessionStart` costs a commit at the start of every session
— including sessions that do nothing at all, which are common.
Writing lazily on first bead mutation means the record only exists when there is
something to attribute, at the cost of the identity not being resolvable during a
read-only session. The lazy variant looks better and should be evaluated first.

**Churn interaction with sync.** The external-sync work just finished proving how
expensive an unnecessary write is: rewriting all bridge records on every sync made a
quiet sync neither idempotent nor cheap, and the fix was to guard the write on
substantive change. A per-session record that is written once and never touched again is
naturally well-behaved here — but only if it is genuinely write-once.
Any field that updates during the session (last activity, bead count, end time)
reintroduces exactly the churn that was just removed, and would need the same guard.

**Privacy.** The measured environment in Appendix A contains an account UUID, an
organization UUID, a user email, and a container ID. Some of that is useful provenance
and some of it does not belong in a repository that may be public.
A record schema needs an explicit allowlist of what is captured, not a dump of what is
available — and the environment must never be captured wholesale, since it also contains
credentials.

**Merge semantics.** One file per `agid-{ulid}`, written once by exactly one writer, is
the easiest possible merge case — strictly easier than bridge records, which need a
newest-observation tiebreaker, and strictly easier than `ids.yml`, whose union merge has
the duplicate-key hazard measured in §5.4. Distinct ULIDs give distinct filenames, so
concurrent minting produces no overlapping paths at all.
That is a point in the idea’s favor, and the one structural claim here that is worth
verifying with an actual two-clone merge rather than assuming.

### Smallest version worth prototyping

Lazy write, one file per session under the sync branch, written at most once, containing
only allowlisted non-sensitive provenance, with `attic`-style retention from day one.
Even at that size it would answer a question tbd currently cannot answer at all: *which
agent, running which model, in which container, made this change?*

* * *

## References

**Claude Code**

- Hooks reference — https://code.claude.com/docs/en/hooks
- Manage sessions — https://code.claude.com/docs/en/sessions
- Status line — https://code.claude.com/docs/en/statusline
- Monitoring and OpenTelemetry attributes —
  https://code.claude.com/docs/en/monitoring-usage
- Environment variables — https://code.claude.com/docs/en/env-vars
- Issue #44607, “No way to access session ID from within a running session” —
  https://github.com/anthropics/claude-code/issues/44607

**Codex CLI**

- Non-interactive mode — https://learn.chatgpt.com/docs/non-interactive-mode
- Hooks — https://developers.openai.com/codex/hooks
- Session/rollout files, discussion #3827 —
  https://github.com/openai/codex/discussions/3827
- Issue #8923, “expose current Codex session ID programmatically” —
  https://github.com/openai/codex/issues/8923
- Session resumption — https://deepwiki.com/openai/codex/4.4-session-resumption

**Cursor**

- Hooks — https://cursor.com/docs/hooks
- Empty `conversation_id` report —
  https://forum.cursor.com/t/cursor-hooks-intermittently-emit-empty-conversation-id-session-id-on-tool-execution-events/167095

**Gemini CLI**

- Telemetry —
  https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/telemetry.md
- Issue #8944, “Provide an easy way to retrieve session_id” —
  https://github.com/google-gemini/gemini-cli/issues/8944

**OpenCode**

- `gotgenes/opencode-agent-identity` —
  https://github.com/gotgenes/opencode-agent-identity
- Issue #12324, inject session ID into agent prompts —
  https://github.com/anomalyco/opencode/issues/12324
- Issue #12930, forward session IDs as headers —
  https://github.com/anomalyco/opencode/issues/12930

**Linear**

- Getting started with agents — https://linear.app/developers/agents
- Agent interaction — https://linear.app/developers/agent-interaction
- OAuth actor authorization — https://linear.app/developers/oauth-actor-authorization
- Agent best practices — https://linear.app/developers/agent-best-practices

**GitHub / Copilot**

- `git.addAICoAuthor`, microsoft/vscode#314311 —
  https://github.com/microsoft/vscode/issues/314311

**Standards and identifier formats**

- OpenTelemetry GenAI attribute registry —
  https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- GenAI agent spans —
  https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md
- `session.id` proposal, semantic-conventions-genai#51 —
  https://github.com/open-telemetry/semantic-conventions-genai/issues/51
- A2A specification — https://a2a-protocol.org/latest/specification/
- A2A agent discovery — https://a2a-protocol.org/latest/topics/agent-discovery/
- MCP transports, `Mcp-Session-Id` —
  https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- TypeID specification — https://github.com/jetify-com/typeid/tree/main/spec
- Haikunator — https://github.com/fnando/haikunate
- SPIFFE for agentic AI —
  https://www.hashicorp.com/en/blog/spiffe-securing-the-identity-of-agentic-ai-and-non-human-actors
- AGENTS.md, cross-tool instruction convention —
  https://asdlc.io/practices/agents-md-spec/

* * *

## Appendices

### Appendix A: Measured Environment (Claude Code 2.1.42, cloud container, 2026-08-14)

Identity-bearing variables observed in a live session.
Values are redacted or abbreviated; **the environment also contained live credentials,
which is itself the finding in the privacy note of Part 10 — an agent record must
capture an allowlist, never a dump.**

| Variable | Observed shape | Documented? |
| --- | --- | --- |
| `CLAUDECODE` | `1` | yes |
| `CLAUDE_CODE_VERSION` | `2.1.42` | no |
| `CLAUDE_CODE_SESSION_ID` | UUID, equal to the transcript filename | **no** |
| `CLAUDE_CODE_REMOTE_SESSION_ID` | `cse_01GF8v1Vyc…` | no |
| `CLAUDE_CODE_ENTRYPOINT` | `remote_mobile` | no |
| `CLAUDE_CODE_CONTAINER_ID` | `container_018AVu…--claude_code_remote--…` | no |
| `CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE` | `cloud_default` | no |
| `CLAUDE_CODE_ACCOUNT_UUID` | UUID | no |
| `CLAUDE_CODE_ORGANIZATION_UUID` | UUID | no |
| `CLAUDE_CODE_USER_EMAIL` | email address | no |
| `CLAUDE_CODE_REMOTE` | `true` | yes |
| `CLAUDE_CODE_CHILD_SESSION` | `1` | yes |
| `CLAUDE_EFFORT` | `xhigh` | yes |
| `ANTHROPIC_MODEL` | `opus` | yes (read, not set) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | model slug | no |

Corroborating observation: the transcript for this session is at
`~/.claude/projects/-home-user-tbd/<session-id>.jsonl`, where `<session-id>` is
byte-identical to `CLAUDE_CODE_SESSION_ID` and `-home-user-tbd` is the working directory
with separators replaced — the filesystem encoding of the session ↔ working directory
binding described in finding A7.

### Appendix B: Collision Arithmetic

For a uniform random space of size *N*, drawing *n* identifiers:

- 50% collision probability at *n* ≈ 1.177 √*N*
- Probability *p* of at least one collision at *n* ≈ √(2*Np*)

For base36 strings of length *k*, *N* = 36^*k*. The table in §5.5 evaluates both at *p*
= 10^-6.

For the recommended `agid-{ulid}`, *N* = 2^80 ≈ 1.2 × 10^24 **within a single
millisecond**, since a ULID’s 48-bit timestamp partitions the space by time.
A one-in-a-million risk arrives at roughly 1.5 × 10^9 identifiers minted in the same
millisecond, which is not a regime any session-start path reaches.
This is why §5.2 treats the character count as settled rather than as a parameter to
tune: the question only exists for the short-random-string designs in §5.5.
