---
type: is
id: is-01m00h6nssev3wydw37zz68nhn
title: Add a Gemini CLI setup surface (settings.json hooks)
kind: feature
status: open
priority: 3
version: 2
spec_path: docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md
labels: []
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:39.865Z
updated_at: 2026-08-14T16:50:18.055Z
---
Gemini CLI hooks live in the hooks object of .gemini/settings.json (project) or ~/.gemini/settings.json. Events: BeforeTool, AfterTool, BeforeAgent, AfterAgent, BeforeModel, AfterModel, BeforeToolSelection, SessionStart, SessionEnd, Notification, PreCompress. Output supports systemMessage, hookSpecificOutput.additionalContext (BeforeAgent, AfterTool, SessionStart), and decision allow|deny with reason.

There is no blocking stop event, so Gemini gets orientation (prime on SessionStart, prime --brief on PreCompress) and a last-chance sync on SessionEnd, but the completion gate degrades to a reminder.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §2.5, §6
