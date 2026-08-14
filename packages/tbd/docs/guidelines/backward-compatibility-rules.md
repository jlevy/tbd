---
title: Backward Compatibility Rules
description: Guidelines for maintaining backward compatibility across code, APIs, file formats, plugin surfaces, and database schemas, including how to decide whether compatibility is needed at all
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
## Backward Compatibility Guidelines

Backward compatibility protects a consumer that must keep using the old contract after
your change ships. Where such a consumer exists, the cost buys something real.
Where none exists, it buys nothing.

The cost is not one-time.
Every alias, fallback branch, extra reader, and migration path becomes state that every
later change has to discover, preserve, test, and describe.
Those paths compose: each one multiplies the cases the next person must reason about,
and each one looks like evidence of a constraint, so later work preserves it and adds
more.
Deciding the requirement *before* implementing is what keeps that from compounding.

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

### Finding the Compatibility Boundary

For each area, ask:

> **After this change ships, must some real consumer keep using the old contract?**

Name that consumer: a released version still in use, a component that deploys on its own
schedule, a third-party integration, data already written to a user’s disk.
If you can name one, compatibility is real for that area.
If you cannot, the answer is DO NOT MAINTAIN.

The boundary is *shipping*, not the commit.
Two components changed in one commit still need compatibility if they reach production
independently, and components in separate repositories may need none if they always ship
together.

These are not consumers, and treating them as such is the most common way unnecessary
compatibility code enters a codebase:

- “Someone might be running an older client,” where the deployment makes that
  impossible.
- A future version of this same codebase.
- Your own tests, which you can update.
- A hypothetical integration that does not exist yet.
- An unreleased format or interface, however carefully designed.

Decide from evidence, not intuition:

- **Deployment topology.** Determine whether the pieces can actually run at different
  versions. Independently deployed services usually can; a client shipped inside the same
  artifact, with no stale cache path, usually cannot.
- **Release history.** Persisted state and file formats need migration only for shapes
  some released version actually wrote.
  Check the tags rather than assuming.
- **Adoption.** Count the consumers you do not control.
  A pre-1.0 interface with none is cheaper to change than to carry.
- **Persisted data.** Data already written outlives the code that wrote it, so it is a
  consumer even when no running program is.

A synthetic test can exercise an unneeded path, so coverage is not evidence of need: it
shows the branch runs, and it entrenches the branch.

### Choosing the Smallest Valid Response

Compatibility is not the only answer to a changing contract, and it is the most
expensive one. Two alternatives often serve better, and neither is a compatibility mode:

- **Detect and refuse.** Stamp a version, revision, or fingerprint, ship exactly one
  reader, and reject anything else with a clear error.
  Worth doing wherever a mismatch can actually occur and would otherwise be hard to
  diagnose; unnecessary where the pieces cannot diverge.
  Versioning is about diagnosis, not compatibility: you can version a payload without
  accepting an old one.
- **Enforce an upgrade.** Where a host loads code or data it does not ship — plugins,
  extensions, adapters — declare the contract version the host provides and refuse
  anything else at load time, with an error naming the required version and what to do.
  For a young ecosystem, upgrading the consumers usually costs less than carrying a
  compatibility layer per generation.

A version field that is recorded but never compared is worse than no field: it implies a
guarantee the host does not provide.

### Backward Compatibility Requirements Template

> Use the following template when clarifying backward compatibility requirements:

Answer each area with one of:

- “DO NOT MAINTAIN” — make the change and remove the old path entirely

- “KEEP DEPRECATED” — keep the old surface working alongside the new one, and state what
  is deprecated, how consumers are notified, and when it will be removed

- “SUPPORT BOTH” — keep both shapes usable at the same time, with no removal planned

- “VERSION + FAIL FAST” — not compatibility: stamp an identity, ship one reader, refuse
  anything else with a clear error

- “UPGRADE + GATE” — not compatibility: break the contract, refuse mismatched consumers
  at load time, and expect them to update

- “MIGRATE” — convert existing data or schemas forward through documented migrations

- “N/A” — this area isn’t applicable

**BACKWARD COMPATIBILITY REQUIREMENTS:**

- **Code types, methods, and function signatures**:
  [DO NOT MAINTAIN or KEEP DEPRECATED, additional notes if necessary]

- **Library APIs**:
  [DO NOT MAINTAIN or KEEP DEPRECATED or N/A, plus any additional notes]

- **Server APIs**:
  [DO NOT MAINTAIN or KEEP DEPRECATED or VERSION + FAIL FAST or N/A, plus any additional notes]

- **Plugin and extension APIs**:
  [DO NOT MAINTAIN or UPGRADE + GATE or KEEP DEPRECATED or N/A, plus any additional notes]

- **File formats**:
  [DO NOT MAINTAIN or VERSION + FAIL FAST or SUPPORT BOTH or N/A, plus any additional notes]

- **Persisted client state**:
  [DO NOT MAINTAIN or MIGRATE or N/A, plus any additional notes]

- **Database schemas**: [DO NOT MAINTAIN or MIGRATE or N/A, plus any additional notes]

ALWAYS be clear on these requirements when making changes, and state them in any
specification. If they are not clear, stop and ask for clarification.

Better than asking per change: record the answers once in the repository’s own
development guidance, so each change reads them instead of re-deciding.
Revisit them when the boundary moves — a first external adopter, a published format, a
component that starts deploying separately.

### Removing Compatibility Code

Layers are easy to add and hard to remove, because removing one means re-deriving the
argument that nothing depends on it.

- Unless the spec or the user says otherwise, do not leave deprecated or compatibility
  code behind after refactoring within a single application.
  Remove the old functions, methods, classes, or files completely.

- When you find an alias, fallback, or shim whose consumer you cannot name, delete it as
  part of the change you are already making.
  Do not file it as future cleanup; a deferred removal is how a transitional layer
  becomes permanent.

- In review, a compatibility branch whose protected consumer nobody can name is a
  finding, not a detail.

- Describe the surface that exists now.
  Removed paths belong in release notes if they affect consumers, not in comments
  narrating what the code used to do.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
