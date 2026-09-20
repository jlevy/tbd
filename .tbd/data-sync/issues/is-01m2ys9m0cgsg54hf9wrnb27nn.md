---
type: is
id: is-01m2ys9m0cgsg54hf9wrnb27nn
title: Keep Markdown policy visibility aligned after reference definitions
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels: []
dependencies: []
parent_id: is-01m2ynnnzw1d0kxwm0s4qvdevf
hold: null
hold_until: null
created_at: 2026-09-20T06:50:41.541Z
updated_at: 2026-09-20T06:50:52.717Z
started_at: 2026-09-20T06:50:52.716Z
---
Final review found marked lexer omits link-definition tokens. The raw-HTML guard sums emitted token.raw lengths, so HTML spans are shifted after definitions; a sufficiently long preceding definition can make hidden grants appear visible. Correct source tracking using existing Markdown grammar, cover reference definitions and hidden title content, and retain visible blocks after definitions/HTML. This refines L2 before merge readiness.
