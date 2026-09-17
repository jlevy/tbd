---
title: Agent Run Operations Rules
description: Launching, monitoring, and diagnosing long agent and batch runs—pinned launch checkouts, one scheduler per host budget, host-first diagnosis of slowness, validating a metric before reporting it, reading the prompt before blaming a model, same-configuration baselines, delegated-agent hygiene, and partial failure shown at its real scale. Load when running or reporting on multi-agent or batch workloads.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Run Operations Rules

Long agent workloads (batches of LLM steps, evaluation sweeps, multi-hour pipelines)
fail in ways unit tests never see.
The host is shared, the measurements are new, and a model’s output depends on a prompt
nobody reread. The expensive mistake is rarely the failure itself; it is a confident
wrong explanation that sends the next hour of work to the wrong place.

**Related**:

- `general-eng-agent-principles` (seek exact causes, state uncertainty)
- `ci-and-gates-rules` (evidence a machine records about itself; recorded timeouts)
- `general-testing-rules` (raising a timeout only with a measurement)
- `error-handling-rules` (honest partial success)
- `delegate-to-subagents` shortcut (authorization, tiers, briefs, and verification for
  sub-agents)

## Launch Long Runs From a Pinned Checkout

A run that reads code, prompts, or lockfiles from the checkout you are developing in is
running whatever that checkout contains at each moment.
A commit, a branch switch, or a tool that rewrites a lockfile mid-run changes the code
under the job, and a run that verifies its revision fails outright.

- Launch from a dedicated worktree or detached checkout at a recorded commit.
- Treat a live run’s checkout and output tree as read-only, for yourself and for any
  agent you delegate to.
- Queue commits to that checkout until the run finishes.

## Put One Batch Under One Scheduler

An admission controller (a worker pool, a concurrency limiter, a queue with a memory
budget) can only balance the work it can see.
Two separately launched runs on one host each believe they own it, and their combined
load is nobody’s decision.

- Launch a batch as one run under one scheduler with a high ceiling, and let its
  governor lower concurrency under pressure.
- Do not overlap separate runs and then hand-lower each one’s ceiling to compensate.
  That trades an adaptive limit for guesses that are wrong in both directions.
- Know what the governor measures.
  Many watch memory and swap only, and report “normal” while CPU is saturated.

## Diagnose Slowness From the Host Before the Workload

When steps slow down or time out, check the machine before theorizing about the
pipeline:

```bash
uptime                                   # load average against core count
sysctl vm.swapusage 2>/dev/null || free  # swap in use
ps -Ao pcpu,comm | sort -rn | head -20   # top consumers, including other sessions
```

In one incident a bookkeeping step that normally takes under a second took 45 to 124
seconds and two agent steps hit their deadlines.
The load average was 30 to 217 on 10 cores, from another session’s CPU stress test, a
native build, and concurrent test suites.
The run’s scheduler reported pressure as normal because it watched only memory.

- Record host load beside run timings, so later readers can tell a slow step from a slow
  machine.
- Do not add heavy local work (full test suites, push hooks, page builds) while a run
  you are timing is in its busiest stage.
- Ask before stopping processes you did not start.

## Validate a Metric Before Reporting Its Finding

A new rollup, health check, or log parser is untested code.
Its most surprising number is as likely a counting bug as a real defect.

Before a finding goes into a plan, a ticket, or a message, open two or three of the raw
records behind it and confirm the tool counted them correctly.

- NEVER: “The self-check step is confused: 16 of 19 calls errored.”
  In that incident the calls were valid; reports over the parser’s 64 KiB line limit
  were counted as errors.
  A second “14 malformed calls” finding was 13 shell-policy refusals.
- Label figures you have not checked against raw evidence as unverified.

## Read the Prompt Before Blaming the Model

When one model or one run does worse than another on the same step, read what each
received and wrote before attributing the gap to model quality:

1. Read the step’s transcript, not only its final output.
2. Read the rendered prompt and any output template it fills.
3. Look for literal example values in templates.
   A template that pre-fills `consumer_business: true` anchors the answer, and a faster
   model is more likely to keep the default.
4. Check that every field the model fills is defined in the prompt.

In the incident behind this rule, a “less discriminating model” turned out to be an
undefined field with a pre-filled default.
The same model classified the same companies correctly in another step whose prompt
asked the question directly.
Use bracketed placeholders (`"[true|false]"`) rather than plausible values, and define
each field before comparing models.

## Compare Against a Same-Configuration Duplicate

A difference between two configurations means nothing until you know how much one
configuration differs from itself.
LLM steps are not reproducible by default.

- For a model or prompt comparison, run a duplicate of the baseline alongside the
  candidate on the same inputs.
- Report the candidate’s difference next to the duplicate’s. In one spot check over six
  companies, two models agreed on measured terms at a mean Jaccard similarity of 0.40,
  and two runs of the same model agreed at only 0.45: most of the apparent model
  difference was run-to-run variation.
- Declare the margin or test before reading the data.
  A rule that counts any excess disagreement as an effect flagged that 0.05 gap, which
  six companies cannot distinguish from noise.

## Re-Derive Timeouts When a Prompt Change Lengthens a Step

A prompt change that asks for more work changes the step’s duration, and every deadline
computed from it (wrapper timeouts, parent-step budgets, tests that pin those values).

- When a step starts timing out after a prompt change, measure it on a quiet host, raise
  its timeout with that measurement recorded, and recompute dependent deadlines.
- Keep derived deadlines computed from the step values, with a test, so a raise cannot
  leave the wrapper killing the step it was raised for.

## Never Wrap Hook-Running Commands in a Timeout

`timeout 300 git push` kills git when it expires, but a pre-push hook runner may keep
its subprocesses running in their own process groups.
The orphaned checks keep loading the host and can leave temporary files that fail the
next attempt.

- Run long pushes and commits in the background and wait for completion.
- If you must abandon one, find and stop its surviving hook processes before retrying.

## Brief Delegated Agents for Interruption

Delegated agents in isolated worktrees get interrupted by spend limits, context limits,
and restarts. Work they have not committed is lost.

Include in every worktree agent’s brief:

- Sync to the integration branch head before starting.
- Commit early and often, with tests passing at each commit where practical.
- Treat live run trees and launch checkouts as read-only.
- Report the branch, commit SHAs, tests run, and evidence paths.

Give concurrent agents disjoint file ownership where possible.
Resume an interrupted agent with its transcript rather than starting a fresh one.

This list is the interruption part of a delegated agent’s brief.
For authorization, model tiers, the rest of the brief, and verifying what the agent
reports, follow `tbd shortcut delegate-to-subagents`.

## Show Partial Failure at Its Real Scale

A status page that renders one incomplete item as a paragraph of red makes a nearly
complete batch look failed, and readers stop trusting it.

- Show each group as one line: a check and the item count when complete, or “2 of 48
  incomplete: A, B” in a muted color.
- Put per-item detail in a collapsed, smaller section.
- Compute one structured summary and render the page and any exit gate from it, so the
  display and the gate cannot disagree.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
