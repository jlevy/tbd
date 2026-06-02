---
title: Shortcut System Explanation
description: How tbd shortcuts work for agents
---
# tbd Shortcuts

Shortcuts are reusable instructions for common tasks.
Give a name or description and tbd will find the matching shortcut and output its
instructions.

## How to Use

1. **Find by name**: `tbd shortcut new-plan-spec` (exact match)
2. **Find by description**: `tbd shortcut "create a plan"` (fuzzy match)
3. **List all**: `tbd shortcut --list`
4. **Follow the instructions**: The shortcut content tells you what to do

## What Shortcuts Contain

Each shortcut is a markdown document with step-by-step instructions.
These may include:
- Creating beads with `tbd create`
- Running other shortcuts via `tbd shortcut <name>`
- File operations and git workflows
- Prompts for gathering information from the user

## Referencing Other Shortcuts, Guidelines, and Templates

Shortcuts refer to each other by **name**, using the command that surfaces them:

- Another shortcut: `tbd shortcut <name>` (e.g. `tbd shortcut precommit-process`)
- A guideline: `tbd guidelines <name>` (e.g. `tbd guidelines typescript-rules`)
- A template: `tbd template <name>` (e.g. `tbd template plan-spec`)

Always reference by name, never by file path.
The name is stable wherever the shortcut lives, so the reference stays valid whether the
file is read directly, served via `tbd shortcut`, or embedded in another tool.
File paths (and relative markdown links) break when shortcuts are flattened into the
`.tbd` cache or relocated, so avoid them inside shortcut bodies.

## Example Workflow

User: “I want to create a new research brief”

Agent:
1. Runs `tbd shortcut new-research-brief`
2. Follows the instructions in the output
3. The instructions may say to create a bead, copy a template, etc.

## Shortcut Locations

Shortcuts are loaded from directories in the doc path (searched in order):

- `.tbd/docs/shortcuts/system/` - Core system docs (skill-baseline,
  shortcut-explanation, etc.)
- `.tbd/docs/shortcuts/standard/` - Standard workflow shortcuts

Directories earlier in the doc path take precedence.
If you add a shortcut with the same name in an earlier directory, it will take
precedence over a same-named shortcut in a later directory.

## Creating Custom Shortcuts

1. Create a markdown file in `.tbd/docs/shortcuts/standard/` or a custom directory
2. Add YAML frontmatter with `title` and `description` for searchability
3. Write your instructions in the body

Example:
```markdown
---
title: My Custom Workflow
description: Do something specific to my project
---

Instructions here...
```
