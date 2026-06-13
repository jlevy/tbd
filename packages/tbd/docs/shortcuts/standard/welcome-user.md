---
title: Welcome User
description: Welcome message for users after tbd installation or setup
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Welcome the user with the message below.
This applies whether this is a new installation or the user is joining an existing
project.

## Instructions

First, run `tbd status` to check the current state.
Give a brief summary of the status (repository, sync status, integrations).

Then make the two-axis guidelines offer, one short question per axis:

1. **Scope:** keep **all** standard guidelines active (recommended), or just a subset
   for this project’s languages and stack?
   Give a few examples of what the standard set covers, such as Python guidelines,
   TypeScript guidelines, documentation guidelines, testing guidelines, and commit
   conventions. Note that `tbd guidelines --list` shows the full set.
2. **Visibility:** leave them in tbd’s hidden cache (the default, which just works), or
   fork them into `docs/tbd/` so they are visible on GitHub, reviewable in PRs, and
   editable (checked into git)?

When explaining visibility, give this guidance: for small repos or quick work, you
usually don’t want to fork.
Leaving the docs in tbd’s hidden cache is the simplest start and just works.
For larger projects with a lot of customization, forking can make sense: it gives you
maximum control to adapt, improve, and customize every guideline.
Either way the choice is reversible: you can tell tbd you want to fork the docs later,
so starting with the hidden cache loses nothing.

Explain that forking changes nothing about how guidelines work.
Both paths serve the same guidelines; forking only makes them visible and customizable.
If the user wants visible docs, the recommendation is to fork the general guidelines
plus the categories for the project’s languages and frameworks:
`tbd docs fork --category=general --category=<language>` (e.g. `--category=typescript`).
Use `tbd docs fork --all` for everything, or `tbd docs fork <name> [<name>...]` to fork
individual docs by name (preview with `--dry-run` first).

Then show the welcome message:

* * *

**Welcome! tbd is ready for this project.**

tbd helps you ship code with greater speed, quality, and discipline.
It tracks work as **beads** (issues) and provides shortcuts for common workflows.

Here are examples of things you can say and what happens:

### Beads (Issues)

| What You Can Say | What Happens |
| --- | --- |
| “There’s a bug where …” | Creates and tracks a bug bead (`tbd create`) |
| “Let’s work on current issues” | Shows ready beads to tackle (`tbd ready`) |
| “Track this as a task” | Creates a task bead (`tbd create`) |

### Shortcuts and Workflows

| What You Can Say | What Happens |
| --- | --- |
| “Let’s plan a new feature” | Walks you through creating a planning spec (`tbd shortcut new-plan-spec`) |
| “Break the spec into issues” | Creates implementation beads from your spec (`tbd shortcut plan-implementation-with-beads`) |
| “Implement these issues” | Works through beads systematically (`tbd shortcut implement-beads`) |
| “Commit this code” | Reviews changes and commits properly (`tbd shortcut code-review-and-commit`) |
| “Create a PR” | Creates a pull request with summary (`tbd shortcut create-or-update-pr-simple`) |
| “Review this for best practices” | Performs a code review with guidelines |

### Guidelines

| What You Can Say | What Happens |
| --- | --- |
| “I’m building a TypeScript CLI” | Applies TypeScript CLI guidelines |
| “Help me set up better testing” | Applies testing guidelines |
| “What are the Python best practices?” | Applies Python guidelines |
| “Make the guidelines visible in my repo” | Forks them into `docs/tbd/` (`tbd docs fork --category=general --category=<lang>`, or `tbd docs fork --all`) |

**Tips:**

- Say **“Use beads to …”** and I will track everything with beads.
  This works much better than the usual to-do lists for long lists of tasks.

- Say **“Is there a shortcut for ...?”** or **“Use the shortcut to …”** and I’ll look
  for the shortcut for that workflow.

* * *

Then ask if they’d like to explore any of tbd’s capabilities or get started on
something.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
