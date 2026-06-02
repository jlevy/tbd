---
title: General Engineering Principles
description: Core engineering process principles — detailed understanding, end-to-end ownership, scope discipline, tracking future work, acting versus seeking clarification, verification, and calibrated uncertainty
author: Joshua Levy (github.com/jlevy)
---
# General Engineering Principles

1. **Always seek detailed understanding:** Vague thinking is not acceptable.
   Do *not* use waffle words like “flaky” or “somehow” that hide understanding.
   That is sloppy reasoning and will lead you astray.
   You need to investigate exact code, logs, and relevant details.
   You need to reproduce problems.
   - NEVER: “The failure was due to a flaky test.”
     (Flaky how? In what situations?)
     “The lost characters were swallowed somehow.”
     (How? How will we find out?)

2. **Assume things will not work unless verified:** Verify failures before assuming a
   fix is working. Always follow red-green TDD. See `general-tdd-guidelines`.

3. **Be precise about uncertainty:** Do not jump to conclusions.
   Never guess at explanations then present them as true: you must either confirm exact
   causes for problems or, if you cannot determine exact causes, clearly state your
   uncertainty and where you are stuck.

4. **Take responsibility for end to end functioning:** If there is a failure never
   dismiss as out of scope.
   Investigate exactly what’s happening and then triage.
   - NEVER: “The test failures are due to an unrelated infrastructure issue.”
     (You own the current work, and if the infrastructure is failing it needs to be
     fixed or tracked.)

5. **Never quietly change priorities:** If you believe the goals of a project need to
   change, this needs to be clarified.
   - NEVER adjust the goal or scope of a spec to be reduced without prominently flagging
     the need for the change with the user.
   - You can prioritize tasks, but you must always do *every* task you were asked to do
     or escalate if you cannot.

6. **Track all work that is not being done immediately:** Not all work can be done
   immediately. But you should neither drop nor ignore new issues when they arise.
   The solution is to *track future work*. Update a plan or spec (if one is in scope) or
   file a ticket or bead (as appropriate).

7. **Act whenever there is clarity:** For clear situations where the fix or correction
   is unambiguous and not costly, *take action* and fix it immediately, without seeking
   confirmation.
   - NEVER: “The code has 15 linting warnings.
     Would you like me to fix it?”
     (This is immediately fixable and obviously the right thing to do.)

8. **Seek clarifications when there is ambiguity or high cost:** In contrast, if there
   is a problem but more than one reasonable solution, or if the solution has cost or
   risk, then seek clarification before acting.
   It’s possible there is another solution or the goal could be adjusted.
   - NEVER: “The bug does not seem reproducible in the dev environment.
     Let me try the code on the production environment.”
     (No! That has risk and is not clearly the right way to handle the problem.)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
