---
title: Code Review Rules
description: The language-neutral substance of a code review—the Blocker/High/Medium/Low severity vocabulary, establishing a baseline before hunting findings, reviewing highest-risk boundaries first, writing findings that can be acted on, and a quick-scan table of patterns with default severities. The review-code shortcuts are the procedure; this is what they apply. Load for any review, with the language-specific review document where one exists.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Code Review Rules

This document defines how to order a review, assign severity, and report findings.
It is the substance; the `review-code*` shortcuts are the procedure that applies it
(`tbd shortcut review-code`), and the topic guidelines own the actual rules for each
surface.

Run it after formatting, lint, type checks, and tests pass.
Automated ownership should not consume review time unless the automation is missing,
disabled, or demonstrably failed—in which case that is itself the first finding.

**Related**:

- `tbd shortcut review-code` (the review procedure and artifact format)
- `rust-code-review-rules` (unsafe and FFI review)
- `general-eng-agent-principles` (objectivity, and not reporting a preference as a
  defect)
- `ci-and-gates-rules` (when the change is to a gate rather than to code)

## Severity

| Tag | Meaning |
| --- | --- |
| **Blocker** | Must fix before merge; correctness, security, or soundness failure |
| **High** | Strongly recommended; substantial API, reliability, or maintenance risk |
| **Medium** | Should fix; idiom, clarity, test, or moderate design concern |
| **Low** | Optional improvement with a concrete benefit |

Assign severity from impact and likelihood, not from personal preference or from how
much the code annoys you.
This is the vocabulary review artifacts use throughout; do not introduce a fifth level
or rename these.

Severity is about the defect, not about the fix.
A one-character change that causes data loss is a Blocker; a correct-but-sprawling
refactor is not.

## Load the Rules That Own the Changed Surface

Load the general guidelines for every review, then add only the documents matching the
diff and its runtime boundaries:

| Changed surface | Additional guideline |
| --- | --- |
| Build config, toolchains, CI, hooks, or gate scripts | `ci-and-gates-rules` |
| Paths, traversal, file mutation, metadata, or recovery | `filesystem-rules` |
| Artifacts, publishing authority, channels, or version identity | `release-engineering-rules` |
| Dependencies added, upgraded, or newly executed at build time | `supply-chain-hardening` |
| Public API or persisted data shape | `backward-compatibility-rules` |
| Test placement, fixtures, snapshots, or coverage | `general-testing-rules` |
| Language-specific code | the language’s `*-rules` and `*-lint-format-rules` |

Also load the project’s own contracts.
Do not review from this process document alone: it says how to review, not what is
correct.

## Establish the Baseline Before Hunting Findings

A review that starts at the first changed line finds typos and misses the design.

1. Read the request, specification, linked issues, and repository instructions.
2. Inspect the full diff plus enough surrounding code to understand changed control
   flow, ownership, failure paths, and external effects.
3. Run or inspect the required automated checks.
   Confirm how many tests ran and whether any selection was skipped—a suite that
   silently ran zero tests is a common and invisible failure.
4. Identify the public, persisted, cross-process, unsafe, and destructive contracts the
   change can affect.
5. Reproduce a suspected defect, or trace an exact failing path, before reporting it as
   fact.

Step 5 is the one that separates a useful review from an expensive one.
A confidently-worded finding that turns out to be wrong costs the author more time than
the finding would have saved, and it discounts every later finding in the same review.

## Review the Highest-Risk Boundaries First

Review in this order unless the change has a more specific risk profile:

1. unsafe code and foreign-function boundaries;
2. data loss, authentication, authorization, and destructive operations;
3. errors, partial failure, and recovery;
4. public APIs and compatibility;
5. concurrency, cancellation, and shutdown;
6. resource lifetimes and cleanup;
7. dependencies and build-time execution;
8. performance-sensitive paths;
9. tests, docs, organization, and idiom.

Do not spend the review budget on low-risk style while a higher-risk boundary is still
unread. Review attention is finite and front-loaded; whatever is reviewed last is
reviewed worst.

## Assess the Design, Not Only the Diff

The diff shows what changed, not whether it should have.
For any non-trivial change, state explicitly:

- whether a materially better approach exists, and what it would cost;
- what the change makes harder later—the abstraction it locks in, the migration it
  implies, the case it now special-cases;
- whether an existing library, module, or in-repo helper already does this.
  Duplication introduced by a change is cheapest to remove during review and never
  afterward.

If the design is sound, say so in one line and move on.
“No better alternative found” is a finding worth recording; silence is not.

## Write Findings That Can Be Acted On

Each finding contains:

- a severity from the table above;
- the narrowest `file:line` range that demonstrates the problem;
- the violated behavior, invariant, or policy;
- the concrete consequence or failure path—inputs and state that produce the wrong
  result, not “this could break”;
- a bounded fix that does not expand the requested scope.

Additional rules that keep a review honest:

- **Do not report a preference as a defect.** If it is a preference, mark it Low and say
  it is one.
- **Say what is uncertain, and what check would resolve it.** “I could not determine
  whether callers hold the lock here; if they do not, this is a Blocker” is useful.
  Stating it flatly as a Blocker when you did not check is not.
- **Group repeated instances under one root-cause finding** when a single correction
  addresses all of them.
  Fifteen findings that are one mistake read as fifteen mistakes.
- **Record confirmed false positives.** A finding you investigated and dismissed is
  evidence the area was reviewed; dropping it silently means the next reviewer repeats
  the work.

End with a short verdict, the validation evidence you actually inspected, and any
remaining risks that could not be tested locally.

## Quick Scan

Patterns worth grepping for, with the severity each usually warrants.
The scan says where to investigate; it does not replace reading the changed control
flow.

| Pattern | Default severity |
| --- | --- |
| destructive operation whose resolved scope is not verified | Blocker |
| required error or task result discarded | Blocker |
| unsafe block or FFI call without a traceable safety argument | Blocker |
| authorization decided from unvalidated or pre-resolution input | Blocker |
| success reported before all required work is verified | High |
| partial failure reported as success (batch exits zero after failures) | High |
| non-atomic write to a file another process reads | High |
| blocking work on an async executor, or a lock held across I/O or await | High |
| unexplained production `unwrap`/`!`/bare `catch {}` swallowing an error | High |
| new always-on dependency added without a stated reason | High |
| mutable or unreviewed action, image, or build-tool pin | High |
| public item used only inside its own module or crate | Medium |
| test skipped, ignored, or narrowed without a tracking issue | Medium |
| suppression comment without a non-obvious reason or tracker ID | Medium |
| abstraction, trait, or interface with exactly one consumer | Medium |
| TODO, FIXME, or HACK without tracking | Medium |
| generated file edited by hand | Medium |

Two of these are worth stating as explicit review questions rather than pattern matches,
because grep will not find them: *does this change make a check unable to fail?* and
*does this test still assert what its name claims?* A gate that was weakened and a test
that was adjusted to pass both look like small green diffs.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
