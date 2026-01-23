---
title: New Architecture Doc
description: Create an architecture document for a system or component design
---
Shortcut: New Architecture Doc

We track issues with tbd.
Run `tbd` for more on using tbd and current status.

Instructions:

Create a to-do list with the following items then perform all of them:

1. Clarify the architecture scope with the user:
   - What system or component are we designing?
   - Is this a new design or documenting existing architecture?
   - What level of detail is needed?

2. Review existing architecture docs in @docs/project/architecture/ if available.
   Also review any related specs in @docs/project/specs/active/.

3. Create the architecture document at
   @docs/project/architecture/arch-YYYY-MM-DD-component-name.md with these sections:

   ## Overview

   High-level description of what this architecture covers.

   ## Goals and Non-Goals

   What this design aims to achieve and explicitly excludes.

   ## System Context

   How this component fits into the larger system (diagram if helpful).

   ## Design

   ### Components

   Key components and their responsibilities.

   ### Data Flow

   How data moves through the system.

   ### Interfaces

   APIs, contracts, or integration points.

   ## Trade-offs and Alternatives

   Design decisions made and alternatives considered.

   ## Security Considerations

   Authentication, authorization, data protection as applicable.

   ## Operational Concerns

   Monitoring, logging, deployment, scaling considerations.

4. If documenting existing architecture, review the codebase to ensure accuracy.
   If designing new architecture, iterate with the user on the design.

5. Summarize the architecture and ask the user to review.
