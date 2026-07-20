# Research: How Coding Agents Listen On and Monitor Issues

**Date:** 2026-06-04 (last updated 2026-06-04)

**Author:** Research brief (AI-assisted; deep-research harness + targeted follow-ups)

**Status:** Complete (survey); extension analysis is preliminary

**Related:**

- [Running Claude Code Across Environments](research-running-claude-code.md) — has a
  section on GitHub Actions `@claude` triggers; this doc goes deeper on the monitor
  mechanisms themselves
- [Agent Coordination Kernel](research-agent-coordination-kernel.md) — separating
  durable truth from live coordination across agent ecosystems
- [Claude Code Orchestration Interfaces and UIs](research-claude-code-orchestration-and-uis.md)
  — control protocols and orchestration surfaces
- [API References for Bridge Integrations](api-references-bridge-integrations.md) —
  multi-agent protocols (MCP, ACP, A2A, ANP) and bridge APIs
- [Beads Bootstrapping Mechanisms](research-beads-bootstrapping-mechanisms.md) — how
  beads initializes; relevant to the tbd/beads extension angle

* * *

## Overview

It is becoming normal to treat a GitHub issue (or PR, or comment) as the carrier of a
unit of work that a coding agent — Claude Code, OpenAI Codex, Devin, Cursor, etc.
— can **listen on** and act upon.
An issue gets tagged, labeled, assigned, or `@`-mentioned in a certain way, and an agent
“wakes up,” picks up the work, and reports back by commenting, pushing a branch, or
opening a PR.

This brief documents, in detail, **how these monitor/listen mechanisms actually work**:
the trigger surfaces, how the agent is dispatched and given context, how it reports
state back, and the failure/concurrency/security characteristics.
A closing section sketches how we might extend or reuse these patterns where we use
**beads / tbd issues** to coordinate among multiple agents.

**Motivating decision:** tbd uses git-native beads as durable issue state.
If issue-as-trigger is becoming the standard coordination substrate for multi-agent
work, we need to understand the landscape in detail to decide how (or whether) tbd
should participate — as a listener, a dispatcher, or a coordination kernel underneath
these tools.

**Method & confidence:** The external survey is built from a deep-research pass (5
search angles, 22 primary sources fetched, 99 claims extracted, 25 adversarially
verified with 3-vote refutation — 24 confirmed, 1 killed) plus two targeted follow-up
passes to fill coverage gaps (Cursor/Amp/Aider; the MCP/A2A/ACP protocol layer).
Findings below are drawn from primary sources (official docs, action repos, changelogs)
verified 3-0 or 2-1. Where something is vendor-stated but not independently
corroborated, it is flagged.

## Questions to Answer

1. What concrete mechanisms do today’s coding agents use to listen on issues?
2. For each major tool: how is the agent triggered, dispatched, given context, and how
   does it report back?
3. What is the control plane vs.
   data plane vs. durable-state split?
4. How is state/handoff represented on the issue itself?
5. Concurrency, idempotency, deduplication, loop-prevention?
6. Security/permission model: token scopes, who can trigger, prompt-injection,
   sandboxing?
7. What standard protocols/abstractions are emerging (MCP, A2A, ACP, GitHub agent APIs)?
8. Extension angle: how could beads/tbd act as a listener or coordination layer?

## Scope

**Included:** Issue/PR/comment-driven agent triggering and monitoring across the major
hosted coding agents and DIY (GitHub Actions / webhook) patterns; the detailed mechanics
of dispatch, context injection, and state reporting; security and concurrency.

**Excluded (or light):** General prompt-engineering of the agents; per-model capability
comparisons; full design/implementation of a tbd feature (a closing analysis only).

* * *

## Findings

### The three architectural patterns

Across every tool surveyed, issue/PR monitoring collapses into **three architectural
patterns**, distinguished by *what listens*:

