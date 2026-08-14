---
title: Backward Compatibility Rules
description: Guidelines for maintaining backward compatibility only for real consumers and data from released versions
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
## Backward Compatibility Guidelines

Compatibility work preserves existing consumers and data across a contract change.
It is justified only when a real consumer cannot update with the producer or data
written by a released version requires migration.

> **Default:** Name that consumer or data and explain why a coordinated update is
> insufficient. If none exists, choose **DO NOT MAINTAIN**.

Compatibility is not free insurance.
Every retained alias, shim, fallback, dual reader, and migration path is an ongoing tax.
Each later agent must discover, understand, preserve, test, and document it.
Each later change must account for every retained path, so the cost compounds.
Because the paths look like real constraints, agents also propagate them.
Decide before implementation and carry only the cost tied to a verified boundary.

### Identify the Compatibility Boundary

Apply the decision independently to each contract area.
A compatibility boundary may involve:

- A released library or application version used outside the repository
- An independently deployed client or service
- A third-party integration, plugin, or extension
- A file, browser state, or database record written by a released version

These do not justify compatibility:

- An unreleased interface or format
- A hypothetical future integration
- A future version of the same codebase
- Tests and fixtures that can update with the code
- An old client that the deployment topology cannot serve
- General caution without a named boundary

Verify the facts that define the boundary:

- **Deployment:** Can old and new versions coexist after release?
  A shared commit does not prove an atomic deployment.
- **Release history:** Did any released version expose the contract or write the data?
- **Ownership and adoption:** Can every real consumer move in one coordinated change?
- **Persistence:** Will user-owned or long-lived data outlive the change?

If these facts are unknown, investigate or ask.
Do not invent a boundary or break a confirmed public one on an assumption.

### Choose the Smallest Valid Response

- **DO NOT MAINTAIN:** Update all producers, consumers, tests, and docs together.
  Remove the old names, shapes, stubs, and branches.
- **VERSION + FAIL FAST:** Stamp the current identity, accept one version, and reject an
  unknown version with an actionable error.
- **UPGRADE + GATE:** Reject an incompatible plugin or extension at load time and
  require it to upgrade.
- **KEEP DEPRECATED:** Retain an old public surface for named consumers, announce its
  deprecation, and define when it will be removed.
- **SUPPORT BOTH:** Keep old and new contracts working when their consumers must
  coexist.
- **MIGRATE:** Transform data written by released versions to one current format or
  schema.
- **N/A:** The area does not apply.

**VERSION + FAIL FAST** and **UPGRADE + GATE** make a breaking contract explicit; they
are not backward compatibility.
Use them when mismatches can occur but old behavior need not remain supported.
Do not add a version identifier unless the system checks it.

### State Requirements Once

> Copy this template into a specification and choose the smallest valid response or
> combination for each area.

**Backward compatibility requirements:**

- **Internal code:** [response]
- **Library APIs:** [response]
- **Server APIs:** [response]
- **Plugin and extension APIs:** [response]
- **File formats:** [response]
- **Persisted client state:** [response]
- **Database schemas:** [response]

Briefly justify each answer.
If old behavior remains supported, name the protected consumer or data, tests, and
support horizon or removal condition.

Record stable answers in project guidance rather than re-deciding them for every change.
Revisit them when the boundary changes, such as after a first public release, external
adoption, independent deployment, or newly persisted data.

### Remove Compatibility When the Boundary Ends

Delete compatibility code when its named consumer disappears or its migration completes.
Do not defer aliases, fallbacks, or shims as future cleanup.
In review, treat a compatibility path without a verified boundary as a finding.
Tests can show that a path works; they cannot establish that anyone needs it.
Record consumer-visible removals in release notes, not comments that narrate history.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
