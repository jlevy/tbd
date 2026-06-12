# Human and Agent Development Docs

This folder holds docs and rules for use by humans and LLMs/agents.

Any filenames like @docs/general/agent-rules/python-rules.md are paths from the root of
this repository.

## Documentation Layout

All project and development documentation is organized in `docs/`, which follow the
Speculate project structure:

### `docs/development.md`—Essential development docs

- `development.md`—Environment setup and basic developer workflows (building,
  formatting, linting, testing, committing, etc.)

Always read `development.md` first!
Other docs give background but it includes essential project developer docs.

### `docs/general/`—Cross-project rules and templates

General rules that apply to all projects:

- @docs/general/agent-rules/—General rules for development best practices (general,
  pre-commit, TypeScript, Convex)

- @docs/general/agent-guidelines/—Guidelines and notes on development practices

- @docs/general/agent-setup/—Setup guides for tools (GitHub CLI, beads, etc.)

### `docs/project/`—Project-specific documentation

Project-specific specifications, architecture, and research docs:

- @docs/project/specs/—Change specifications for features and bugfixes:

  - `active/`—Currently in-progress specifications

  - `done/`—Completed specifications (historic)

  - `future/`—Planned specifications

  - `paused/`—Temporarily paused specifications

- @docs/project/architecture/—System design references and long-lived architecture docs
  (templates and output go here)

- @docs/project/research/—Research notes and technical investigations

### tbd CLI Documentation Commands

In addition to these repository docs, tbd provides managed documentation via the
`tbd docs` group and per-kind readers:

- `tbd docs`—Status overview of managed docs; `tbd docs list` shows every doc across
  kinds with `[forked]`/`[customized]`/`[local]` markers
- `tbd docs show <name>`—Read any doc by name; `tbd docs show tbd-docs` is the CLI
  manual (alias `tbd docs manual`)
- `tbd shortcut <name>` / `tbd guidelines <name>` / `tbd template <name>`—Per-kind
  readers (with `--list`)
- `tbd docs sync`—Refresh the gitignored `.tbd/docs/` cache (also run by setup)

#### Forking docs into the repo

`tbd docs fork <name>` (or `--all`) copies managed docs into a visible, git-tracked
`docs/tbd/` folder; tbd then serves your copies everywhere it served the upstream ones.
`tbd docs update` three-way merges upstream changes into forked copies after an upgrade;
`tbd docs status` shows each doc’s state.
See “Managing Docs” in `tbd docs show tbd-docs` for the full model.

#### Adding external docs by URL

You can register external documentation from any URL (including GitHub blob URLs):

```bash
tbd guidelines --add=<url> --name=<name>
tbd shortcut --add=<url> --name=<name>
tbd template --add=<url> --name=<name>
```

GitHub blob URLs are automatically converted to raw URLs.
If direct fetch returns HTTP 403, the system falls back to `gh api` for authenticated
access.
User-added shortcuts are stored in `shortcuts/custom/` to keep them separate from
bundled docs. (A unified `tbd docs add <docref>` form is planned; the per-kind flags
remain as aliases.)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
