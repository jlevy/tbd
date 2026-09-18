---
type: is
id: is-01m2tkmmeq121r99se678ph0m8
title: Reviewer briefs must forbid leaking probe env vars into a shared shell session
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2thkcy6mtxxrstgdqzstx1p
created_at: 2026-09-18T15:54:53.271Z
updated_at: 2026-09-18T17:23:12.672Z
closed_at: 2026-09-18T17:23:12.672Z
close_reason: "Fixed in a8fd4fb0: delegate-to-subagents reviewer role and review-github-pr step 7 require probe env vars to be set per command or in a subshell"
resolution: null
duplicate_of: null
---
Found while addressing review C. A delegated reviewer's CLI probes exported GIT_CONFIG_GLOBAL=/tmp/rev-f/gitconfig plus GIT_AUTHOR_NAME/EMAIL and GIT_COMMITTER_NAME/EMAIL (identity 'Probe <probe@example.com>') into the shell session the coordinator also uses, so the coordinator's next commit was authored by Probe and had to be amended (288c38b0 -> 28de4614). On platforms that share one shell session between a coordinator and its sub-agents this is a live hazard: a leaked GIT_CONFIG_GLOBAL also changes what git reads for every later command. Fix on #309, which owns these shortcuts: delegate-to-subagents Reviewer role and review-github-pr step 7 should say a reviewer leaves the session environment as it found it, setting probe variables per command (env VAR=... cmd) or in a subshell, and the coordinator should verify git identity before committing.
