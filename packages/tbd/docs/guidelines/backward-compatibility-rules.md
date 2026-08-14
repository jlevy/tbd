---
title: Backward Compatibility Rules
description: Guidelines for maintaining backward compatibility across code, APIs, file formats, plugin surfaces, and database schemas, including how to decide whether compatibility is needed at all
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
## Backward Compatibility Guidelines

Backward compatibility is a cost paid to protect a consumer that cannot be updated in
the same change. When such a consumer exists, that cost buys something real.
When one does not, the same code buys nothing and cannot even be tested honestly,
because no input can reach it.

These guidelines cover both halves: how to decide whether compatibility is needed, and
what to do once you know.

### Types of Backward Compatibility

When making code changes, you should be aware of compatibility requirements for:

- Code compatibility internal to a single application (types and method or function
  signatures)

- API compatibility for libraries (types and method or function signatures)

- Server API compatibility (REST, GraphQL, gRPC, etc.)

- Plugin and extension APIs, where a host loads code it does not ship

- File format compatibility, including exported and interchange artifacts

- Persisted client state (browser storage, cookies, local preference files)

- Database schema compatibility

### The Deciding Question

For each area, ask one question:

> **Does a consumer exist today that cannot be updated in the same commit?**

Name it. A specific released version, a separately deployed client, a third-party
integration, data already on a user’s disk.
If you cannot name one, the answer for that area is DO NOT MAINTAIN.

The following are **not** consumers, and treating them as such is the most common way
unnecessary compatibility code enters a codebase:

- “Someone might be running an older client.”
  If they cannot be, they are not a consumer.
- A future version of this same repository.
- A hypothetical third-party integration that does not exist yet.
- An unreleased format or interface, however carefully designed.

Three facts usually settle the question:

- **Deployment coupling.** If the client and server ship as one artifact and the client
  cannot cache across an upgrade, there is no version skew for compatibility code to
  protect against. A single deployable unit with cache-busted assets is internal code,
  whatever protocol runs between its halves.
- **Release history.** Persisted state and file formats need migration only for shapes
  that some released version actually wrote.
  Check the tags before assuming.
- **Maturity and adoption.** A pre-1.0 interface with no external adopters is cheaper to
  break than to carry.

### Versioning Is Not Backward Compatibility

These are separate decisions, and conflating them is expensive.

- **Versioning** stamps a payload with a version, revision, or fingerprint so a consumer
  can detect a mismatch and **fail loudly**. This is cheap, and for anything that leaves
  the process it is required.
- **Backward compatibility** keeps a reader for the old shape alongside the new one.
  This is the expensive part.

You can and usually should version without maintaining compatibility: stamp the
identity, ship exactly one reader, and refuse anything else with a clear error.
A consumer that sees an unfamiliar identity should stop, not guess.

### Enforce an Upgrade Instead of Absorbing It

When a host loads code or data it does not ship — plugins, extensions, adapters — a hard
version gate is usually cheaper and safer than a compatibility layer per generation.

- Declare the contract version the host provides.
- Refuse anything else at load time, with an error naming the required version and what
  to do about it.
- Bump that version only when the contract actually breaks, and update everything you
  ship in the same commit.

This makes a break loud and immediate instead of a mysterious failure deep inside a
consumer. For a young ecosystem, upgrading the consumers is nearly always cheaper than
carrying support for every generation of the interface.

A version field that is recorded but never compared is worse than no field at all: it
implies a guarantee the host does not actually provide.

### Backward Compatibility Template

> Use the following template when clarifying backward compatibility requirements:

For the following areas:

- “DO NOT MAINTAIN” means simply make the changes and DO NOT preserve any old stubs or
  add comments about past changes

- “KEEP DEPRECATED” means to add new features but also preserve support, function stubs,
  and comments about past changes

- “SUPPORT BOTH” means to add new features while also preserving a working path for the
  old shape, so both remain usable at the same time

- “VERSION + FAIL FAST” means to stamp an identity and ship one reader, refusing an
  unrecognized version with a clear error rather than interpreting it

- “UPGRADE + GATE” means to break the contract deliberately, refuse mismatched consumers
  at load time with an actionable error, and expect them to update

- “MIGRATE” means to add new features but also document and use database migrations or
  automated tasks to migrate to new formats or schemas

- “N/A” means this area isn’t applicable

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**:
  [DO NOT MAINTAIN or KEEP DEPRECATED, additional notes if necessary]

- **Library APIs**:
  [DO NOT MAINTAIN or KEEP DEPRECATED or N/A, plus any additional notes]

- **Server APIs**:
  [DO NOT MAINTAIN or KEEP DEPRECATED or N/A, plus any additional notes]

- **Plugin and extension APIs**:
  [DO NOT MAINTAIN or UPGRADE + GATE or KEEP DEPRECATED or N/A, plus any additional notes]

- **File formats**:
  [DO NOT MAINTAIN or VERSION + FAIL FAST or SUPPORT BOTH or N/A, plus any additional notes]

- **Persisted client state**:
  [DO NOT MAINTAIN or MIGRATE or N/A, plus any additional notes]

- **Database schemas**: [DO NOT MAINTAIN or MIGRATE or N/A, plus any additional notes]

### Always Clarify Backward Compatibility Requirements

- ALWAYS be clear on backward compatibility requirements when making changes.
  These should ALWAYS be clear in any specification.

- If they are not clear, stop and ask the user for clarification.

- Better than asking per change: record the standing answers once, in the repository’s
  own development guidance, so each change reads them instead of re-deciding.
  Revisit them when the deciding question’s answer changes — a first external adopter, a
  published format, a client that starts shipping separately.

### When Backward Compatibility Is Important

- In general, compatibility for libraries, servers, file formats and database schemas is
  VERY IMPORTANT. Compatibility and migration should be planned carefully.

- That importance comes from having consumers you do not control, not from the category
  itself. A server API consumed only by a client shipped in the same artifact, or a
  library with no external adopters, is internal code and should be treated as such.

- Backward compatibility and legacy support *within* a single application is usually NOT
  important and should NOT be done if it needlessly complicates code changes.
  But if not specified, it also should be clarified to be sure it is not needed.

### Single Application Code Backward Compatibility

- Unless stated in the spec or stated by the user, deprecated and backward compatibility
  code support should NOT be left after refactors to a single application repository.

- When doing normal refactoring or reorganizing code, REMOVE deprecated functions,
  methods, classes, or files completely if backward compatibility is not needed.

- Change an internal contract everywhere in one commit: rename the field, update every
  caller, update the tests, and record it in the changelog.
  Removing an internal interface is a normal edit, not a migration.

### Removing Compatibility Code That Is No Longer Needed

Compatibility layers are easy to add and hard to remove, because removing one means
re-deriving the argument that nothing depends on it.

- When you find an alias, fallback branch, or shim whose consumer you cannot name,
  delete it as part of the change you are already making.

- Do not file it as future cleanup.
  A deferred removal is how a transitional layer becomes permanent, and the deadline
  usually passes unnoticed.

- In review, a compatibility branch whose protected consumer nobody can name is a
  finding, not a detail.

- Unreachable compatibility code is not merely unused.
  No test can exercise it, so it rots silently, and it misleads every later reader into
  believing a constraint exists.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
