---
type: is
id: is-01m0xma9qkvysyt0kn73pxzdyg
title: Remove generic advice from the general testing rules
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies: []
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:02.834Z
updated_at: 2026-08-26T00:33:10.022Z
closed_at: 2026-08-26T00:33:10.021Z
close_reason: Removed the generic Core Principles material and replaced it with concrete retention, vacuous-test, loop-budget, and portability rules.
resolution: null
duplicate_of: null
---
Let's tighten up the testing doc and keep it focused. Much of your advice is very generic and not immediately actionable or likely to trigger a competent coding agent to do a lot differently.

Make every retained rule name a concrete test smell, decision, failure mode, or technique, with specific rationale and examples. Remove guidance that any competent coding agent would already know. This should remain specific without being overly prescriptive; leave it up to the agent to decide when each principle applies.
