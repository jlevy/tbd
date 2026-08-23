---
title: Code Review Rules
description: The language-neutral substance of a code review—the Blocker/High/Medium/Low severity vocabulary, establishing a baseline before hunting findings, reviewing highest-risk boundaries first, writing findings that can be acted on, and investigative quick-scan questions with possible consequences. The review-code shortcuts are the procedure; this is what they apply. Load for any review, with the language-specific review document where one exists.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Code Review Rules

This document defines how to order a review, assign severity, and report findings.
It is the substance; the `review-code*` shortcuts are the procedure that applies it
(`tbd shortcut review-code`), and the topic guidelines own the actual rules for each
surface.

Inspect formatting, lint, type-check, and test results before the manual review.
A missing or failed required gate is a finding, but it does not justify postponing
review of independent higher-risk boundaries.
Do not spend manual review time repeating work an effective passing gate already owns.

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

Patterns worth grepping for, each with the question that decides whether it is a
finding. A pattern is not a severity: severity comes from reachability, impact,
likelihood, and what already contains the failure, and none of those are visible in the
grep hit. Carrying a preassigned severity through the scan produces exactly the review
this document is trying to prevent—a list of matches reported at the level the table
suggested.

| Pattern | Question that decides it | If the answer is bad |
| --- | --- | --- |
| destructive operation whose resolved scope is not verified | What is the widest path this can resolve to, and who can influence it? | Blocker: data loss outside the intended tree |
| required error or task result discarded | Does any caller depend on the work that error reports failed? | Blocker: silent partial state reported as success |
| unsafe block or FFI call without a traceable safety argument | Which safe input can violate the invariant, and where is it checked? | Blocker: memory unsafety from safe code |
| authorization decided from unvalidated or pre-resolution input | Can the value change between the check and the use? | Blocker: access granted on a value the caller controls |
| success reported before all required work is verified | What does the exit status prove was completed? | High: a green run over unfinished work |
| partial failure reported as success (batch exits zero after failures) | Does the caller distinguish “all done” from “some done”? | High: undetected partial results |
| non-atomic write to a file another process reads | Can a reader observe the file mid-write, or after a crash? | High: truncated file read as valid data |
| blocking work on an async executor, or a lock held across I/O or await | How long, on which runtime, and what else shares that thread or lock? | Blocker on a shared runtime; Low in a one-shot CLI |
| unexplained production `unwrap`/`!`/bare `catch {}` swallowing an error | Is the invariant established locally, or assumed from a caller? | High: a crash or a swallowed failure on real input |
| new always-on dependency added without a stated reason | What does it replace, and what does it execute at install or build time? | High: unreviewed code in the build |
| mutable or unreviewed action, image, or build-tool pin | Can the referenced code change without a diff? | High: unreviewed code in a privileged context |
| public item used only inside its own module or crate | Is it a deliberate API surface or leaked internals? | Medium: a compatibility obligation nobody chose |
| test skipped, ignored, or narrowed without a tracking issue | What regression class is now unguarded, and who is reminded? | Medium: permanent silent gap |
| suppression comment without a non-obvious reason or tracker ID | Is the rule wrong here, or is the code wrong? | Medium: a suppression that outlives its cause |
| abstraction, trait, or interface with exactly one consumer | Is a second consumer real and near, or hypothetical? | Low: indirection with no payer |
| TODO, FIXME, or HACK without tracking | Is this a note or an unshipped requirement? | Medium if it is a requirement, Low otherwise |
| generated file edited by hand | Will the generator overwrite this, and does CI notice? | Medium: the change silently disappears |

Reserve Blocker for a consequence you can describe as a sequence of events, not for a
construct that is usually risky.

Two of these are worth stating as explicit review questions rather than pattern matches,
because grep will not find them: *does this change make a check unable to fail?* and
*does this test still assert what its name claims?* A gate that was weakened and a test
that was adjusted to pass both look like small green diffs.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