1. **GitHub Actions composite actions** — the agent ships as a composite action invoked
   by a workflow the repo owner writes.
   *The repo’s workflow YAML is the listener;* the agent is just the payload.
   Triggered by `issue_comment`, `issues`, `pull_request`, etc.
   Dispatch is gated by `@`-mention phrase, label, or assignee.
   Examples: **Claude Code Action**, **OpenAI Codex Action**, and the DIY
   **Amp**/**Aider** wirings.

2. **GitHub App integrations** — the agent installs as a persistent GitHub App with
   org-level permissions and receives webhooks automatically; *the vendor’s backend is
   the listener.* No workflow YAML needed.
   Examples: **Devin**, **GitHub Copilot coding agent**, **Cursor**.

3. **GitHub Agentic Workflows (`gh aw`)** — an emerging platform-native layer (technical
   preview, Feb 2026) where workflows are written in **Markdown** (natural language +
   YAML frontmatter) and compiled to hardened Actions workflows; *GitHub’s own agent
   runtime is the listener,* with the GitHub MCP Server as the standardized context
   surface.

The trend line is clear: from “you write YAML that calls an agent” (pattern 1) → “the
vendor’s app watches for you” (pattern 2) → “the platform itself is agent-native and you
describe intent in prose” (pattern 3).

### GitHub-native event substrate (the foundation under pattern 1 and 3)

GitHub Actions provides the rich event system that all Actions-based agents build on
([events-that-trigger-workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
verified 3-0):

- **`issues`** — `opened`/`edited`/`labeled`/`assigned`/`closed`/`reopened` and ~20
  total activity types, filterable via the `types:` keyword.
- **`issue_comment`** — fires for comments on **both issues and PRs**; distinguish a PR
  via `github.event.issue.pull_request`.
- **`pull_request`**, **`pull_request_review`**, **`pull_request_review_comment`**.
- **`repository_dispatch`** — a custom webhook for *external* orchestration:
  `event_type` up to 100 chars, `client_payload` up to 65,535 chars, max 10 top-level
  properties. This is the seam through which an external system (a bead daemon, Jira,
  PagerDuty) can inject an agent trigger.

**Built-in anti-recursion (the platform’s loop guard, verified 3-0):** events triggered
by `GITHUB_TOKEN` do **not** create new workflow runs (documented exceptions:
`workflow_dispatch`, `repository_dispatch`). For `check_run`/`check_suite`, workflows
are skipped if the suite was created by Actions.
PRs created/updated by a workflow using `GITHUB_TOKEN` enter an approval-required state
for `opened`/`synchronize`/`reopened`. This is the bedrock that stops agent → comment →
agent infinite loops at the platform level; every Actions-based agent layers its own
additional guards on top.

### Claude Code Action (anthropics/claude-code-action)

**Trigger surface (verified 3-0):** Recommended starter workflows wire four triggers —
`issue_comment` (created), `pull_request_review_comment` (created), `issues`
(opened/assigned/labeled), and `pull_request_review` (submitted).
The source (`context.ts`) actually supports **nine** event types, also including
`pull_request`, `workflow_dispatch`, `repository_dispatch`, `schedule`, and
`workflow_run`.

**Dispatch:** configurable via `trigger_phrase` (default `@claude`), `assignee_trigger`,
and `label_trigger` — i.e., all three of `@`-mention, assignee, and label dispatch.

**Context injection:** *automatic.* The action reads issue body, comments, and PR diff
context internally and assembles the prompt — the workflow author does not template
context by hand. (This is the key architectural contrast with Codex Action below.)

**Security & loop-prevention (verified 3-0):** bot/user allowlisting via `allowed_bots`,
`allowed_non_write_users`, `include_comments_by_actor`, `exclude_comments_by_actor`.
`allowed_bots` supports `*`, but the docs warn: *“On public repos with `*`, external
Apps may be able to invoke this action with prompts they control.”* A distinctive
**Haiku-based loop-prevention** mechanism (`classify_inline_comments`, default on)
buffers inline comments lacking `confirmed: true` to
`/tmp/inline-comments-buffer.jsonl`, then uses a separate **Claude Haiku** call to
classify each as real review vs.
test/probe, and only posts the real ones after the session ends — explicitly preventing
subagent test comments from re-triggering agent activity.
This is a novel **LLM-in-the-loop** approach to loop prevention.

### OpenAI Codex Action (openai/codex-action)

**Architecturally minimal — “bring your own triggers and context” (verified 3-0).** It
is a composite action that installs the Codex CLI via npm and runs `codex exec`. It does
**not** natively listen on GitHub events or inject issue/PR context.
The author must:

- define their own workflow triggers;
- manually template context into the `prompt` input via expressions like
  `${{ github.event.pull_request.title }}`;
- post comments / update PRs in **separate job steps** — the action’s only output is
  `final-message` (raw text).

`sandbox` input supports `workspace-write` (default), `read-only`, `danger-full-access`.

**Authorization & security (verified 3-0):** by default only **write-access** users can
trigger; explicit opt-in via `allow-users`, `allow-bots`, `allow-bot-users`. Notably
`allow-bot-users` **does not support wildcards** (must list trusted bots explicitly) — a
deliberate tightening vs.
Claude’s `allowed_bots: *`. Security docs warn specifically about prompt injection from
**HTML comments in PR bodies, commit messages, `AGENTS.md`/`AGENTS.override.md` files,
and screenshots**, and recommend running the action as the **last step** because Codex
could spawn lingering processes, overwrite the action’s own source, or modify
`.git/hooks`. (The `AGENTS.md` warning was added 2026-05-14 — evidence of an actively
evolving threat surface.)

### GitHub Copilot coding agent

**Platform-native (a GitHub App, not an Action; verified 3-0).** Three trigger surfaces:

1. **Issue assignment** — select **“Copilot” as the assignee.** The simplest dispatch of
   any agent surveyed; no YAML.
2. **`@copilot` mention** in PR comments — chat-ops style, for iterating on an existing
   PR.
3. **Automated event-driven triggers** (e.g., issue opened) and **scheduled runs** via
   configurable automations — these became GA for Pro/Pro+/Max/Business/Enterprise on
   **2026-06-02** (per changelog; two days before this brief).
   Currently scoped to private and internal repos.

The `@copilot` PR-mention feature launched ~Oct 2025 with continued iteration (model
picker added Mar 2026). NB: Copilot coding agent had documented secret-exfiltration
vulnerabilities reported in 2025–2026 (Adnan Khan; Aonan Guan) — relevant context for
the hardening seen in GitHub Agentic Workflows below.

### Devin (Cognition)

**A GitHub App, not an Action (verified 3-0).** Requires **org-admin install** with
org-level permissions (read/write to checks, commit statuses, contents, discussions,
issues, PRs, projects, workflows).
It **automatically responds to PR comments on active sessions** without requiring an
`@`-mention or any webhook config — a persistent conversational agent.
**Sleeping sessions auto-wake on PR-comment retriggers** (as of 2026-05-29), making
Devin the most “always-on” agent in the survey.
The competing claim that Devin is *only* triggered via manual web-app invocation was
explicitly **refuted (0-3).**

### Cursor background / cloud agents

**Native, first-party, and the broadest trigger surface of any tool here** (follow-up
pass, high confidence).
Cloud agents can be triggered from: **GitHub issues/PRs** (`@cursor` comment), **Slack**
(`@Cursor` in a channel/thread), **Linear/Jira** (assign Cursor to an issue),
**schedules** (cron), **webhooks**, the web UI (`cursor.com/agents`), the desktop app,
and an **API**.

- **Dispatch/context:** clones the repo into an isolated Ubuntu cloud VM; the issue
  body/comments (or full Slack thread) become the task prompt.
  Each agent gets its own desktop, browser, and terminal to build/run/verify.
- **Reporting:** pushes a branch and opens a **merge-ready PR**; posts status back to
  Slack/Teams. (Known limitation: screenshots/video artifacts are viewable only in
  Cursor’s UI, not yet posted to PR comments.)
- **Requirements:** paid plan + Cursor GitHub App installed (+ Slack app for Slack
  triggers).

Sources: [Cloud Agents](https://cursor.com/docs/cloud-agent),
[GitHub Integration](https://cursor.com/docs/integrations/github),
[cursor.com/cloud](https://cursor.com/cloud).

### Sourcegraph Amp — no native listener

**Amp is a CLI (`amp`, `amp -x`) and IDE extension with no native GitHub event listener,
no daemon, no webhook receiver** (follow-up pass, high confidence).
Event-driven automation is **DIY via GitHub Actions**: set `AMP_API_KEY`, invoke
`amp -x` in a step. Sourcegraph publishes a first-party *example* “GitHub Review Bot”
Action
([amp-examples-and-guides](https://github.com/sourcegraph/amp-examples-and-guides)) that
runs on PR open and posts review comments via the GitHub API. A separate
webhook-service/App option
([sourcegraph/cra-github](https://github.com/sourcegraph/cra-github)) was **archived
2026-02-06.** Any “issue → PR” pipeline is hand-rolled (`amp -x` + `gh pr create`).
Owner’s manual ([ampcode.com/manual](https://ampcode.com/manual)) documents no event
triggers, cloud agents, or webhook listener.

### Aider — purely local CLI, DIY only

**Aider has no server mode, webhook listener, or native GitHub monitoring** (follow-up
pass, high confidence).
It runs in the terminal, edits a local git repo, commits.
Its non-interactive mode (`--yes`, `--message`) makes it scriptable.
The **“issue → PR”** pattern people cite is **third-party community** wiring:
[mirrajabi/aider-github-action](https://github.com/mirrajabi/aider-github-action) +
[aider-github-workflows](https://github.com/mirrajabi/aider-github-workflows) — when an
issue gets the `aider` label, an Actions workflow passes the issue body as the prompt
and opens a PR. Not maintained or endorsed by Aider-AI.

### GitHub Agentic Workflows (`gh aw`) — the emerging platform layer

**Technical preview since 2026-02-13**
([changelog](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/);
verified 2-1 to 3-0 across constituent claims).
The most significant architectural shift in the survey:

- **Authoring:** workflows are **Markdown with YAML frontmatter** — frontmatter declares
  triggers/permissions/tools, the Markdown body holds natural-language instructions.
  `gh aw compile` generates a `.lock.yml` Actions workflow.
- **Triggers:** the full GitHub event set plus agent-friendly sugar — `slash_command:`
  (`/command` in a comment), `label_command:` (a label as one-shot trigger), fuzzy
  schedules ("daily around 14:00"), `repository_dispatch:` for external systems,
  `workflow_run:` for chaining.
  Filtering by label, **search query** (`skip-if-match`/`skip-if-no-match`), RBAC, and
  bot whitelisting
  ([triggers reference](https://github.github.com/gh-aw/reference/triggers/)).
- **Context injection:** standardized through the **GitHub MCP Server** (issues, PRs,
  actions, security context) — replacing ad-hoc template expressions — plus browser
  automation, web search, and custom MCPs.
- **Security architecture (verified 3-0, the most comprehensive surveyed):** agents run
  in **chroot jails** with read-only host filesystems and selective writable tmpfs
  overlays, inside containers with a **firewalled egress** (Agent Workflow Firewall:
  Squid proxy + iptables domain allowlists).
  Agents have **zero direct access to secrets** — LLM auth lives behind an isolated API
  proxy; the **MCP gateway** runs in a separate trusted container.
  Write operations are buffered and run through a **three-stage deterministic
  “safe-outputs” analysis** (operation filtering, content moderation, secret removal)
  before execution, with **rate limits** (default **max 1 PR**, configurable up to 3).
  ([under-the-hood security](https://github.blog/ai-and-ml/generative-ai/under-the-hood-security-architecture-of-github-agentic-workflows/),
  [architecture](https://github.github.com/gh-aw/introduction/architecture/)).
  - **Honest caveats from GitHub’s own docs:** the MCP-gateway API key *“is not a strong
    security boundary against a compromised or malicious agent”* (extractable from
    process memory — “treat this key as leaked by design”), and agents have “a
    surprisingly deep toolbox of tricks” for workarounds.
    The hardening reads as a direct response to the 2025–2026 Copilot exfiltration
    findings.

### Dispatch / context / reporting — how it actually flows

- **Dispatch (who decides to run):** `@`-mention phrase (Claude, Cursor, Copilot),
  **label** (Claude `label_trigger`, Aider DIY, `gh aw` `label_command`), **assignee**
  (Copilot “assign Copilot”, Claude `assignee_trigger`, Cursor via Linear/Jira),
  automatic on **active session** (Devin), or **automated/scheduled** (Copilot
  automations, `gh aw` schedules).
- **Context injection (what the agent sees):** ranges from **fully automatic** (Claude
  Code Action reads issue+comments+diff; `gh aw` via GitHub MCP Server) to **fully
  manual** (Codex Action — you template every field).
  The clear trajectory is toward **MCP as the standardized context surface** so the
  agent pulls structured issue/PR/code data rather than receiving a hand-built string.
- **State reporting (how the agent answers):** PR creation (Cursor, Devin, Copilot,
  Aider DIY), **PR/issue comments** (all), **labels & status checks** as a coarse state
  machine (DIY pattern from `research-running-claude-code.md`), **assignee** changes,
  **reactions** as lightweight ack.
  The issue/PR thread *is* the durable log of the coordination.

### Control plane / data plane / durable state

A useful decomposition that recurs across all three patterns:

- **Durable state** = the issue/PR itself (body, comments, labels, assignees, status
  checks) stored in GitHub.
  This is the source of truth and the audit log.
- **Control plane** = whatever decides to dispatch: the Actions runner evaluating
  `on:`/`if:` (pattern 1), the vendor App’s webhook backend (pattern 2), or the `gh aw`
  runtime (pattern 3). Includes the authorization gate and anti-recursion logic.
- **Data plane** = how the running agent reads/writes that state: the GitHub API
  directly, or increasingly the **GitHub MCP Server** as a typed, toolset-scoped
  interface.

The emerging consensus puts **MCP at the data plane**, **GitHub events / Agentic
Workflows at the control plane**, and **the issue tracker as durable state** — exactly
the “separate durable truth from live coordination” thesis from
[research-agent-coordination-kernel.md](research-agent-coordination-kernel.md).

### Concurrency, idempotency, loop-prevention

Layered defenses, from platform to app:

1. **Platform:** `GITHUB_TOKEN`-triggered events don’t recurse (GitHub Actions).
2. **Authorization gating:** write-access-only by default (Codex); user/bot allowlists
   (Claude, Codex); RBAC (`gh aw`). Stops untrusted actors from dispatching.
3. **App-level loop guards:** Claude’s **Haiku classifier** of real-vs-probe comments;
   `gh aw` **safe-outputs rate limits** (max 1 PR default).
4. **Idempotency:** largely **convention-based today** — agents check for an existing
   branch/PR or an existing “I’m on it” comment before acting; there is no universal
   dedup primitive. **Cross-agent** dedup (Copilot + Claude + Devin on one repo) is an
   **open problem** — each tool’s anti-recursion is self-contained.

### Security & permission model (cross-cutting)

- **Token scopes:** Actions agents run with `GITHUB_TOKEN` scoped by the workflow’s
  `permissions:`; Apps (Devin, Copilot, Cursor) carry org-level install permissions.
- **Who can trigger:** write-access default, with explicit allowlists; public-repo
  wildcards (`allowed_bots: *`) are an explicit footgun.
- **Prompt injection** is the dominant risk, because the issue/PR/comment content is
  **untrusted input that becomes the prompt.** Documented vectors: HTML comments, commit
  messages, `AGENTS.md`, screenshots.
  Mitigations: sandboxing (Codex modes; `gh aw` chroot
  + firewall), least-privilege tokens, deterministic output filtering (`gh aw`
    safe-outputs), and human approval gates.
- **Sandboxing maturity** spans a wide range: Aider/Amp (none native — runs wherever you
  put it) → Codex (`read-only`/`workspace-write`/`danger-full-access`) → `gh aw` (chroot
  jail + egress firewall + isolated secret proxy).

### Emerging protocols (the standardization layer)

Four layers are converging into a stack (follow-up pass; see also
[api-references-bridge-integrations.md](api-references-bridge-integrations.md)):

- **MCP (Model Context Protocol)** — *agent ↔ tools/context.* Anthropic-originated (Nov
  2024), now under the Linux Foundation; **the de facto standard** with SDKs in many
  languages and hundreds of servers.
  RC for the **2026-07-28** spec adds a stateless core, an Extensions framework, and
  **Tasks** (server returns a task handle with `tasks/get`/`update`/`cancel` lifecycle).
  *Relevance:* MCP is the **data plane** — how a dispatched agent reads the issue and
  writes the PR (e.g., **GitHub MCP Server**, GA Sep 2025, OAuth 2.1+PKCE, toolsets like
  `issues`/`pull_requests`/`actions`). MCP does **not** define dispatch or triggers.
- **A2A (Agent2Agent)** — *agent ↔ agent.* Google-originated (Apr 2025), Linux
  Foundation (Jun 2025), **v1.0.0 stable**, 150+ orgs.
  **Agent Cards** (capability discovery) + **Tasks** with a lifecycle
  (`submitted → working → completed/failed/canceled`, plus
  `input-required`/`auth-required`) and streaming/push updates.
  *Relevance:* the natural fit for **multi-agent coordination** — a dispatcher discovers
  a specialized coding agent and delegates an issue-derived task — but adoption is still
  **enterprise-orchestration heavy, nascent in dev-tooling.** Not yet integrated into
  GitHub Agentic Workflows as of Jun 2026.
- **ACP (Agent Client Protocol)** — *editor ↔ agent.* Zed-originated (Aug 2025),
  JetBrains
  + Copilot CLI adopters, **protocol v1**, 25+ agents.
    The “LSP for coding agents.”
    *Relevance:* the **invocation surface** (how an editor launches an agent), not issue
    lifecycle or coordination.
- **GitHub agent primitives** — **Agentic Workflows** = the **control/dispatch** layer;
  **GitHub MCP Server** = the **context/action** layer.
  GitHub’s stack maps cleanly onto MCP (data plane) + events (control plane) + the issue
  as durable state, with A2A as a not-yet-adopted future option for cross-agent
  delegation.

* * *

## Comparison Matrix

| Tool | Pattern | Listener | Trigger surfaces | Context injection | Reports back | Sandbox / loop guard |
| --- | --- | --- | --- | --- | --- | --- |
| **Claude Code Action** | GH Action | Repo workflow | `@claude`, label, assignee, 9 events | **Automatic** (issue+comments+diff) | PR, comments, inline review | Haiku real-vs-probe classifier; user/bot allowlist |
| **OpenAI Codex Action** | GH Action | Repo workflow | BYO triggers | **Manual** (template expressions) | `final-message` → your steps | `read-only`/`workspace-write`/`danger-full-access`; write-access gate, no bot wildcard |
| **Copilot coding agent** | GH App | GitHub backend | Assign “Copilot”, `@copilot`, automations/schedule | Automatic | PR, comments | Platform; private/internal repos only |
| **Devin** | GH App | Cognition backend | Auto on active session, PR comments, auto-wake | Automatic | PR, comments | Org-level App perms |
| **Cursor cloud agents** | GH App | Cursor backend | `@cursor`, Slack, Linear/Jira, cron, webhook, API | Automatic (repo clone in VM) | Merge-ready PR, Slack status | Isolated cloud VM |
| **Sourcegraph Amp** | DIY Action | Your workflow | None native (`amp -x` in CI) | Manual | PR comments (DIY) | None native |
| **Aider** | DIY Action | Your workflow | None native (`aider` label, 3rd-party) | Manual (issue body → prompt) | PR (DIY) | None native |
| **GitHub Agentic Workflows** | Platform | `gh aw` runtime | Full events + slash/label commands, schedules, dispatch | **MCP (GitHub MCP Server)** | safe-outputs (PR/comment, rate-limited) | chroot + egress firewall + secret proxy |

## Key Insights

1. **The listener is migrating from the repo to the platform.** Pattern 1 makes *you*
   write the listener (YAML); pattern 2 moves it to the vendor; pattern 3 bakes it into
   GitHub. Each step removes config burden and centralizes the security/concurrency
   guarantees.
2. **Context injection is standardizing on MCP.** The spread from Codex’s manual
   templating to `gh aw`’s GitHub MCP Server is the single clearest convergence: the
   agent should *pull* typed issue/PR/code data, not receive a hand-built string.
3. **The issue thread is the coordination ledger.** Comments, labels, assignees, and
   status checks are the durable, human-readable, mergeable state machine.
   This is exactly the “durable truth vs.
   live coordination” split — and it’s why a git-native tracker is a natural fit
   underneath.
4. **Prompt injection is the defining security problem,** because untrusted issue
   content *becomes the prompt.* The frontier of defense (chroot + egress firewall +
   deterministic safe-outputs + isolated secret proxy in `gh aw`) is a direct, visible
   response to real 2025–2026 exfiltration incidents.
5. **Loop-prevention has no cross-agent standard.** Each tool self-guards (GITHUB_TOKEN
   recursion rule, Haiku classifier, rate limits), but **multi-vendor dedup on one repo
   is unsolved** — the most relevant gap for a coordination-kernel play.
6. **Two distinct “always-on” models exist:** ephemeral (Actions: run, exit) vs.
   persistent-session (Devin auto-wake, Cursor cloud agents).
   Persistence enables conversational iteration but widens the attack/cost surface.

## Coverage Gaps & Caveats

- **Time sensitivity:** This landscape moves weekly.
  `gh aw` is technical preview (may change before GA); Copilot automations went GA
  **2026-06-02**; Codex’s `AGENTS.md` warning landed **2026-05-14**. Treat specifics as
  a 2026-06 snapshot.
- **Cross-agent coordination/dedup** when multiple agents share a repo is documented
  nowhere — an open question and an opportunity.
- **Real-world loop/failure rates** of the anti-recursion mechanisms are not published;
  Haiku classification adds latency + LLM error rate.
- **Vendor-stated security:** `gh aw`’s architecture is corroborated by open-source code
  (`gh-aw-firewall`, `gh-aw-mcpg`) but is preview-stage with acknowledged limits.
  Devin’s docs are less technically detailed and may understate complexity.

* * *

## Extension Angle: Issue-Listening on Beads / tbd for Multi-Agent Coordination

> Preliminary — a design sketch, not a committed plan.
> The survey above is the deliverable; this section frames how the patterns could apply
> to tbd. See
> [research-agent-coordination-kernel.md](research-agent-coordination-kernel.md) for the
> deeper coordination-kernel thesis.

**Why tbd is well-positioned.** The whole industry is rediscovering “separate durable
truth from live coordination”: the **issue is durable state**, **events are the control
plane**, **MCP is the data plane**. Beads already provides the durable, **git-native**
state — versioned, mergeable, offline-first, not locked to GitHub.
The missing pieces to participate in (or underlie) the issue-as-trigger ecosystem are a
**trigger surface** and a **dispatch/anti-recursion layer**.

**What tbd would need to implement (the GitHub-equivalents we don’t get for free):**

1. **An event surface.** GitHub gives `issues`/`issue_comment`/`labeled`/`assigned`
   webhooks; beads has none.
   Options:
   - **git hooks** (`post-commit`, `post-merge`, `post-receive`) that diff the beads
     JSONL and emit “bead changed” events — works on push/merge, the natural sync
     points.
   - **a polling daemon / `tbd watch`** that tails the beads store for
     status/label/assignee transitions and fires a dispatch — simplest, works offline,
     no server.
   - **`repository_dispatch` bridge** — when running *on* GitHub, a tbd Action could map
     bead transitions to `repository_dispatch` and reuse the entire existing agent
     ecosystem.
2. **A dispatch convention.** Mirror the field-as-trigger patterns that already won:
   **assignee = which agent** (`assignee: claude` / `codex` / `devin`), **label = mode**
   (`label: needs-implementation`), **status = lifecycle**
   (`open → in_progress → review`). These map 1:1 onto how Copilot/Claude/Cursor already
   dispatch, so the mental model transfers.
3. **Anti-recursion without `GITHUB_TOKEN`.** This is the piece tbd must *invent*, since
   it has no platform recursion guard.
   Candidates: an **actor field** on each transition (don’t re-dispatch on your own
   writes — the manual equivalent of the GITHUB_TOKEN rule), an **idempotency key per
   bead+state** (claim-before-work), and **rate limits** à la `gh aw` safe-outputs.
4. **A claim/lease primitive for concurrency.** The genuinely novel value vs.
   GitHub: git-native, mergeable **atomic claims** so two agents don’t grab the same
   bead — a lease field with CRDT-friendly merge semantics.
   This is the cross-agent dedup that the survey found **missing everywhere.**
5. **MCP as the data plane.** A **tbd MCP server** (toolsets: `beads`, `dependencies`,
   `claims`) would let any MCP-capable agent read/claim/update beads the same way the
   GitHub MCP Server exposes issues — making tbd a first-class context surface rather
   than a CLI the agent shells out to.

**The strategic question (for a follow-up spec):** does tbd want to be a **listener** (a
tbd Action that agents trigger), a **dispatcher** (a `tbd watch` daemon that wakes
agents), or the **coordination kernel** (the durable + claim/lease layer that *other*
agents and even GitHub sit on top of)?
The survey suggests the most defensible, least commoditized position is **#3 + #4**:
git-native durable state plus the **mergeable claim/lease primitive for cross-agent
dedup that nobody else has.**

## Next Steps

- [x] Socialize this brief; decide listener vs.
  dispatcher vs. kernel positioning — *2026-07-20: positioning chosen (dispatcher-first
  via `tbd watch`, kernel primitives incremental); see addendum below*
- [x] If pursuing: spec the minimal viable event set (git-hook vs.
  `tbd watch` vs. `repository_dispatch` bridge) — *2026-07-20: specced as polling
  `tbd watch --json` in
  [plan-2026-07-20-linear-bead-sync-pilot.md](../../specs/active/plan-2026-07-20-linear-bead-sync-pilot.md)
  §6, tracked as beads under the pilot epic*
- [ ] Prototype a claim/lease field with mergeable semantics + actor-based
  anti-recursion — *partially: actor attribution (`last_actor` + echo suppression) is in
  the pilot spec; claim/lease remains a follow-up*
- [ ] Evaluate a tbd MCP server (beads/dependencies/claims toolsets)
- [ ] Re-survey `gh aw` at GA — it is the closest thing to a reference design

## Addendum (2026-07-20): pilot spec now exists

The extension angle above graduated into a concrete plan:
[plan-2026-07-20-linear-bead-sync-pilot.md](../../specs/active/plan-2026-07-20-linear-bead-sync-pilot.md)
combines bidirectional Linear ↔ bead sync for a linked subset with the first slice of
`tbd watch` (JSONL bead-change events + actor-based anti-recursion), because the two
share the echo/loop-prevention invariant.
Linear API specifics (GraphQL, webhooks-need-public-HTTPS, rate limits, Agents platform)
were verified and recorded in
[api-references-bridge-integrations.md §5](api-references-bridge-integrations.md).
The claim/lease primitive and MCP server evaluation remain open follow-ups.

## Methodology

Deep-research harness: 5 search angles → 22 primary sources fetched → 99 claims
extracted → 25 verified via 3-vote adversarial refutation (24 confirmed, 1 killed: the
“Devin is manual-invocation-only” claim, refuted 0-3). Two targeted follow-up passes
filled the harness’s flagged gaps (Cursor/Amp/Aider; the MCP/A2A/ACP protocol layer),
prioritizing official docs and repos.
Findings marked “verified N-0/N-1” carry the adversarial vote; follow-up findings are
cited inline and marked high-confidence where corroborated by primary docs.

## References

**GitHub-native event substrate**
- [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
  — primary
- [Automatic token authentication (GITHUB_TOKEN)](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
  — primary

**Claude Code Action**
- [usage.md](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md),
  [action.yml](https://github.com/anthropics/claude-code-action/blob/main/action.yml),
  [context.ts](https://github.com/anthropics/claude-code-action/blob/main/src/github/context.ts),
  [security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)
  — primary

**OpenAI Codex Action**
- [openai/codex-action](https://github.com/openai/codex-action) +
  [action.yml](https://github.com/openai/codex-action/blob/main/action.yml),
  [security.md](https://github.com/openai/codex-action/blob/main/docs/security.md),
  [Codex GitHub Action docs](https://developers.openai.com/codex/github-action) —
  primary

**Copilot coding agent**
- [Create a PR with Copilot](https://docs.github.com/copilot/using-github-copilot/coding-agent/asking-copilot-to-create-a-pull-request),
  [About cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent),
  [Assigning & completing issues](https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/),
  [Schedule & automate (2026-06-02)](https://github.blog/changelog/2026-06-02-schedule-and-automate-tasks-with-copilot-cloud-agent/)
  — primary

**Devin**
- [GitHub integration](https://docs.devin.ai/integrations/gh),
  [2026 release notes](https://docs.devin.ai/release-notes/2026) — primary

**Cursor**
- [Cloud Agents](https://cursor.com/docs/cloud-agent),
  [GitHub Integration](https://cursor.com/docs/integrations/github),
  [cursor.com/cloud](https://cursor.com/cloud) — primary

**Sourcegraph Amp**
- [Owner’s Manual](https://ampcode.com/manual),
  [amp-examples-and-guides](https://github.com/sourcegraph/amp-examples-and-guides),
  [cra-github (archived)](https://github.com/sourcegraph/cra-github) — primary

**Aider**
- [Aider-AI/aider](https://github.com/Aider-AI/aider),
  [aider-github-action (3rd-party)](https://github.com/mirrajabi/aider-github-action),
  [aider-github-workflows (3rd-party)](https://github.com/mirrajabi/aider-github-workflows)

**GitHub Agentic Workflows**
- [Technical preview (2026-02-13)](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/),
  [Triggers reference](https://github.github.com/gh-aw/reference/triggers/),
  [Tools reference](https://github.github.com/gh-aw/reference/tools/),
  [Architecture](https://github.github.com/gh-aw/introduction/architecture/),
  [Under-the-hood security](https://github.blog/ai-and-ml/generative-ai/under-the-hood-security-architecture-of-github-agentic-workflows/),
  [safe-outputs / rate limiting](https://github.github.com/gh-aw/reference/rate-limiting-controls/),
  [chroot mode](https://github.com/github/gh-aw-firewall/blob/main/docs/chroot-mode.md)
  — primary

**Protocols**
- [MCP roadmap](https://modelcontextprotocol.io/development/roadmap),
  [MCP 2026-07-28 RC](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/),
  [GitHub MCP Server](https://github.com/github/github-mcp-server) — primary
- [A2A specification](https://a2a-protocol.org/latest/specification/),
  [A2A one-year milestone](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
  — primary
- [ACP repository](https://github.com/agentclientprotocol/agent-client-protocol),
  [ACP introduction](https://blog.marcnuri.com/agent-client-protocol-acp-introduction) —
  primary/blog

**Security research (context)**
- [Comment-and-control prompt injection (Guan)](https://oddguan.com/blog/comment-and-control-prompt-injection-credential-theft-claude-code-gemini-cli-github-copilot/)
  — primary research

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
